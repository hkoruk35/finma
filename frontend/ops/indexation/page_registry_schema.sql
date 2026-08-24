-- =====================================================================
-- BogaStock — İndeksleme politikası şeması (v1.0)
-- Hedef: Supabase / PostgreSQL 15+
-- Bkz. INDEXATION_POLICY.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Sayfa kütüğü — politikanın tek gerçek kaynağı
-- ---------------------------------------------------------------------

CREATE TYPE page_family AS ENUM (
    'index_main', 'index_daily', 'index_weekly',
    'stock_main', 'earnings', 'list'
);

CREATE TABLE page_registry (
    id                bigserial PRIMARY KEY,
    url_path          text        NOT NULL UNIQUE,   -- /global/tr/ipc-mexico
    family            page_family NOT NULL,
    lang              text        NOT NULL CHECK (lang IN ('tr','en','es','fr','pt','id')),
    entity_key        text,                          -- 'ipc-mexico' | 'NVDA' | NULL

    -- İçerik özellikleri
    content_date      date,                          -- tarihli sayfalar; evergreen'de NULL
    first_seen        date        NOT NULL DEFAULT current_date,
    last_content_hash text,                          -- değişim tespiti

    -- Kademe (yalnız stock_main için anlamlı)
    tier              smallint    CHECK (tier BETWEEN 1 AND 3),

    -- Skor bileşenleri (job tarafından yazılır)
    u_score           numeric(4,3),
    d_score           numeric(4,3),
    k_score           numeric(4,3),
    t_score           numeric(4,3),
    index_score       numeric(4,3),

    -- Kararlar (render ve sitemap bunları okur)
    robots_directive  text        NOT NULL DEFAULT 'noindex,follow'
                                  CHECK (robots_directive IN ('index,follow','noindex,follow')),
    in_sitemap        boolean     NOT NULL DEFAULT false,

    scored_at         timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Render yolu: url_path ile tek satır okuma (UNIQUE indeks yeterli)
-- Sitemap yolu: kısmi indeks, yalnız sitemap'te olan satırları tarar
CREATE INDEX page_registry_sitemap_idx
    ON page_registry (family, lang, url_path) WHERE in_sitemap;

-- Skorlama işinin tarama yolu
CREATE INDEX page_registry_scoring_idx
    ON page_registry (family, lang, content_date);

-- Kademe terfi işinin yolu
CREATE INDEX page_registry_tier_idx
    ON page_registry (entity_key) WHERE family = 'stock_main';

COMMENT ON COLUMN page_registry.robots_directive IS
    'Sayfa render''ı bu değeri doğrudan meta robots etiketine basar. '
    'Politika koda gömülmez — bkz. INDEXATION_POLICY.md Kural 5.';

-- ---------------------------------------------------------------------
-- 2. Search Console günlük veri alımı
-- ---------------------------------------------------------------------

CREATE TABLE gsc_daily (
    url_path    text    NOT NULL,
    d           date    NOT NULL,
    impressions int     NOT NULL DEFAULT 0,
    clicks      int     NOT NULL DEFAULT 0,
    position    numeric(6,2),
    PRIMARY KEY (url_path, d)
);
CREATE INDEX gsc_daily_recent_idx ON gsc_daily (d DESC);

-- İç tıklamalar (kendi analitiğinden)
CREATE TABLE internal_click_daily (
    url_path text NOT NULL,
    d        date NOT NULL,
    clicks   int  NOT NULL DEFAULT 0,
    PRIMARY KEY (url_path, d)
);

-- 90 günlük toplamlar — job her gün bunu okur, ham tabloyu değil
CREATE MATERIALIZED VIEW mv_demand_90d AS
SELECT
    COALESCE(g.url_path, i.url_path)              AS url_path,
    COALESCE(SUM(g.impressions), 0)::int          AS impressions_90d,
    COALESCE(SUM(g.clicks), 0)::int               AS gsc_clicks_90d,
    COALESCE(SUM(i.clicks), 0)::int               AS internal_clicks_90d,
    COALESCE(SUM(g.impressions) FILTER
             (WHERE g.d >= current_date - 30), 0)::int AS impressions_30d,
    COALESCE(SUM(g.impressions) FILTER
             (WHERE g.d >= current_date - 180), 0)::int AS impressions_180d
FROM gsc_daily g
FULL OUTER JOIN internal_click_daily i
       ON i.url_path = g.url_path AND i.d = g.d
WHERE COALESCE(g.d, i.d) >= current_date - 180
GROUP BY 1;
CREATE UNIQUE INDEX mv_demand_90d_pk ON mv_demand_90d (url_path);

-- ---------------------------------------------------------------------
-- 3. Benzersizlik önbelleği (aile + dil düzeyinde)
-- ---------------------------------------------------------------------

CREATE TABLE family_uniqueness (
    family       page_family NOT NULL,
    lang         text        NOT NULL,
    computed_on  date        NOT NULL,
    sample_size  int         NOT NULL,
    u_mean       numeric(4,3) NOT NULL,
    u_p10        numeric(4,3),          -- en tekdüze %10 — şablon sızıntısı göstergesi
    PRIMARY KEY (family, lang, computed_on)
);

-- En güncel değer
CREATE VIEW v_family_uniqueness_latest AS
SELECT DISTINCT ON (family, lang) family, lang, u_mean, u_p10, computed_on
FROM family_uniqueness
ORDER BY family, lang, computed_on DESC;

-- ---------------------------------------------------------------------
-- 4. Denetim izi — her karar değişikliği kaydedilir
-- ---------------------------------------------------------------------

CREATE TABLE page_registry_audit (
    id          bigserial PRIMARY KEY,
    run_at      timestamptz NOT NULL DEFAULT now(),
    job         text        NOT NULL,
    scored      int,
    to_index    int,        -- noindex → index geçen sayfa sayısı
    to_noindex  int,        -- index → noindex geçen sayfa sayısı
    tier_up     int,
    tier_down   int,
    detail      jsonb
);

-- ---------------------------------------------------------------------
-- 5. Sitemap kaynağı
-- ---------------------------------------------------------------------

CREATE VIEW v_sitemap_urls AS
SELECT
    url_path,
    family,
    lang,
    GREATEST(COALESCE(content_date, first_seen), first_seen) AS lastmod,
    CASE family
        WHEN 'index_main'   THEN 'hourly'
        WHEN 'stock_main'   THEN 'hourly'
        WHEN 'list'         THEN 'hourly'
        WHEN 'index_daily'  THEN 'never'
        WHEN 'index_weekly' THEN 'never'
        WHEN 'earnings'     THEN 'never'
    END AS changefreq
FROM page_registry
WHERE in_sitemap
  AND robots_directive = 'index,follow';   -- çelişkili sinyale karşı ikinci savunma

COMMENT ON VIEW v_sitemap_urls IS
    'Sitemap üretimi YALNIZ bu görünümden yapılır. '
    'noindex bir URL asla sitemap''e giremez — INDEXATION_POLICY.md Kural 2.';

-- ---------------------------------------------------------------------
-- 6. Koruyucu tetikleyiciler
-- ---------------------------------------------------------------------

-- Kural 2'nin veritabanı düzeyinde zorlanması
ALTER TABLE page_registry ADD CONSTRAINT sitemap_requires_index
    CHECK (NOT in_sitemap OR robots_directive = 'index,follow');

-- Kural 1'in veritabanı düzeyinde zorlanması:
-- stock ailesi için tarihli satır oluşturulamaz
ALTER TABLE page_registry ADD CONSTRAINT no_dated_stock_pages
    CHECK (NOT (family = 'stock_main' AND content_date IS NOT NULL));

CREATE OR REPLACE FUNCTION touch_page_registry() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER page_registry_touch
    BEFORE UPDATE ON page_registry
    FOR EACH ROW EXECUTE FUNCTION touch_page_registry();

-- ---------------------------------------------------------------------
-- 7. Render yolu için yardımcı fonksiyon (tek satır, tek okuma)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION page_robots(p_url text)
RETURNS text LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT robots_directive FROM page_registry WHERE url_path = p_url),
        'noindex,follow'                      -- kütükte yoksa varsayılan güvenli taraf
    );
$$;

"""
BogaStock — Günlük İndeksleme Skoru İşi
=======================================

Ne yapar:
  1. mv_demand_90d görünümünü tazeler
  2. Haftada bir: aile+dil başına benzersizlik (U) örneklemesi yapar
  3. Her sayfa için IndexScore hesaplar
  4. robots_directive ve in_sitemap alanlarını günceller
  5. stock_main kademelerini terfi/tenzil eder
  6. Özeti page_registry_audit'e yazar

Çalışma sıklığı: günde 1 kez (ABD kapanışı + 1 saat)
Maliyet: toplu SQL güncellemeleri — sayfa başına sorgu YOK

Kullanım:
    python index_score_job.py --dry-run
    python index_score_job.py --commit
    python index_score_job.py --commit --force-uniqueness   # U'yu bugün yeniden hesapla

Bkz. INDEXATION_POLICY.md
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import re
import sys
from collections import Counter
from datetime import date

from sqlalchemy import create_engine, text

log = logging.getLogger("index_score_job")

POLICY_VERSION = "1.0"

# --- Ağırlıklar ve eşikler (INDEXATION_POLICY.md §2) ----------------------- #
W_U, W_D, W_K, W_T = 0.40, 0.25, 0.20, 0.15
THRESHOLD_INDEX = 0.55
THRESHOLD_FLOOR = 0.30

K_SCORE = {
    "index_main": 1.00, "stock_main": 1.00, "earnings": 1.00,
    "index_daily": 0.30, "index_weekly": 0.30,
    "list": 0.00,
}

HALF_LIFE_DAYS = {
    "index_daily": 7, "index_weekly": 30, "earnings": 120,
    "index_main": None, "stock_main": None, "list": None,   # None → T = 1.0
}

NEW_PAGE_GRACE_DAYS = 14
NEW_PAGE_D = 0.5

UNIQUENESS_SAMPLE = 500
UNIQUENESS_REFRESH_DAYS = 7
COMMON_TOKEN_THRESHOLD = 0.80        # kardeşlerin %80'inde geçen token şablondur

TIER_PROMOTE_3_TO_2_IMPR_30D = 1
TIER_PROMOTE_3_TO_2_INTERNAL = 3
TIER_PROMOTE_2_TO_1_IMPR_90D = 50
TIER_DEMOTE_ZERO_DAYS = 180


# ========================================================================== #
# 1. Benzersizlik (U)
# ========================================================================== #

TOKEN_RE = re.compile(r"[\wçğıöşüÇĞİÖŞÜáéíóúñàâêôûã]+", re.UNICODE)


def tokenize(txt: str) -> set[str]:
    return {t.lower() for t in TOKEN_RE.findall(txt) if len(t) > 2}


def compute_family_uniqueness(conn, family: str, lang: str) -> tuple[float, float, int]:
    """
    family+lang için rastgele örnek üzerinden U dağılımı.
    U = (sayfaya özgü token) / (toplam token)
    Kardeşlerin >=%80'inde geçen token "şablon" sayılır ve paydan düşülür.
    """
    rows = conn.execute(text("""
        SELECT pr.url_path, pc.body_text
        FROM page_registry pr
        JOIN page_content pc ON pc.url_path = pr.url_path
        WHERE pr.family = :family AND pr.lang = :lang
        ORDER BY random()
        LIMIT :n
    """), {"family": family, "lang": lang, "n": UNIQUENESS_SAMPLE}).fetchall()

    if len(rows) < 5:
        return (1.0, 1.0, len(rows))       # örnek yetersiz — cezalandırma

    docs = [tokenize(r.body_text or "") for r in rows]
    df = Counter()
    for d in docs:
        df.update(d)
    n = len(docs)
    template_tokens = {tok for tok, c in df.items() if c / n >= COMMON_TOKEN_THRESHOLD}

    us = []
    for d in docs:
        if not d:
            us.append(0.0)
            continue
        us.append(len(d - template_tokens) / len(d))
    us.sort()
    u_mean = sum(us) / len(us)
    u_p10 = us[max(0, int(len(us) * 0.10) - 1)]
    return (round(u_mean, 3), round(u_p10, 3), n)


def refresh_uniqueness(conn, force: bool) -> int:
    """Haftada bir çalışır. force=True ise bugün yeniden hesaplar."""
    if not force:
        stale = conn.execute(text("""
            SELECT count(*) FROM v_family_uniqueness_latest
            WHERE computed_on > current_date - :days
        """), {"days": UNIQUENESS_REFRESH_DAYS}).scalar()
        combos = conn.execute(text(
            "SELECT count(DISTINCT (family, lang)) FROM page_registry")).scalar()
        if stale and combos and stale >= combos:
            log.info("  U önbelleği taze — atlandı")
            return 0

    combos = conn.execute(text("""
        SELECT DISTINCT family::text AS family, lang FROM page_registry
    """)).fetchall()

    written = 0
    for c in combos:
        u_mean, u_p10, n = compute_family_uniqueness(conn, c.family, c.lang)
        conn.execute(text("""
            INSERT INTO family_uniqueness (family, lang, computed_on, sample_size, u_mean, u_p10)
            VALUES (:f, :l, current_date, :n, :m, :p)
            ON CONFLICT (family, lang, computed_on)
            DO UPDATE SET sample_size = EXCLUDED.sample_size,
                          u_mean = EXCLUDED.u_mean, u_p10 = EXCLUDED.u_p10
        """), {"f": c.family, "l": c.lang, "n": n, "m": u_mean, "p": u_p10})
        written += 1
        log.info("  U[%s/%s] ort=%.3f p10=%.3f (n=%d)", c.family, c.lang, u_mean, u_p10, n)
        if u_mean < THRESHOLD_FLOOR:
            log.warning("  !! %s/%s benzersizliği eşiğin altında — bu aile URL olarak "
                        "değil, üst sayfanın sekmesi olarak sunulmalı", c.family, c.lang)
    return written


# ========================================================================== #
# 2. Skorlama — tek toplu UPDATE
# ========================================================================== #

SCORE_SQL = f"""
WITH scored AS (
    SELECT
        pr.id,
        -- U: evergreen sayfalarda sayfa bazlı değer varsa onu, yoksa aile ortalamasını kullan
        COALESCE(pr.u_score, fu.u_mean, 0.5)                            AS u,
        -- D: talep sinyali (yeni sayfa muafiyeti dahil)
        CASE
            WHEN pr.first_seen > current_date - {NEW_PAGE_GRACE_DAYS}
                THEN {NEW_PAGE_D}
            ELSE LEAST(1.0,
                 ln(1 + COALESCE(dm.impressions_90d, 0)
                      + 3 * COALESCE(dm.internal_clicks_90d, 0)) / ln(50))
        END                                                             AS d,
        -- K: kalıcılık (aileden sabit)
        (:k_map::jsonb ->> pr.family::text)::numeric                    AS k,
        -- T: tazelik (yarı ömür yoksa 1.0)
        CASE
            WHEN (:hl_map::jsonb ->> pr.family::text) IS NULL THEN 1.0
            ELSE exp( -(current_date - COALESCE(pr.content_date, pr.first_seen))::numeric
                      / (:hl_map::jsonb ->> pr.family::text)::numeric )
        END                                                             AS t
    FROM page_registry pr
    LEFT JOIN v_family_uniqueness_latest fu
           ON fu.family = pr.family AND fu.lang = pr.lang
    LEFT JOIN mv_demand_90d dm
           ON dm.url_path = pr.url_path
),
final AS (
    SELECT id, u, d, k, t,
           ROUND(({W_U}*u + {W_D}*d + {W_K}*k + {W_T}*t)::numeric, 3) AS score
    FROM scored
)
UPDATE page_registry pr
SET u_score  = ROUND(f.u::numeric, 3),
    d_score  = ROUND(f.d::numeric, 3),
    k_score  = ROUND(f.k::numeric, 3),
    t_score  = ROUND(f.t::numeric, 3),
    index_score = f.score,
    robots_directive = CASE WHEN f.score >= {THRESHOLD_INDEX}
                            THEN 'index,follow' ELSE 'noindex,follow' END,
    in_sitemap = (f.score >= {THRESHOLD_INDEX}),
    scored_at = now()
FROM final f
WHERE f.id = pr.id
  AND (pr.index_score IS DISTINCT FROM f.score
       OR pr.robots_directive IS DISTINCT FROM
          CASE WHEN f.score >= {THRESHOLD_INDEX} THEN 'index,follow' ELSE 'noindex,follow' END);
"""

# Kademe 3 hisseleri skordan bağımsız olarak indekste tutulmaz
TIER3_OVERRIDE_SQL = """
UPDATE page_registry
SET robots_directive = 'noindex,follow', in_sitemap = false
WHERE family = 'stock_main' AND tier = 3
  AND robots_directive <> 'noindex,follow';
"""


def score_pages(conn) -> dict:
    before = conn.execute(text("""
        SELECT count(*) FILTER (WHERE robots_directive = 'index,follow') AS idx,
               count(*) AS total FROM page_registry
    """)).one()

    conn.execute(text(SCORE_SQL), {
        "k_map": json.dumps(K_SCORE),
        "hl_map": json.dumps(HALF_LIFE_DAYS),
    })
    conn.execute(text(TIER3_OVERRIDE_SQL))

    after = conn.execute(text("""
        SELECT count(*) FILTER (WHERE robots_directive = 'index,follow') AS idx,
               count(*) AS total FROM page_registry
    """)).one()

    return {"indexable_before": before.idx, "indexable_after": after.idx,
            "total": after.total, "delta": after.idx - before.idx}


# ========================================================================== #
# 3. Kademe terfi / tenzil
# ========================================================================== #

TIER_SQL = f"""
WITH agg AS (
    SELECT pr.entity_key,
           SUM(COALESCE(dm.impressions_30d, 0))     AS impr_30,
           SUM(COALESCE(dm.impressions_90d, 0))     AS impr_90,
           SUM(COALESCE(dm.impressions_180d, 0))    AS impr_180,
           SUM(COALESCE(dm.internal_clicks_90d, 0)) AS internal_90,
           MIN(pr.tier)                             AS tier
    FROM page_registry pr
    LEFT JOIN mv_demand_90d dm ON dm.url_path = pr.url_path
    WHERE pr.family = 'stock_main'
    GROUP BY pr.entity_key
),
decided AS (
    SELECT entity_key, tier,
        CASE
            WHEN tier = 3 AND (impr_30 >= {TIER_PROMOTE_3_TO_2_IMPR_30D}
                               OR internal_90 >= {TIER_PROMOTE_3_TO_2_INTERNAL}) THEN 2
            WHEN tier = 2 AND impr_90 >= {TIER_PROMOTE_2_TO_1_IMPR_90D}          THEN 1
            -- tenzil: 180 gün sıfır gösterim, Kademe 1 en fazla 2'ye düşer
            WHEN impr_180 = 0 AND tier = 1                                       THEN 2
            WHEN impr_180 = 0 AND tier = 2                                       THEN 3
            ELSE tier
        END AS new_tier
    FROM agg
)
UPDATE page_registry pr
SET tier = d.new_tier
FROM decided d
WHERE pr.entity_key = d.entity_key
  AND pr.family = 'stock_main'
  AND pr.tier IS DISTINCT FROM d.new_tier
RETURNING pr.entity_key, d.tier AS old_tier, d.new_tier;
"""


def adjust_tiers(conn) -> dict:
    rows = conn.execute(text(TIER_SQL)).fetchall()
    up = sum(1 for r in rows if r.new_tier < r.old_tier)
    down = sum(1 for r in rows if r.new_tier > r.old_tier)
    if rows:
        log.info("  Kademe değişimi: %d terfi, %d tenzil", up, down)
    return {"tier_up": up, "tier_down": down}


# ========================================================================== #
# 4. Giriş noktası
# ========================================================================== #

def main() -> int:
    p = argparse.ArgumentParser(description="BogaStock günlük indeksleme skoru işi")
    p.add_argument("--commit", action="store_true", help="Belirtilmezse dry-run")
    p.add_argument("--force-uniqueness", action="store_true")
    p.add_argument("--db-url", default=os.environ.get("DATABASE_URL", ""))
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)-7s %(message)s")

    if not args.db_url:
        log.error("DATABASE_URL gerekli")
        return 2

    engine = create_engine(args.db_url, pool_pre_ping=True)
    conn = engine.connect()
    trans = conn.begin()

    try:
        log.info("1/5 Talep görünümü tazeleniyor…")
        conn.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_demand_90d"))

        log.info("2/5 Benzersizlik (U) örneklemesi…")
        refresh_uniqueness(conn, force=args.force_uniqueness)

        log.info("3/5 Skorlama…")
        stats = score_pages(conn)
        log.info("    İndekslenebilir: %d → %d (%+d) / toplam %d",
                 stats["indexable_before"], stats["indexable_after"],
                 stats["delta"], stats["total"])

        log.info("4/5 Kademe ayarı…")
        stats.update(adjust_tiers(conn))

        # Politika sızıntısı alarmı
        if stats["indexable_before"] and \
           stats["delta"] > 0.20 * stats["indexable_before"]:
            log.warning("!! İndekslenebilir sayfa sayısı bir günde %%20'den fazla arttı — "
                        "yeni bir aile politikasız açılmış olabilir. Kontrol et.")

        log.info("5/5 Denetim kaydı…")
        conn.execute(text("""
            INSERT INTO page_registry_audit (job, scored, to_index, to_noindex,
                                             tier_up, tier_down, detail)
            VALUES ('index_score_job', :scored,
                    GREATEST(:delta, 0), GREATEST(-:delta, 0),
                    :tier_up, :tier_down, CAST(:detail AS jsonb))
        """), {
            "scored": stats["total"], "delta": stats["delta"],
            "tier_up": stats["tier_up"], "tier_down": stats["tier_down"],
            "detail": json.dumps({**stats, "policy_version": POLICY_VERSION,
                                  "run_date": date.today().isoformat()}),
        })

        if args.commit:
            trans.commit()
            log.info("Yazıldı.")
        else:
            trans.rollback()
            log.info("DRY-RUN: hiçbir değişiklik kaydedilmedi.")
        return 0
    except Exception:
        trans.rollback()
        log.exception("İş başarısız — tüm değişiklikler geri alındı")
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())

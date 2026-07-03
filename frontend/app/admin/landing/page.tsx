"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { LandingConfig, LandingFeature, LandingScreenshot, LandingJpmImage } from "@/lib/landingConfig";

/* ─── tiny helpers ─── */
const S = { background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: 12 } as const;
const Inp = ({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      background: "#0a0e17", border: "1px solid #30363d", borderRadius: 4, padding: "6px 8px",
      color: "#e6edf3", fontSize: 12, width: "100%", fontFamily: mono ? "monospace" : undefined,
    }}
  />
);
const Textarea = ({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    rows={rows}
    style={{
      background: "#0a0e17", border: "1px solid #30363d", borderRadius: 4, padding: "6px 8px",
      color: "#e6edf3", fontSize: 12, width: "100%", resize: "vertical",
    }}
  />
);
const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ color: "#8b949e", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{children}</div>
);
const Btn = ({ children, onClick, variant = "default", disabled }: { children: React.ReactNode; onClick?: () => void; variant?: "default" | "danger" | "success" | "ghost"; disabled?: boolean }) => {
  const colors = {
    default: { background: "#21262d", color: "#e6edf3", border: "1px solid #30363d" },
    danger: { background: "#3f1a1a", color: "#f85149", border: "1px solid #f8514940" },
    success: { background: "#0d2a1d", color: "#3fb950", border: "1px solid #3fb95040" },
    ghost: { background: "transparent", color: "#8b949e", border: "1px solid transparent" },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...colors, borderRadius: 4, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
};

const ICON_OPTIONS = ["bolt", "chart-bar", "trending-up", "shield", "star", "globe"];

/* ─── Image Upload Button ─── */
function ImageUploadBtn({ folder, onUploaded }: { folder: string; onUploaded: (url: string) => void }) {
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/admin/landing/upload", { method: "POST", body: fd });
    const json = await res.json();
    setLoading(false);
    if (json.url) onUploaded(json.url);
    if (ref.current) ref.current.value = "";
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      <Btn onClick={() => ref.current?.click()} disabled={loading}>{loading ? "Yükleniyor..." : "📁 Resim Yükle"}</Btn>
    </>
  );
}

/* ─── Draggable list item ─── */
function DragHandle() {
  return <span style={{ cursor: "grab", color: "#8b949e", fontSize: 16, paddingRight: 6, userSelect: "none" }}>⠿</span>;
}

/* ─── Screenshots editor ─── */
function ScreenshotsEditor({ items, onChange }: { items: LandingScreenshot[]; onChange: (v: LandingScreenshot[]) => void }) {
  const dragIdx = useRef<number | null>(null);

  function update(i: number, key: keyof LandingScreenshot, val: string) {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it);
    onChange(next);
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() { onChange([...items, { src: "", label: "", desc: "" }]); }
  function onDragStart(i: number) { dragIdx.current = i; }
  function onDrop(i: number) {
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = null;
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(i)}
          style={{ ...S, display: "flex", gap: 8, alignItems: "flex-start" }}
        >
          <DragHandle />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {item.src && <img src={item.src} alt="" style={{ width: 64, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid #30363d", flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <Label>Resim URL</Label>
                <Inp value={item.src} onChange={(v) => update(i, "src", v)} placeholder="/screenshots/..." mono />
              </div>
              <ImageUploadBtn folder="screenshots" onUploaded={(url) => update(i, "src", url)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div><Label>Başlık</Label><Inp value={item.label} onChange={(v) => update(i, "label", v)} /></div>
              <div><Label>Açıklama</Label><Inp value={item.desc} onChange={(v) => update(i, "desc", v)} /></div>
            </div>
          </div>
          <Btn variant="danger" onClick={() => remove(i)}>✕</Btn>
        </div>
      ))}
      <Btn onClick={add}>+ Resim Ekle</Btn>
    </div>
  );
}

/* ─── Features editor ─── */
function FeaturesEditor({ items, onChange }: { items: LandingFeature[]; onChange: (v: LandingFeature[]) => void }) {
  const dragIdx = useRef<number | null>(null);

  function update(i: number, key: keyof LandingFeature, val: string) {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it) as LandingFeature[];
    onChange(next);
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() { onChange([...items, { icon: "bolt", title: "", desc: "" }]); }
  function onDragStart(i: number) { dragIdx.current = i; }
  function onDrop(i: number) {
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = null;
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(i)}
          style={{ ...S, display: "flex", gap: 8, alignItems: "flex-start" }}
        >
          <DragHandle />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 6 }}>
              <div>
                <Label>İkon</Label>
                <select value={item.icon} onChange={(e) => update(i, "icon", e.target.value)} style={{ background: "#0a0e17", border: "1px solid #30363d", borderRadius: 4, padding: "6px 8px", color: "#e6edf3", fontSize: 12, width: "100%" }}>
                  {ICON_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><Label>Başlık</Label><Inp value={item.title} onChange={(v) => update(i, "title", v)} /></div>
            </div>
            <div><Label>Açıklama</Label><Textarea value={item.desc} onChange={(v) => update(i, "desc", v)} rows={2} /></div>
          </div>
          <Btn variant="danger" onClick={() => remove(i)}>✕</Btn>
        </div>
      ))}
      <Btn onClick={add}>+ Kart Ekle</Btn>
    </div>
  );
}

/* ─── JPM Images editor ─── */
function JpmImagesEditor({ items, onChange }: { items: LandingJpmImage[]; onChange: (v: LandingJpmImage[]) => void }) {
  const dragIdx = useRef<number | null>(null);

  function update(i: number, key: keyof LandingJpmImage, val: string) {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: val } : it);
    onChange(next);
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() { onChange([...items, { src: "", label: "" }]); }
  function onDragStart(i: number) { dragIdx.current = i; }
  function onDrop(i: number) {
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = null;
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((img, i) => (
        <div
          key={i}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(i)}
          style={{ ...S, display: "flex", gap: 8, alignItems: "center" }}
        >
          <DragHandle />
          {img.src && <img src={img.src} alt="" style={{ width: 64, height: 40, objectFit: "cover", borderRadius: 4, border: "1px solid #30363d", flexShrink: 0 }} />}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <Label>URL</Label>
              <Inp value={img.src} onChange={(v) => update(i, "src", v)} placeholder="/jpm/..." mono />
            </div>
            <div><Label>Etiket</Label><Inp value={img.label} onChange={(v) => update(i, "label", v)} /></div>
          </div>
          <ImageUploadBtn folder="jpm" onUploaded={(url) => update(i, "src", url)} />
          <Btn variant="danger" onClick={() => remove(i)}>✕</Btn>
        </div>
      ))}
      <Btn onClick={add}>+ Görsel Ekle</Btn>
    </div>
  );
}

/* ─── Section wrapper ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ ...S, padding: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#e6edf3", fontWeight: 700, fontSize: 13 }}
      >
        {title}
        <span style={{ color: "#8b949e", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}

/* ─── Main admin page ─── */
export default function LandingAdminPage() {
  const [allConfigs, setAllConfigs] = useState<Record<string, LandingConfig>>({});
  const [lang, setLang] = useState("tr");
  const [cfg, setCfg] = useState<LandingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [newLang, setNewLang] = useState("");
  const [addingLang, setAddingLang] = useState(false);

  useEffect(() => {
    fetch("/api/admin/landing")
      .then((r) => r.json())
      .then((data) => {
        setAllConfigs(data);
        if (data[lang]) setCfg(JSON.parse(JSON.stringify(data[lang])));
        else if (Object.keys(data).length > 0) {
          const first = Object.keys(data)[0];
          setLang(first);
          setCfg(JSON.parse(JSON.stringify(data[first])));
        }
      });
  }, []);

  function switchLang(l: string) {
    setLang(l);
    if (allConfigs[l]) setCfg(JSON.parse(JSON.stringify(allConfigs[l])));
  }

  function patch<K extends keyof LandingConfig>(section: K, value: LandingConfig[K]) {
    if (!cfg) return;
    setCfg({ ...cfg, [section]: value });
  }

  function patchHero(key: keyof LandingConfig["hero"], val: string) {
    if (!cfg) return;
    setCfg({ ...cfg, hero: { ...cfg.hero, [key]: val } });
  }
  function patchCtaPrimary(key: keyof LandingConfig["cta_primary"], val: string) {
    if (!cfg) return;
    setCfg({ ...cfg, cta_primary: { ...cfg.cta_primary, [key]: val } });
  }
  function patchCtaSecondary(key: keyof LandingConfig["cta_secondary"], val: string) {
    if (!cfg) return;
    setCfg({ ...cfg, cta_secondary: { ...cfg.cta_secondary, [key]: val } });
  }
  function patchJpm(key: keyof LandingConfig["jpm"], val: unknown) {
    if (!cfg) return;
    setCfg({ ...cfg, jpm: { ...cfg.jpm, [key]: val } });
  }
  function patchBottomCta(key: keyof LandingConfig["bottom_cta"], val: string) {
    if (!cfg) return;
    setCfg({ ...cfg, bottom_cta: { ...cfg.bottom_cta, [key]: val } });
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/admin/landing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, data: cfg }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.ok) {
      setAllConfigs((prev) => ({ ...prev, [lang]: cfg }));
      setStatus({ ok: true, msg: "Kaydedildi ✓" });
    } else {
      setStatus({ ok: false, msg: json.error ?? "Hata" });
    }
    setTimeout(() => setStatus(null), 3000);
  }

  async function addLanguage() {
    const l = newLang.trim().toLowerCase();
    if (!l || allConfigs[l]) return;
    const base = allConfigs["tr"] ?? allConfigs[Object.keys(allConfigs)[0]];
    const next = { ...allConfigs, [l]: JSON.parse(JSON.stringify(base)) };
    const res = await fetch("/api/admin/landing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: l, data: next[l] }),
    });
    if ((await res.json()).ok) {
      setAllConfigs(next);
      setNewLang("");
      setAddingLang(false);
      switchLang(l);
    }
  }

  async function deleteLang() {
    if (!confirm(`"${lang}" dilini silmek istediğinizden emin misiniz?`)) return;
    const res = await fetch(`/api/admin/landing?lang=${lang}`, { method: "DELETE" });
    if ((await res.json()).ok) {
      const next = { ...allConfigs };
      delete next[lang];
      setAllConfigs(next);
      const remaining = Object.keys(next);
      if (remaining.length > 0) switchLang(remaining[0]);
      else { setLang(""); setCfg(null); }
    }
  }

  const langs = Object.keys(allConfigs);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto", fontFamily: "monospace" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "#e6edf3", fontSize: 20, fontWeight: 900, margin: 0 }}>🌐 Landing Page Yöneticisi</h1>
        <p style={{ color: "#8b949e", fontSize: 12, margin: "4px 0 0" }}>bogastock.com/global/* sayfası içeriklerini buradan düzenleyebilirsiniz.</p>
      </div>

      {/* Lang switcher */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        {langs.map((l) => (
          <button
            key={l}
            onClick={() => switchLang(l)}
            style={{
              background: l === lang ? "#1f6feb" : "#21262d",
              color: l === lang ? "#fff" : "#8b949e",
              border: `1px solid ${l === lang ? "#1f6feb" : "#30363d"}`,
              borderRadius: 4, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase",
            }}
          >
            {l}
          </button>
        ))}
        {addingLang ? (
          <div style={{ display: "flex", gap: 4 }}>
            <input
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              placeholder="de, fr, es..."
              style={{ background: "#0a0e17", border: "1px solid #30363d", borderRadius: 4, padding: "5px 8px", color: "#e6edf3", fontSize: 12, width: 80 }}
              onKeyDown={(e) => e.key === "Enter" && addLanguage()}
              autoFocus
            />
            <Btn variant="success" onClick={addLanguage}>Ekle</Btn>
            <Btn variant="ghost" onClick={() => setAddingLang(false)}>İptal</Btn>
          </div>
        ) : (
          <Btn onClick={() => setAddingLang(true)}>+ Dil Ekle</Btn>
        )}
        {langs.length > 1 && <Btn variant="danger" onClick={deleteLang}>🗑 {lang} Sil</Btn>}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {status && (
            <span style={{ fontSize: 12, color: status.ok ? "#3fb950" : "#f85149", fontWeight: 700 }}>{status.msg}</span>
          )}
          <Btn variant="success" onClick={save} disabled={saving || !cfg}>
            {saving ? "Kaydediliyor..." : "💾 Kaydet & Yayınla"}
          </Btn>
        </div>
      </div>

      {!cfg && (
        <div style={{ color: "#8b949e", fontSize: 14, textAlign: "center", padding: 40 }}>Dil seçin veya yeni dil ekleyin.</div>
      )}

      {cfg && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Hero */}
          <Section title="🚀 Hero Bölümü">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><Label>Badge Metni</Label><Inp value={cfg.hero.badge} onChange={(v) => patchHero("badge", v)} /></div>
              <div><Label>Kalın Metin (marka adı)</Label><Inp value={cfg.hero.description_bold} onChange={(v) => patchHero("description_bold", v)} /></div>
              <div><Label>Açıklama</Label><Textarea value={cfg.hero.description} onChange={(v) => patchHero("description", v)} rows={3} /></div>
            </div>
          </Section>

          {/* CTA Buttons */}
          <Section title="🔘 CTA Butonları">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ color: "#58a6ff", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Ana Buton</div>
                <div><Label>Metin</Label><Inp value={cfg.cta_primary.text} onChange={(v) => patchCtaPrimary("text", v)} /></div>
                <div><Label>Alt Yazı</Label><Inp value={cfg.cta_primary.subtext} onChange={(v) => patchCtaPrimary("subtext", v)} /></div>
                <div><Label>Link</Label><Inp value={cfg.cta_primary.href} onChange={(v) => patchCtaPrimary("href", v)} mono /></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>İkinci Buton</div>
                <div><Label>Metin</Label><Inp value={cfg.cta_secondary.text} onChange={(v) => patchCtaSecondary("text", v)} /></div>
                <div><Label>Link</Label><Inp value={cfg.cta_secondary.href} onChange={(v) => patchCtaSecondary("href", v)} mono /></div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <Label>Not (butonların altı)</Label>
              <Inp value={cfg.cta_note ?? ""} onChange={(v) => patch("cta_note", v)} />
            </div>
          </Section>

          {/* Screenshots */}
          <Section title="🖼️ Ekran Görüntüleri Banner (2×2 Grid)">
            <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 10 }}>Sürükleyerek sırayı değiştir. Max 4 resim önerilir (2 satır × 2 sütun).</p>
            <ScreenshotsEditor items={cfg.screenshots ?? []} onChange={(v) => patch("screenshots", v)} />
          </Section>

          {/* Features */}
          <Section title="✨ Özellik Kartları">
            <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 10 }}>Sürükleyerek sırayı değiştir. İkon seçeneği: bolt, chart-bar, trending-up, shield, star, globe.</p>
            <FeaturesEditor items={cfg.features ?? []} onChange={(v) => patch("features", v)} />
          </Section>

          {/* JPM Section */}
          <Section title="📄 PDF / Rapor Önizleme Bölümü">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Label>Aktif</Label>
                <input type="checkbox" checked={cfg.jpm?.enabled ?? false} onChange={(e) => patchJpm("enabled", e.target.checked)} style={{ cursor: "pointer" }} />
                <span style={{ color: "#8b949e", fontSize: 11 }}>{cfg.jpm?.enabled ? "Gösteriliyor" : "Gizli"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><Label>Badge</Label><Inp value={cfg.jpm?.badge ?? ""} onChange={(v) => patchJpm("badge", v)} /></div>
                <div><Label>Başlık</Label><Inp value={cfg.jpm?.title ?? ""} onChange={(v) => patchJpm("title", v)} /></div>
              </div>
              <div><Label>Açıklama</Label><Textarea value={cfg.jpm?.description ?? ""} onChange={(v) => patchJpm("description", v)} rows={2} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <Label>PDF URL</Label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Inp value={cfg.jpm?.pdf ?? ""} onChange={(v) => patchJpm("pdf", v)} placeholder="/jpm/..." mono />
                    <input
                      type="file"
                      accept=".pdf"
                      style={{ display: "none" }}
                      id="pdf-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("folder", "jpm");
                        const res = await fetch("/api/admin/landing/upload", { method: "POST", body: fd });
                        const json = await res.json();
                        if (json.url) patchJpm("pdf", json.url);
                      }}
                    />
                    <Btn onClick={() => document.getElementById("pdf-upload")?.click()}>📎 PDF Yükle</Btn>
                  </div>
                </div>
                <div><Label>PDF Buton Metni</Label><Inp value={cfg.jpm?.pdf_label ?? ""} onChange={(v) => patchJpm("pdf_label", v)} /></div>
              </div>
              <div style={{ marginTop: 4 }}>
                <Label>Önizleme Görseller (sürükle & bırak)</Label>
                <JpmImagesEditor items={cfg.jpm?.images ?? []} onChange={(v) => patchJpm("images", v)} />
              </div>
            </div>
          </Section>

          {/* Bottom CTA */}
          <Section title="📣 Alt CTA Bölümü">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div><Label>Başlık</Label><Inp value={cfg.bottom_cta?.title ?? ""} onChange={(v) => patchBottomCta("title", v)} /></div>
              <div><Label>Açıklama</Label><Inp value={cfg.bottom_cta?.description ?? ""} onChange={(v) => patchBottomCta("description", v)} /></div>
              <div><Label>Not</Label><Inp value={cfg.bottom_cta?.note ?? ""} onChange={(v) => patchBottomCta("note", v)} /></div>
            </div>
          </Section>

          {/* Preview link */}
          <div style={{ display: "flex", gap: 12 }}>
            <a href={`/global/${lang}`} target="_blank" rel="noreferrer" style={{ color: "#58a6ff", fontSize: 12, fontWeight: 700 }}>
              🔗 /global/{lang} sayfasını önizle →
            </a>
            <a href={`/global/${lang === "tr" ? "en" : "tr"}`} target="_blank" rel="noreferrer" style={{ color: "#8b949e", fontSize: 12 }}>
              Diğer dil: /global/{lang === "tr" ? "en" : "tr"} →
            </a>
          </div>

          {/* Save */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", paddingTop: 8, borderTop: "1px solid #30363d" }}>
            {status && <span style={{ fontSize: 12, color: status.ok ? "#3fb950" : "#f85149", fontWeight: 700 }}>{status.msg}</span>}
            <Btn variant="success" onClick={save} disabled={saving || !cfg}>
              {saving ? "Kaydediliyor..." : "💾 Kaydet & Yayınla"}
            </Btn>
          </div>

        </div>
      )}
    </div>
  );
}

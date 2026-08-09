"use client";

import { useEffect, useState } from "react";
import { AboutConfig } from "@/lib/aboutConfig";

const LANGUAGES = ["tr", "en", "es", "fr", "pt"];

export default function AdminAboutPage() {
  const [lang, setLang] = useState("tr");
  const [config, setConfig] = useState<AboutConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig(lang);
  }, [lang]);

  const fetchConfig = async (l: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/about-config?lang=${l}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        setConfig(null);
      }
    } catch (e) {
      console.error(e);
      setConfig(null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/about-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, data: config }),
      });
      if (res.ok) {
        alert("Kaydedildi!");
      } else {
        alert("Hata oluştu.");
      }
    } catch (e) {
      console.error(e);
      alert("Hata oluştu.");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-white">Yükleniyor...</div>;

  return (
    <div className="p-6 md:p-10 text-white max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black">Hakkımızda Yönetimi</h1>
        <div className="flex gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-4 py-2 rounded font-bold uppercase ${lang === l ? "bg-blue-600" : "bg-gray-800"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {!config ? (
        <div className="bg-red-500/20 text-red-400 p-4 rounded">Bu dil için konfigürasyon bulunamadı. Lütfen default konfigürasyon oluşturun.</div>
      ) : (
        <div className="space-y-8">
          
          {/* Hero Section */}
          <section className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Hero Section</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-gray-400">Subtitle</label>
                <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.hero.subtitle} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, subtitle: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">Title HTML</label>
                <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.hero.title_html} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, title_html: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">Title Highlight (Mavi Kısım)</label>
                <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.hero.title_highlight} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, title_highlight: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">Description</label>
                <textarea rows={3} className="w-full bg-black border border-gray-700 rounded p-2" value={config.hero.description} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, description: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">Hero Image URL (Opsiyonel Banner)</label>
                <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.hero.image_url} onChange={(e) => setConfig({ ...config, hero: { ...config.hero, image_url: e.target.value } })} />
              </div>
            </div>
          </section>

          {/* Sections */}
          <section className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-blue-400">İçerik Bölümleri (Sections)</h2>
            {config.sections.map((sec, i) => (
              <div key={i} className="mb-6 p-4 border border-gray-700 rounded bg-black/50">
                <h3 className="text-md font-bold mb-3 text-gray-300">Bölüm {i + 1}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1 text-gray-400">Başlık</label>
                    <input className="w-full bg-black border border-gray-700 rounded p-2" value={sec.title} onChange={(e) => {
                      const newSecs = [...config.sections];
                      newSecs[i].title = e.target.value;
                      setConfig({ ...config, sections: newSecs });
                    }} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-400">Açıklama</label>
                    <textarea rows={3} className="w-full bg-black border border-gray-700 rounded p-2" value={sec.description} onChange={(e) => {
                      const newSecs = [...config.sections];
                      newSecs[i].description = e.target.value;
                      setConfig({ ...config, sections: newSecs });
                    }} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-400">Görsel URL (Banner Eklenebilir)</label>
                    <input className="w-full bg-black border border-gray-700 rounded p-2" value={sec.image_url} onChange={(e) => {
                      const newSecs = [...config.sections];
                      newSecs[i].image_url = e.target.value;
                      setConfig({ ...config, sections: newSecs });
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Stats */}
          <section className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-blue-400">İstatistikler (Stats)</h2>
            <div className="mb-4">
              <label className="block text-sm mb-1 text-gray-400">Başlık</label>
              <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.stats.title} onChange={(e) => setConfig({ ...config, stats: { ...config.stats, title: e.target.value } })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {config.stats.items.map((stat, i) => (
                <div key={i} className="p-4 border border-gray-700 rounded bg-black/50">
                  <div className="mb-2">
                    <label className="block text-xs mb-1 text-gray-400">Sayı/Değer</label>
                    <input className="w-full bg-black border border-gray-700 rounded p-2" value={stat.number} onChange={(e) => {
                      const newItems = [...config.stats.items];
                      newItems[i].number = e.target.value;
                      setConfig({ ...config, stats: { ...config.stats, items: newItems } });
                    }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-gray-400">Metin</label>
                    <input className="w-full bg-black border border-gray-700 rounded p-2" value={stat.text} onChange={(e) => {
                      const newItems = [...config.stats.items];
                      newItems[i].text = e.target.value;
                      setConfig({ ...config, stats: { ...config.stats, items: newItems } });
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mission */}
          <section className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Misyon (Mission)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-gray-400">Başlık</label>
                <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.mission.title} onChange={(e) => setConfig({ ...config, mission: { ...config.mission, title: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">Açıklama</label>
                <textarea rows={3} className="w-full bg-black border border-gray-700 rounded p-2" value={config.mission.description} onChange={(e) => setConfig({ ...config, mission: { ...config.mission, description: e.target.value } })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">Misyon Banner URL</label>
                <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.mission.image_url} onChange={(e) => setConfig({ ...config, mission: { ...config.mission, image_url: e.target.value } })} />
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

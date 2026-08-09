"use client";

import { useEffect, useState } from "react";
import { SssConfig, SssItem } from "@/lib/sssConfig";

const LANGUAGES = ["tr", "en", "es", "fr", "pt"];

export default function AdminSssPage() {
  const [lang, setLang] = useState("tr");
  const [config, setConfig] = useState<SssConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig(lang);
  }, [lang]);

  const fetchConfig = async (l: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sss-config?lang=${l}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        setConfig({ title: "", description: "", faqs: [] });
      }
    } catch (e) {
      console.error(e);
      setConfig({ title: "", description: "", faqs: [] });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/sss-config", {
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

  const updateFaq = (index: number, field: keyof SssItem, value: string) => {
    if (!config) return;
    const newFaqs = [...config.faqs];
    newFaqs[index][field] = value;
    setConfig({ ...config, faqs: newFaqs });
  };

  const removeFaq = (index: number) => {
    if (!config) return;
    const newFaqs = config.faqs.filter((_, i) => i !== index);
    setConfig({ ...config, faqs: newFaqs });
  };

  const addFaq = () => {
    if (!config) return;
    const newFaqs = [...config.faqs, { question: "", answer: "" }];
    setConfig({ ...config, faqs: newFaqs });
  };

  const moveUp = (index: number) => {
    if (!config || index === 0) return;
    const newFaqs = [...config.faqs];
    [newFaqs[index - 1], newFaqs[index]] = [newFaqs[index], newFaqs[index - 1]];
    setConfig({ ...config, faqs: newFaqs });
  };

  const moveDown = (index: number) => {
    if (!config || index === config.faqs.length - 1) return;
    const newFaqs = [...config.faqs];
    [newFaqs[index + 1], newFaqs[index]] = [newFaqs[index], newFaqs[index + 1]];
    setConfig({ ...config, faqs: newFaqs });
  };


  if (loading) return <div className="p-8 text-white">Yükleniyor...</div>;

  return (
    <div className="p-6 md:p-10 text-white max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black">SSS (Sıkça Sorulan Sorular) Yönetimi</h1>
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
        <div className="space-y-6">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h2 className="text-xl font-bold mb-4 text-blue-400">Sayfa Başlığı ve Açıklaması</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-gray-400">Başlık (Örn: Sıkça Sorulan Sorular)</label>
                <input className="w-full bg-black border border-gray-700 rounded p-2" value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm mb-1 text-gray-400">Açıklama (Subtitle)</label>
                <textarea rows={2} className="w-full bg-black border border-gray-700 rounded p-2" value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} />
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center bg-gray-900 p-4 rounded-lg border border-gray-800">
             <h2 className="text-xl font-bold text-blue-400">Sorular ({config.faqs.length})</h2>
             <button onClick={addFaq} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold">
               + Yeni Soru Ekle
             </button>
          </div>

          <div className="space-y-4">
            {config.faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900 p-4 rounded-lg border border-gray-800 relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-300">Soru #{i + 1}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => moveUp(i)} disabled={i === 0} className="px-2 py-1 bg-gray-700 disabled:opacity-30 rounded text-xs">Yukarı</button>
                    <button onClick={() => moveDown(i)} disabled={i === config.faqs.length - 1} className="px-2 py-1 bg-gray-700 disabled:opacity-30 rounded text-xs">Aşağı</button>
                    <button onClick={() => removeFaq(i)} className="px-2 py-1 bg-red-600/50 hover:bg-red-600 text-white rounded text-xs ml-2">Sil</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm mb-1 text-gray-400">Soru Başlığı</label>
                    <input className="w-full bg-black border border-gray-700 rounded p-2" value={faq.question} onChange={(e) => updateFaq(i, "question", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 text-gray-400">Cevap (Paragraflar \\n\\n ile ayrılabilir)</label>
                    <textarea rows={4} className="w-full bg-black border border-gray-700 rounded p-2" value={faq.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 sticky bottom-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-500 shadow-xl shadow-green-900/50 text-white font-bold py-3 px-8 rounded-full disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Tüm Değişiklikleri Kaydet"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

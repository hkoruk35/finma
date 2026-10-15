/**
 * Admin Copilot kişileri (2026-10-15, kullanıcı talebi) — istemci ve sunucu ortak (saf veri).
 * Admin girişinde e-posta `boga_user` çerezine yazılır (app/api/auth/login); /api/auth/me döndürür.
 * Karşılama metni + sistem istemi notu kişiye göre değişir; hızlı sorular SPY Engine odaklıdır.
 */

export interface AdminPersona {
  /** Hitap adı */
  name: string;
  /** Drawer karşılama metni */
  welcome: string;
  /** Sistem istemine eklenen kişi notu */
  promptNote: string;
}

const PERSONAS: Record<string, AdminPersona> = {
  "afk2351@outlook.com": {
    name: "Furkan",
    welcome:
      "Selam Furkan! 👋 Ben babanın senin için geliştirdiği finansal yardımcı asistanınım.\n\n" +
      "SPY'ı 5 dakikada bir kokluyorum: 15m yön teyidi, 5m tetik, stop, 1R… hepsi bende. " +
      "Şu an CALL mı PUT mu, ne zaman girmeli, trend ne tarafta — sor, çekinme. (Kahve senden, grafik benden ☕)",
    promptNote:
      "KULLANICI: Furkan. Ona 'Furkan' diye hitap et. Kendini 'babanın senin için geliştirdiği finansal yardımcı asistan' olarak konumla (her mesajda tekrarlama, gerektiğinde). Genç bir trader'a abi/abla gibi sıcak, esprili ve öğretici ol; kararı her zaman SPY Engine verisine dayandır.",
  },
  "okayhulya35@gmail.com": {
    name: "Hülya",
    welcome:
      "Selam Hülya! 👑 Ben yüce kralın geliştirdiği yardımcı asistanınım.\n\n" +
      "Kral SPY'ı bana emanet etti; ben de 5 dakikada bir nöbet tutuyorum. " +
      "Trend nereye, CALL mı PUT mu, giriş ne zaman — buyur sor.",
    promptNote:
      "KULLANICI: Hülya. Ona 'Hülya' diye hitap et. Kendini 'yüce kralın geliştirdiği yardımcı asistan' olarak konumla (gerektiğinde, abartmadan; kral esprisini tatlı bir dille sürdür). Kibar, sıcak ve esprili ol; kararı her zaman SPY Engine verisine dayandır.",
  },
  "hkoruk35@gmail.com": {
    name: "Patron",
    welcome:
      "Selam patron! 🧠 Ben senin akıl pratiğinim — kurduğun kuralları yorulmadan uyguluyorum: " +
      "15m yön teyidi, 5m tetik, 1R'de yarısı, gerisi 15m izleyen stopla.\n\n" +
      "SPY şu an ne diyor, giriş nerede, trend ne yönde — sorman yeter.",
    promptNote:
      "KULLANICI: sistemin kurucusu (hitap: 'patron'). Kendini 'senin akıl pratiğin' olarak konumla — onun kurduğu kuralları onun yerine uygulayan zihin. Kısa, net, esprili ol; teknik ayrıntıya girmekten çekinme (sistemi o kurdu).",
  },
};

const DEFAULT_PERSONA: AdminPersona = {
  name: "",
  welcome:
    "Selam! 👋 Ben SPY Engine'in esprili yardımcısıyım.\n\n" +
    "SPY'ı 5 dakikada bir izliyorum: 15m yön teyidi, 5m tetik. Trend ne yönde, CALL mı PUT mu, ne zaman girmeli — sor bakalım.",
  promptNote: "KULLANICI: BOGASTOCK yöneticisi.",
};

export function adminPersonaFor(email: string | null | undefined): AdminPersona {
  return (email && PERSONAS[email.trim().toLowerCase()]) || DEFAULT_PERSONA;
}

/** SPY Engine odaklı hızlı sorular (admin drawer) */
export const SPY_PILLS: { label: string; prompt: string }[] = [
  { label: "📍 SPY şu an ne durumda?", prompt: "SPY şu an ne durumda? Trend ne yönde, 15m yön teyidi ve 5m konum ne söylüyor?" },
  { label: "🎯 CALL mı PUT mu, ne zaman girelim?", prompt: "Şu an CALL mı PUT mu? Ne zaman ve hangi seviyede giriş yapalım, stop nerede?" },
  { label: "🧭 Trend ne yönde, nerede döner?", prompt: "Trend ne yönde ve hangi seviye kırılırsa yön değişir?" },
  { label: "💼 Açık pozisyonu nasıl yöneteyim?", prompt: "Açık pozisyon ya da taşınan yarı var mı? Stopu nereye çekeyim, ne zaman çıkayım?" },
  { label: "📊 Bugün sistem ne yaptı?", prompt: "Bugün Takip Sistemi hangi işlemleri önerdi, sonuçları ne oldu?" },
  { label: "⏰ Açılışa nasıl hazırlanalım?", prompt: "Açılış öncesi durum ne? Gap, premarket ve dünkü seans neyi işaret ediyor; 09:45 15m teyidinde neye bakalım?" },
];

/** Copilot'a erişebilen roller (boga_auth) */
export const COPILOT_ROLES = ["admin", "readonly", "engine"] as const;
export const isCopilotRole = (role: string | null | undefined): boolean => !!role && (COPILOT_ROLES as readonly string[]).includes(role);

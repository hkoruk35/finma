// Dil bazlı önerilen asistan ismi + 5 eğlenceli avatar seçeneği.
// Hem sunucu (system prompt) hem istemci (ayarlar paneli) tarafından kullanılır.

export const SUGGESTED_NAMES: Record<string, string> = {
  tr: "Aylin",
  en: "Olivia",
  es: "Sofía",
  fr: "Sophie",
  pt: "Lorena",
  id: "Putri",
};

export function getSuggestedName(locale: string): string {
  return SUGGESTED_NAMES[locale] || SUGGESTED_NAMES.en;
}

export interface AvatarOption {
  id: string;
  emoji: string;
  gradient: string; // tailwind gradient classes
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "aylin", emoji: "🦊", gradient: "from-orange-400 to-pink-500" },
  { id: "nova", emoji: "🦉", gradient: "from-indigo-400 to-purple-600" },
  { id: "maya", emoji: "🐬", gradient: "from-cyan-400 to-blue-600" },
  { id: "atlas", emoji: "🦄", gradient: "from-fuchsia-400 to-violet-600" },
  { id: "luna", emoji: "🐝", gradient: "from-yellow-400 to-amber-600" },
];

export function getAvatar(avatarId: string): AvatarOption {
  return AVATAR_OPTIONS.find((a) => a.id === avatarId) || AVATAR_OPTIONS[0];
}

export const LOCALE_NAMES: Record<string, string> = {
  tr: "Türkçe",
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  id: "Bahasa Indonesia",
};

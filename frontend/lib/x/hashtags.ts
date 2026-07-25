function toHashtag(text: string): string {
  return "#" + text.replace(/[^a-zA-Z0-9]+/g, "");
}

// Hisse postlari icin hashtag seti — en fazla 3 etiket: hisse ($cashtag),
// sektor, trend yonu. AI'nin uretmesine guvenmek yerine sabit/dogru sekilde
// ekleniyor. Sektor veya trend eksikse o etiket sessizce atlanir.
export function buildStockHashtags(ticker: string, sector?: string | null, trend?: string | null): string {
  const parts = [`$${ticker}`];
  if (sector) parts.push(toHashtag(sector));
  if (trend) parts.push(toHashtag(trend));
  return parts.join(" ");
}

export function buildPromoHashtags(): string {
  return "#Stocks #NASDAQ #Investing";
}

const MARKET_ASSET_CATEGORY_TAGS: Record<string, string> = {
  sector: "#Sectors",
  index: "#Markets",
  commodity: "#Commodities",
  fx: "#Forex",
  crypto: "#Crypto",
};

// Sektör/endeks/emtia/döviz/kripto gönderileri için — "^" veya "=" içeren
// ticker'lar (^GSPC, EURUSD gibi görünse de Yahoo sembolü değil bizim
// kısa kodumuz) geçerli bir cashtag olmadığından sadece etiket adına göre
// hashtag üretilir; temiz alfanumerik ticker'lar (XLK, BTCUSD gibi) için
// ayrıca $cashtag eklenir.
export function buildMarketAssetHashtags(ticker: string, label: string, category?: string | null): string {
  const parts: string[] = [];
  if (/^[A-Z0-9]+$/.test(ticker)) parts.push(`$${ticker}`);
  parts.push(toHashtag(label));
  if (category && MARKET_ASSET_CATEGORY_TAGS[category]) parts.push(MARKET_ASSET_CATEGORY_TAGS[category]);
  return parts.join(" ");
}

// Metni hashtag'lerle birlikte X'in 280 karakter siniri icine sigdirir;
// gerekirse ana metni kisaltir, hashtag'leri her zaman korur.
export function appendHashtagsWithinLimit(text: string, hashtags: string, limit = 280): string {
  const suffix = ` ${hashtags}`;
  const maxBodyLen = limit - suffix.length;
  const body = text.length > maxBodyLen ? text.slice(0, Math.max(0, maxBodyLen - 1)).trimEnd() + "…" : text;
  return `${body}${suffix}`;
}

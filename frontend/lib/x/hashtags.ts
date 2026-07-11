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

// Metni hashtag'lerle birlikte X'in 280 karakter siniri icine sigdirir;
// gerekirse ana metni kisaltir, hashtag'leri her zaman korur.
export function appendHashtagsWithinLimit(text: string, hashtags: string, limit = 280): string {
  const suffix = ` ${hashtags}`;
  const maxBodyLen = limit - suffix.length;
  const body = text.length > maxBodyLen ? text.slice(0, Math.max(0, maxBodyLen - 1)).trimEnd() + "…" : text;
  return `${body}${suffix}`;
}

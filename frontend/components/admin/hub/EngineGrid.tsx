/** Motor kartları: canlı fiyat + motor sayfası bağlantısı (kayıt: lib/spyengine/engines.ts). */

import { ENGINES, type EngineSymbol } from "@/lib/spyengine/engines";
import HubQuotes from "./HubQuotes";

export default function EngineGrid({ symbols, compact }: { symbols: EngineSymbol[]; compact?: boolean }) {
  return (
    <HubQuotes
      compact={compact}
      items={symbols.map((s) => ({ symbol: s, name: ENGINES[s].name, href: ENGINES[s].page, note: `${ENGINES[s].name} · Engine` }))}
    />
  );
}

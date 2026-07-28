# Product Rules

**Status: skeleton.** Full backfill is `tasks/active/007-product-rules-doc-backfill.md` — it needs the user's own domain confirmation on which strategy rules below are current vs. superseded before being written up in full. Source material: `docs/reference/tracker_strategy.md`, `docs/reference/ichimoku_analiz_rehberi.md`, `docs/reference/DERIN_HISSE_ANALIZ_SABLONU.md`.

## Rules confirmed directly from live code (safe to treat as current)

- **Swing "ALIM" (buy) signal**: only a pick with `entry_status == "ENTERED"` in `swing_all_picks.json` counts as an executed buy signal. Anything else ("Bekle") is still waiting on 15-minute confirmation — never present a non-ENTERED pick as a completed buy. See `docs/DATA_CONTRACTS.md`.
- **Trade plan targets**: single engine (`frontend/lib/tradePlanEngine.ts`) produces entry range + TP1/TP2/TP3 (+5%/+10%/+15% ladder from average entry) for every surface (graphic page, Copilot, admin) — see `docs/AI_BEHAVIOR.md` Rule 1.
- **Tracker page model** (`docs/reference/tracker_strategy.md`): 2-layer approach — 1W/1D trend filter decides watchlist membership (manual/weekly), 1H data both monitors and decides entry (hourly, 09:15–16:15 NY). 15-minute bars are explicitly not used for this page (too noisy, mismatched with swing/options holding periods).
- **Theme pool membership** (BOGA_SCORE / pool labels): "Trend Listesi" requires `entry_status==ENTERED`; "Trend Adayı" is anything else present in the swing or watchlist pick files. See `docs/DATA_CONTRACTS.md`.

## Not yet backfilled (do not guess — trace code or ask the user)

- Full BOGA Score component weighting philosophy (trend/momentum/liquidity split, risk profile bands)
- Options premium-harvesting rules (source: `docs/reference/DERIN_HISSE_ANALIZ_SABLONU.md`, needs code cross-check against `options_pnl_tracker.py`/`opsiyon242.py`)
- Ichimoku usage rules where actually wired into a live signal (vs. the reference doc's general theory)

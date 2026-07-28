# BogaSmart Platform - Critical Rules

## General AI Assistant with Finance Module

BogaSmart is a **general-purpose AI assistant** (ChatGPT/Gemini-like) with optional financial markets module.

---

## Data Source Rules

### 1. General Queries (QUERY & PERSONAL Cards)
- **Source**: General knowledge (web, news, current events)
- **Finance Forbidden**: Do NOT discuss stocks, markets, or financial data
- **Example**: "What's important today?" → World news, NO stocks

### 2. Finance/Markets Queries (FINANCE Card)
- **Source**: Copilot + System shared data sources
- **When**: Only when user explicitly asks about markets/stocks/finance
- **Data**: Use combined Copilot & system market intelligence

### 3. Ticker Analysis (Specific Stock Query)
- **Rule**: 100% site data priority
- **API Fallback**: Only if site data insufficient
- **Analysis**: Use site's technical indicators, performance history, watchlists
- **No External APIs**: Prefer internal database

---

## Trade Plan (İşlem Kurgusu) Rules

### Access Control
- **TOP7 Stocks** (AAPL, NVDA, MSFT, GOOGL, AMZN, TSLA, META): Public access
- **All Other Stocks**: Premium-only redirect
- **Reason**: Trade plans are premium content

### Example
```
User asks: "AAPL için işlem kurgusu yap"
→ Show public trade plan

User asks: "DELL için işlem kurgusu yap"  
→ Redirect: "This is premium content. Upgrade to access."
```

---

## Chart Access Rules

### All Charts: Public (Herkese Açık)
- Price charts: PUBLIC
- Technical analysis charts: PUBLIC
- Performance charts: PUBLIC
- Sector charts: PUBLIC
- **No paywall on any chart**

---

## API Integration

### Search/Ask Endpoint (`/api/ask`)

#### Query Classification
```
if query is about GENERAL topics (science, tech, news, culture):
  → General knowledge AI (ignore market data)
  
if query is about FINANCE/MARKETS/STOCKS:
  → Use financial expertise + market data
  
if ticker symbol provided:
  → Use site database first
  → Query Copilot for context
  → Format as [TICKER](/ai?ticker=TICKER) links
```

#### System Prompt Rules
- Never force financial angles on general queries
- Only discuss markets when explicitly asked
- For ticker analysis: Prefer site data over external sources
- Trade plans: Check if ticker is TOP7 before showing

---

## Implementation Checklist

- [x] Frontend: General knowledge prompts for QUERY/PERSONAL
- [x] API: System prompt - general AI, finance on demand
- [x] Placeholders: General ("Ask anything...")
- [x] Mobile nav: Hidden on search page
- [ ] Ticker routing: Premium redirect for non-TOP7 trade plans
- [ ] Chart access: Verify all public
- [ ] Data sources: Copilot integration for markets
- [ ] Site data priority: Ticker analysis

---

## Examples

### ✅ Correct

**QUERY Card**: "Bugün dünyada en önemli haber?"
→ Breaking news, tech developments, politics, science... NO STOCKS

**PERSONAL Card**: "Benim ilgi alanlarımda neler var?"
→ User interests, hobbies, technology news... NO STOCKS

**FINANCE Card**: "Piyasada hangi hisseler öne çıkıyor?"
→ Stock market analysis using Copilot + system data

**Ticker**: User clicks AAPL link
→ Site technical analysis + performance + watchlist data

**Trade Plan**: User asks for NVDA işlem kurgusu
→ Show trade plan (TOP7 public)

**Trade Plan**: User asks for DELL işlem kurgusu
→ "Premium content - upgrade to access"

### ❌ Wrong

**QUERY Card** answering: "ABD borsasında NVIDIA yükselen hisse"
→ WRONG - Should be general, no stocks

**FINANCE Card** ignoring market data
→ WRONG - Should use Copilot + system data

**Ticker analysis** using external API
→ WRONG - Site data first

---

## Version
- **Updated**: 2026-07-28
- **Status**: Active - All rules mandatory

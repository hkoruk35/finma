# FinMA Terminal Deployment - Verification Checklist

**Deployment Triggered:** 2026-05-25 11:15 UTC  
**Commit:** 4e3a0cd9 (fix: rebuild with resolved anthropic-ai/sdk dependency)  
**Expected Status:** Live on https://finma-production.vercel.app

## Pre-Deployment Verification ✅
- [x] VXX → VIX change implemented (line 40 in TerminalClient.tsx)
- [x] Left panel tabs created: Market / 525CSP / 2550CSP / 50250CSP
- [x] Custom watchlist localStorage persistence configured
- [x] Watchlist item limit increased from 30 to 100
- [x] WatchlistRow component integrated for price/change display and remove buttons
- [x] SETUP SCREENER button removed
- [x] Package dependencies fixed (@anthropic-ai/sdk added to package-lock.json)
- [x] Deployment commit pushed to main branch

## Post-Deployment Verification Tasks

### 1. Terminal Page Layout
- [ ] Terminal page loads without errors
- [ ] Left panel shows tabs: **Market** | **525CSP** | **2550CSP** | **50250CSP**
- [ ] All four tabs are clickable and switch content properly
- [ ] Each tab shows the correct watchlist items

### 2. VIX Display (Volatility Index)
- [ ] "Volatility Index" (VIX) appears in the Markets section instead of "Volatility VXX"
- [ ] VIX chart loads correctly when clicked
- [ ] VIX price updates in real-time

### 3. Custom Watchlist Features (525CSP, 2550CSP, 50250CSP)
For **each custom watchlist tab**, verify:
- [ ] Can add ticker to watchlist via input field + Enter key
- [ ] Ticker displays with **price** (updates in real-time)
- [ ] Ticker displays with **percentage change** (color-coded: green for +, red for -)
- [ ] **Stock detail link** (↗) visible next to ticker name
- [ ] Clicking stock link navigates to `/stock/[ticker]` page
- [ ] **Remove button** removes ticker from watchlist
- [ ] Watchlist persists after page refresh (localStorage working)
- [ ] Can add up to **100 tickers** per watchlist
- [ ] Cannot add duplicate tickers
- [ ] Cannot add if limit (100) is reached

### 4. Right Panel Watchlist (Existing)
- [ ] Right panel watchlist still displays all features (price, change %, remove button)
- [ ] No regression in functionality
- [ ] Can still add tickers to right panel watchlist
- [ ] Right panel data persists correctly

### 5. Panel Toggle Functionality
- [ ] Left panel can be toggled (collapse/expand)
- [ ] Right panel can be toggled (collapse/expand)
- [ ] Toggle state persists appropriately

### 6. Data Consistency
- [ ] Add a ticker to 525CSP custom watchlist
- [ ] Add the same ticker to 2550CSP custom watchlist
- [ ] Prices and change percentages display correctly in both tabs
- [ ] Remove ticker from 525CSP doesn't affect 2550CSP list
- [ ] Watchlist data doesn't cross-contaminate between tabs

### 7. Stock Pages
- [ ] Clicking on stock link from terminal takes you to `/stock/[ticker]` page
- [ ] Stock detail page displays stock info (not a redirect to /ai page)
- [ ] Can return to terminal page from stock detail page

### 8. SETUP SCREENER Button
- [ ] SETUP SCREENER button is **not visible** in the left panel

## If Issues Found

1. **Deployment not live yet**
   - Check GitHub Actions status: https://github.com/hkoruk35/finma/actions
   - Check Vercel deployment: https://vercel.com/dashboard

2. **Build failures**
   - Most likely: Still missing @anthropic-ai/sdk in GitHub Actions environment
   - Solution: May need to manually re-run workflow in GitHub Actions

3. **Runtime errors**
   - Check browser console for JavaScript errors
   - Check Network tab for failed API calls
   - Check localStorage for corruption

4. **Styling issues**
   - Verify CSS classes haven't changed
   - Check if Tailwind CSS is loading properly

## Success Criteria
✅ All items in sections 1-8 pass verification
✅ No console errors or warnings related to watchlists
✅ Deployment is live and stable for 10+ minutes
✅ Watchlist persistence works across browser sessions

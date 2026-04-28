# Vercel Setup for Hourly Bot - OPTION B

## 🚀 Quick Setup (3 steps)

### Step 1: Add Environment Variable to Vercel
Go to: **https://vercel.com/dashboard/finma/settings/environment-variables**

Click **"Add New Environment Variable"**
- **Name:** `REVALIDATE_SECRET`
- **Value:** `f2738aa8af25269673139980101e1689c02d4277f052f537defc86f6850076da`
- **Environments:** Select all (Production, Preview, Development)
- Click **"Save"**

### Step 2: Redeploy
Click **"Deployments"** → Latest deployment → **"Redeploy"**

Wait for build to complete (should take ~4 minutes)

### Step 3: Test
SSH to server and run:
```bash
cd /path/to/finma
REVALIDATE_SECRET=f2738aa8af25269673139980101e1689c02d4277f052f537defc86f6850076da python inday313.py --force
```

Check logs for:
```
✅ Revalidate /hourly
✅ Revalidate /smart-tracker
```

## How It Works

**BEFORE (Old way - 4-10 min):**
```
inday313.py writes files
  ↓
git commit + git push
  ↓
GitHub webhook triggers Vercel
  ↓
Vercel rebuilds entire project
  ↓
Deployment takes 4-10 minutes
```

**AFTER (New way - instant):**
```
inday313.py writes files (local only)
  ↓
inday313.py calls: /api/revalidate?tag=hourly&secret=REVALIDATE_SECRET
  ↓
Vercel invalidates page cache instantly
  ↓
Next request to /hourly serves fresh data
  ↓
No git push, no rebuild, no deploy time
```

## Files Changed

- ✅ `frontend/app/api/revalidate/route.ts` — New endpoint
- ✅ `frontend/app/hourly/page.tsx` — Set `revalidate: false`
- ✅ `frontend/app/smart-tracker/page.tsx` — Set `revalidate: false`
- ✅ `inday313.py` — Calls `/api/revalidate` instead of git push
- ✅ `frontend/.env.local` — Local secret (dev only)

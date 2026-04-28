# Vercel Setup for Hourly Bot

## Environment Variable Configuration

Go to **Vercel Dashboard** → **Project: finma** → **Settings** → **Environment Variables**

Add this variable:

```
REVALIDATE_SECRET = [generate-a-random-string]
```

Example (generate your own):
```
REVALIDATE_SECRET = sk_live_xyz123abc456def789ghi...
```

**Steps:**
1. Open https://vercel.com/dashboard/finma/settings/environment-variables
2. Click "Add New" 
3. Name: `REVALIDATE_SECRET`
4. Value: Generate a random string (e.g., `openssl rand -hex 32` output)
5. Click "Save"
6. Redeploy project (or wait for next git push to trigger build)

## How It Works

- **Before (4-10 min deploy time):**
  - inday313.py writes files → git commit → git push → Vercel pulls → full rebuild

- **After (instant updates):**
  - inday313.py writes files (local only)
  - inday313.py calls `/api/revalidate?tag=hourly&secret=REVALIDATE_SECRET`
  - Vercel invalidates /hourly cache instantly
  - No git push, no rebuild

## Testing

Once deployed, edit `inday313.py` line ~2090 and change:
```python
secret = os.getenv("REVALIDATE_SECRET", "")
```
to see the revalidate call in logs.

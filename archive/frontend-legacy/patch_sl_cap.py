import os, re

base_dir = r"C:\Users\afksm\finma\frontend\app\global"
langs = ["tr", "en", "es", "fr", "pt"]

for lang in langs:
    # 1. Update home/page.tsx
    home_file = os.path.join(base_dir, lang, "home", "page.tsx")
    if os.path.exists(home_file):
        with open(home_file, "r", encoding="utf-8") as f:
            content = f.read()
        
        content = re.sub(r"const SL_CAP\s*=\s*-\d+;", "const SL_CAP = -10;", content)
        content = re.sub(r"-%7 SL cap", "-%10 SL cap", content)
        
        with open(home_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {lang}/home/page.tsx")
        
    # 2. Update performance/page.tsx
    perf_file = os.path.join(base_dir, lang, "performance", "page.tsx")
    if os.path.exists(perf_file):
        with open(perf_file, "r", encoding="utf-8") as f:
            content = f.read()
            
        if "applySlPct=" in content:
            content = re.sub(r"applySlPct=\{-\d+\}", "applySlPct={-10}", content)
        else:
            content = re.sub(r"(<SwingPerformanceDashboard[^>]+)(>)", r"\1 applySlPct={-10}\2", content)
            
        with open(perf_file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {lang}/performance/page.tsx")


import os, re

base_dir = r"C:\Users\afksm\finma\frontend\app\global"
langs = ["tr", "en", "es", "fr", "pt"]
pages = ["swing", "watchlist", "top7", "top100", "my-watchlist"]

for lang in langs:
    for page in pages:
        filepath = os.path.join(base_dir, lang, page, "page.tsx")
        if not os.path.exists(filepath):
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        if "ListsNavigation" in content:
            continue
            
        # Add import
        import_stmt = "import ListsNavigation from \"@/components/global/ListsNavigation\";\n"
        content = re.sub(r"(import Link from \"next/link\";\n)", r"\1" + import_stmt, content)
        
        # Replace the nav block
        # Look for <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide"> ... </div>
        # And replace with <ListsNavigation locale="{lang}" activePath="{page}" />
        
        pattern = re.compile(r"<div className=\"flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide\">.*?</div>", re.DOTALL)
        replacement = f"<ListsNavigation locale=\"{lang}\" activePath=\"{page}\" />"
        
        content, count = pattern.subn(replacement, content)
        if count > 0:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Patched {lang}/{page}/page.tsx")
        else:
            print(f"Could not find nav block in {lang}/{page}/page.tsx")


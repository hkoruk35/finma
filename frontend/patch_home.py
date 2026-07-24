import os, re

base_dir = r"C:\Users\afksm\finma\frontend\app\global"
langs = ["tr", "en", "es", "fr", "pt"]

for lang in langs:
    filepath = os.path.join(base_dir, lang, "home", "page.tsx")
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    if "ListsNavigation" in content:
        print(f"Already patched {lang}/home/page.tsx")
        continue
        
    # Add import
    import_stmt = "import ListsNavigation from \"@/components/global/ListsNavigation\";\n"
    content = re.sub(r"(import Link from \"next/link\";\n)", r"\1" + import_stmt, content)
    
    # Add <ListsNavigation locale="{lang}" activePath="home" /> below <main ...>
    main_tag_pattern = re.compile(r"(<main className=\"[^\"]+\">)", re.DOTALL)
    replacement = f"\\1\n        <div className=\"-mb-2\">\n          <ListsNavigation locale=\"{lang}\" activePath=\"home\" />\n        </div>"
    
    content, count = main_tag_pattern.subn(replacement, content)
    if count > 0:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Patched {lang}/home/page.tsx")
    else:
        print(f"Could not find <main> in {lang}/home/page.tsx")


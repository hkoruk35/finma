import os

def scrub_code(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith((".tsx", ".ts", ".py", ".css", ".md")):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    changed = False
                    
                    # 1. Replace FinMA (case insensitive-ish for common patterns)
                    if "FinMA" in content:
                        content = content.replace("FinMA", "BOGA AI")
                        changed = True
                    if "finma" in content and "finmawave.png" not in content and "finma_universe" not in content and "finmaicon" not in content:
                        # Avoid replacing filenames or database tables
                        content = content.replace("finma", "boga_ai")
                        changed = True
                    
                    # 2. Replace standalone BOGA with BOGA AI
                    # We look for "BOGA" not followed by " AI"
                    import re
                    # Match BOGA but not BOGA AI. Avoid BOGASTOCK urls.
                    new_content = re.sub(r'\bBOGA\b(?!\s+AI)', 'BOGA AI', content)
                    if new_content != content:
                        content = new_content
                        changed = True

                    if changed:
                        print(f"Scrubbing code in {path}...")
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(content)
                except Exception as e:
                    print(f"Error scrubbing code in {path}: {e}")

if __name__ == "__main__":
    scrub_code("frontend")
    scrub_code("transfer/latest")
    # Also scrub root py files
    for f in os.listdir("."):
        if f.endswith(".py"):
            scrub_code(".")
            break

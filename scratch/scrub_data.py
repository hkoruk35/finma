import os
import json

def scrub_branding(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".json"):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if "FinMA" in content:
                        print(f"Scrubbing {path}...")
                        new_content = content.replace("FinMA", "BOGA AI")
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                except Exception as e:
                    print(f"Error scrubbing {path}: {e}")

if __name__ == "__main__":
    # Scrub frontend public
    scrub_branding("frontend/public")
    # Scrub transfer latest
    scrub_branding("transfer/latest")
    # Scrub transfer archive (if small)
    scrub_branding("transfer/archive")

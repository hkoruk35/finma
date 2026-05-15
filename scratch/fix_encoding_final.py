import sys

def final_fix(filename):
    with open(filename, 'rb') as f:
        data = f.read()
    
    # We want to get back to the original bytes that were intended to be UTF-8.
    # If the file is currently UTF-8 but contains mangled characters like Ã¶,
    # it means the original UTF-8 bytes were interpreted as Latin-1 and then re-encoded as UTF-8.
    
    try:
        # Step 1: Decode the current (mangled) UTF-8 file
        text = data.decode('utf-8')
        # Step 2: Encode back to Latin-1 to get the original raw bytes
        raw_bytes = text.encode('latin-1')
        # Step 3: Decode those raw bytes as UTF-8
        clean_text = raw_bytes.decode('utf-8')
        print("Success: Reverted double-encoding.")
    except Exception as e:
        print(f"Direct revert failed: {e}")
        # Try a different path if it was already messed up
        try:
            clean_text = data.decode('utf-8').encode('cp1252').decode('utf-8')
            print("Success: Reverted double-encoding (CP1252).")
        except:
            clean_text = data.decode('utf-8', errors='replace')
            print("Fallback: Saved with replacement.")

    # Add the encoding declaration just to be safe for Python
    if not clean_text.startswith('# -*- coding: utf-8 -*-'):
        clean_text = '# -*- coding: utf-8 -*-\n' + clean_text

    with open(filename, 'w', encoding='utf-8', newline='') as f:
        f.write(clean_text)

if __name__ == "__main__":
    final_fix('swing117_boga.py')

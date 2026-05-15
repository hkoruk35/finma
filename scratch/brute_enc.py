import itertools

def brute_force_encoding(filename):
    with open(filename, 'rb') as f:
        original_data = f.read(1000)
    
    encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-9']
    
    for e1 in encodings:
        try:
            text = original_data.decode(e1)
            if "BOGA AI" in text and "YEN" in text:
                print(f"Candidate: decode({e1})")
                # Try one more level
                for e2 in encodings:
                    try:
                        text2 = text.encode(e2).decode('utf-8')
                        if "BOGA AI" in text2 and "YEN" in text2:
                             print(f"  Better: encode({e2}).decode('utf-8')")
                    except: pass
        except: pass

if __name__ == "__main__":
    brute_force_encoding('swing117_boga.py')

import sys

def undouble_encoding(filename):
    with open(filename, 'rb') as f:
        data = f.read()
    
    # Try decoding as utf-8 first
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        text = data.decode('latin-1')

    # Recursive undouble
    current = text
    for i in range(5): # Up to 5 levels
        try:
            # The pattern of mojibake: UTF-8 bytes were read as Latin-1 and then saved as UTF-8
            # To fix: encode as latin-1 to get original bytes, then decode as utf-8
            next_text = current.encode('latin-1').decode('utf-8')
            if next_text == current:
                break
            current = next_text
            print(f"Undoubled level {i+1}")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
    
    # Final check for Turkish characters that might be legacy Latin-1
    # \xf6 is 'ö' in Latin-1
    # If we still have some stray Latin-1 bytes, we might need to handle them.
    
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        f.write(current)

if __name__ == "__main__":
    undouble_encoding('swing117_boga.py')

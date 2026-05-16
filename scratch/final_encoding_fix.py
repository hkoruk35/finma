# -*- coding: utf-8 -*-
"""
FINAL ENCODING FIX — swing117_boga.py
The file has Windows-1252 mojibake: UTF-8 bytes were misread as Windows-1252
and stored back as UTF-8 text. This script reverses it properly.

Method: Read text, encode back to Windows-1252 bytes (reversing the damage),
then decode as UTF-8 (the original encoding). Only applied to detected broken ranges.
"""

import re
import sys

FILENAME = 'swing117_boga.py'

def fix_w1252_to_utf8(text: str) -> str:
    """
    Detect and fix Windows-1252 mojibake sequences in text.
    Broken chars: ð (0xF0), Ÿ (0x9F), â (0xE2), etc. — these are Latin/W1252 code points
    that represent bytes of a UTF-8 multibyte sequence.
    """
    result = []
    i = 0
    n = len(text)

    while i < n:
        # Try to match a mojibake sequence starting here
        # Strategy: take a window of 2-6 chars, try encoding as windows-1252,
        # then decode as utf-8. If it yields a single emoji/symbol, use it.
        fixed = False
        for window in (6, 5, 4, 3, 2):
            if i + window > n:
                continue
            chunk = text[i:i+window]
            try:
                raw_bytes = chunk.encode('windows-1252')
                # Must start with a multi-byte UTF-8 lead byte
                if raw_bytes[0] not in (0xC2, 0xC3, 0xE2, 0xE3, 0xF0):
                    break
                decoded = raw_bytes.decode('utf-8')
                # Confirm it decoded to fewer characters than the window (compression)
                if len(decoded) < len(chunk) and all(ord(c) > 127 for c in decoded):
                    result.append(decoded)
                    i += window
                    fixed = True
                    break
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue

        if not fixed:
            result.append(text[i])
            i += 1

    return ''.join(result)


def main():
    with open(FILENAME, 'r', encoding='utf-8') as f:
        original = f.read()

    fixed = fix_w1252_to_utf8(original)

    # Ensure utf-8 coding declaration at top
    if not fixed.lstrip().startswith('# -*- coding: utf-8 -*-'):
        if fixed.startswith('# -*- coding: utf-8 -*-\n'):
            pass  # already there
        else:
            fixed = '# -*- coding: utf-8 -*-\n' + fixed.lstrip('# -*- coding: utf-8 -*-\n')

    changed = sum(1 for a, b in zip(original, fixed) if a != b)
    print(f"Characters changed: {changed}")

    with open(FILENAME, 'w', encoding='utf-8', newline='\n') as f:
        f.write(fixed)

    # Verify — check a few known broken sequences are gone
    remaining = re.findall(r'[ðâ][ŸÃš][^\x00-\x7F\s]{0,3}', fixed)
    unique_remaining = sorted(set(remaining))
    if unique_remaining:
        print(f"WARNING: {len(unique_remaining)} pattern(s) may still need attention:")
        for p in unique_remaining[:10]:
            print(f"  {repr(p)}")
    else:
        print("✅ All mojibake sequences resolved!")

    print("Done.")

if __name__ == '__main__':
    main()

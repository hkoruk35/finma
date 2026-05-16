# -*- coding: utf-8 -*-
"""
DEFINITIVE v2 — Correct Windows-1252 mojibake fix for swing117_boga.py
"""

FILENAME = 'swing117_boga.py'

# Windows-1252 special byte -> Unicode codepoint mappings (0x80-0x9F range)
W1252_SPECIAL = {
    0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
    0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
    0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019,
    0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
    0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153,
    0x9E: 0x017E, 0x9F: 0x0178,
}
# Full map: byte -> Unicode codepoint
W1252_MAP = {b: W1252_SPECIAL.get(b, b) for b in range(0x100)}
# Reverse: Unicode codepoint -> original byte
REVERSE_W1252 = {v: k for k, v in W1252_MAP.items()}


def char_to_byte(ch):
    """Convert a char (that resulted from Windows-1252 decoding) back to original byte."""
    return REVERSE_W1252.get(ord(ch))


def try_fix_window(chars):
    """
    Try to interpret a sequence of chars as Windows-1252-encoded UTF-8 bytes.
    Returns decoded string if successful (and shorter than input), else None.
    """
    byte_list = []
    for ch in chars:
        b = char_to_byte(ch)
        if b is None:
            return None
        byte_list.append(b)
    raw = bytes(byte_list)
    try:
        decoded = raw.decode('utf-8')
        # Only accept if we compressed chars (multi-byte -> fewer chars)
        if len(decoded) < len(chars):
            return decoded
    except UnicodeDecodeError:
        pass
    return None


def fix_text(text):
    result = []
    i = 0
    n = len(text)

    while i < n:
        ch = text[i]
        # Only try to fix non-ASCII chars where original byte could be > 0x7F
        b = char_to_byte(ch)
        if b is not None and b > 0x7F:
            # Try windows from 6 down to 2
            fixed = False
            for window_size in (6, 5, 4, 3, 2):
                if i + window_size > n:
                    continue
                decoded = try_fix_window(text[i:i+window_size])
                if decoded is not None:
                    result.append(decoded)
                    i += window_size
                    fixed = True
                    break
            if not fixed:
                result.append(ch)
                i += 1
        else:
            result.append(ch)
            i += 1

    return ''.join(result)


def main():
    print(f"Reading {FILENAME}...")
    with open(FILENAME, 'r', encoding='utf-8') as f:
        original = f.read()

    fixed = fix_text(original)

    orig_len = len(original)
    fixed_len = len(fixed)
    print(f"Chars: {orig_len} -> {fixed_len} (reduced by {orig_len - fixed_len})")

    # Quick sanity check on key lines
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    for kw in ['BOGA Score', 'Signals:', 'ATMACA SWING V117', 'SİSTEM:']:
        idx = fixed.find(kw)
        if idx >= 4:
            print(f"  OK: ...{fixed[idx-4:idx+len(kw)+2]}...")

    # Write fixed file
    with open(FILENAME, 'w', encoding='utf-8', newline='\n') as f:
        f.write(fixed)
    print(f"\nWritten: {FILENAME}")

    # Check remaining broken patterns
    import re
    remaining = set(re.findall(r'[ðâÃ][ŸÃšŸ\x8f\x90][^\x00-\x7F\s]{0,3}', fixed))
    if remaining:
        print(f"⚠️  Still broken ({len(remaining)}): {sorted(remaining)[:8]}")
    else:
        print("✅ No mojibake patterns remaining!")


if __name__ == '__main__':
    main()

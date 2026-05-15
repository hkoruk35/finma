import sys

def restore_turkish(filename):
    with open(filename, 'rb') as f:
        data = f.read()
    
    # Try to decode as UTF-8 first
    try:
        text = data.decode('utf-8')
    except:
        text = data.decode('latin-1', errors='replace')

    # Common mojibake replacements for Turkish UTF-8 interpreted as ISO-8859-9/1
    # and then re-encoded or mangled.
    replacements = {
        'Ã°Å¸Â â€š': '🐂',
        'ðŸ ‚': '🐂',
        'Ã¢â‚¬â€': '—',
        'â€”': '—',
        'Ã„Â°': 'İ',
        'Ä°': 'İ',
        'Ã§': 'ç',
        'ÄŸ': 'ğ',
        'Ã¶': 'ö',
        'ÅŸ': 'ş',
        'Ä±': 'ı',
        'Ã‡': 'Ç',
        'Ãœ': 'Ü',
        'Ã–': 'Ö',
        'Ãž': 'Ş',
        'Ã ': 'İ',
        'Ã«': 'ë',
        'Ã®': 'î',
        'Ã¢': 'â',
        'Ãª': 'ê',
        'Ã¹': 'ù',
        'Ã': 'İ', # Dangerous but often true in this context
        'Ã°Å¸Â¦â€¦': '🦅',
        'ðŸ¦…': '🦅',
        'Ã°Å¸â€Â¥': '🔥',
        'ðŸ”¥': '🔥',
        'Ã°Å¸Å½Â¯': '🎯',
        'ðŸŽ¯': '🎯',
        'Ã°Å¸â€ºÂ¤': '🛰',
        'ðŸ¤': '🛰',
        'Ã°Å¸â€œÂŠ': '📊',
        'ðŸ“Š': '📊',
        'Ã°Å¸â€œÂˆ': '📈',
        'ðŸ“ˆ': '📈',
        'Ã°Å¸â€œÂ‹': '📋',
        'ðŸ“‹': '📋',
        'Ã°Å¸â€ºÂ¡': '🛡',
        'ðŸ¡': '🛡',
        'Ã°Å¸â€™Â§': '💧',
        'ðŸ’§': '💧',
        'Ã¢Å¡Â¡': '⚡',
        'âš¡': '⚡',
        'Ã¢Å¡â€œ': '⚖',
        'âš–': '⚖',
        'Ã°Å¸â€ŸÂ¢': '🟢',
        'ðŸŸ¢': '🟢',
        'Ã°Å¸â€Â´': '🔴',
        'ðŸ”´': '🔴',
        'Ã°Å¸Å’â€¦': '🌅',
        'ðŸŒ…': '🌅',
        'Ã°Å¸Å¡â‚¬': '🚀',
        'ðŸ🚀': '🚀',
        'Ã°Å¸â€”Â ': '🗺',
        'ðŸ— ': '🗺',
    }

    for mangled, clean in replacements.items():
        text = text.replace(mangled, clean)

    # Prepend the encoding declaration
    if not text.startswith('# -*- coding: utf-8 -*-'):
        text = '# -*- coding: utf-8 -*-\n' + text

    with open(filename, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print(f"Restored characters in {filename}")

if __name__ == "__main__":
    restore_turkish('swing117_boga.py')

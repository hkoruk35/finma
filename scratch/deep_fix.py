import sys

def deep_fix(filename):
    with open(filename, 'rb') as f:
        content = f.read()
    
    # Try multiple decoding/encoding passes to reverse common mojibake
    # Pattern: UTF-8 -> Latin-1 -> UTF-8
    try:
        text = content.decode('utf-8').encode('latin-1').decode('utf-8')
    except:
        text = content.decode('utf-8', errors='replace')

    # Hardcoded replacements for specific stubborn strings
    replacements = {
        'ðŸ ‚': '🐂',
        'ðŸ¦…': '🦅',
        'ðŸ”¥': '🔥',
        'ðŸŽ¯': '🎯',
        'ðŸ“Š': '📊',
        'ðŸ“ˆ': '📈',
        'ðŸ“‹': '📋',
        'ðŸŸ¢': '🟢',
        'ðŸ”´': '🔴',
        'ðŸŒ…': '🌅',
        'ðŸš€': '🚀',
        'â€”': '—',
        'â€“': '–',
        'â†’': '→',
        'â±': '⏱',
        'âœ…': '✅',
        'ðŸ †': '🏆',
        'ðŸ’Ž': '💎',
        'ðŸŸ¡': '🟡',
        'ðŸŸ ': '🟠',
        'ðŸ“‰': '📉',
        'ðŸ’ª': '💪',
        'ðŸŒŠ': '🌊',
        'ðŸ˜´': '😴',
        'ðŸ’°': '💰',
        'ðŸ“¥': '📥',
        'ðŸ“¤': '📤',
        'ðŸš¨': '🚨',
        'ðŸ” ': '🔍',
        'ðŸ—“': '📅',
        'ðŸ’€': '💀',
        'ðŸ“Œ': '📌',
        'âš™ï¸ ': '⚙️',
        'âš¡': '⚡',
        'âš–ï¸ ': '⚖️',
        'âœ‚ï¸ ': '✂️',
        'â ³': '⏳',
        'â Œ': '❌',
        'âš ï¸ ': '⚠️',
        'âž¡ï¸ ': '➡️',
        'â „ï¸ ': '❄️',
        'â–²': '▲',
        'â–¼': '▼',
        'ðŸ—œï¸ ': '🌌',
        'Yİ¼kseliş': 'Yükseliş',
        'iÃ§in': 'için',
        'kaynaÄŸÄ±': 'kaynağı',
        'kA±saltma': 'kısaltma',
        'sektÃ¶r': 'sektör',
        'giriÅŸ': 'giriş',
        'aÄŸÄ±rlÄ±ÄŸÄ±': 'ağırlığı',
        'gÃ¼n': 'gün',
        'altyapÄ±sÄ±': 'altyapısı',
        'İ¼': 'ü',
        'Ä°': 'İ',
        'Â·': '·',
        'â”€': '─',
        'â” ': '┏',
        'â”³': '┳',
        'â” ': '┓',
        'â”£': '┣',
        'â”«': '╋',
        'â”«': '┫',
        'â”—': '┗',
        'â”»': '┻',
        'â”›': '┛',
    }

    for k, v in replacements.items():
        text = text.replace(k, v)

    # Prepend the encoding declaration
    if not text.startswith('# -*- coding: utf-8 -*-'):
        text = '# -*- coding: utf-8 -*-\n' + text

    with open(filename, 'w', encoding='utf-8', newline='') as f:
        f.write(text)
    print(f"Deep fix completed for {filename}")

if __name__ == "__main__":
    deep_fix('swing117_boga.py')

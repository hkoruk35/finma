import os

file_path = r'c:\Users\afksm\finma\swing114_boga.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Turkish characters in print statements
content = content.replace('başlatıldı', 'baslatildi')
content = content.replace('tamamlandı', 'tamamlandi')
content = content.replace('henüz', 'henuz')
content = content.replace('bekleniyor', 'bekleniyor')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed v114 encoding issues (Turkish chars).")

import os

file_path = r'c:\Users\afksm\finma\swing114_boga.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace emoji with text
content = content.replace('🚀', '[START]')
content = content.replace('✅', '[OK]')
content = content.replace('💡', '[INFO]')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed v114 encoding issues.")

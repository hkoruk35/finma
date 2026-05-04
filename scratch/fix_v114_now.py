import os

file_path = r'c:\Users\afksm\finma\swing114_boga.py'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'if now_ny < target_ny:' in line:
        new_lines.append(line.replace('if now_ny < target_ny:', 'if now_ny < target_ny and "--now" not in sys.argv:'))
    else:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed v114 with --now support.")

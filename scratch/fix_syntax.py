import os

file_path = r'c:\Users\afksm\finma\opsiyon218v7.py'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Filter out the double/corrupted main block if needed, 
# but for now let's just fix the syntax error at the end.
# The last 2 lines are:
#     except Exception as e:
#         print(f"Kritik hata: {e}")

if lines[-2].strip() == "except Exception as e:" and lines[-2].startswith("    except"):
    lines[-2] = "        except Exception as e:\n"
    lines[-1] = "            print(f'Kritik hata: {e}')\n"

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Fixed.")

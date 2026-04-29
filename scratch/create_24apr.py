import json
import os

input_file = "data/2026-04-25/options_picks.json"
output_file = "data/2026-04-24/options_picks.json"

if not os.path.exists(os.path.dirname(output_file)):
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

with open(input_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# Update root fields
data["date"] = "2026-04-24"
data["timestamp"] = data["timestamp"].replace("2026-04-25", "2026-04-24")

# Update each pick
for pick in data.get("picks", []):
    pick["date"] = "2026-04-24"

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Successfully created {output_file}")

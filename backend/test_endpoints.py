"""Test backend endpoints after Supabase integration."""
import urllib.request
import urllib.error
import json

BASE = "http://localhost:8000"

def post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=body,
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

def get(path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{BASE}{path}", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

print("=== 1. Health ===")
data, status = get("/health")
print(f"Status: {status} | {data}")

print("\n=== 2. Register ===")
data, status = post("/api/auth/register", {
    "username": "testuser123",
    "email": "test123@finma.com",
    "password": "Test123!",
    "full_name": "Test User"
})
print(f"Status: {status} | {data}")

print("\n=== 3. Login ===")
data, status = post("/api/auth/login", {
    "username": "testuser123",
    "password": "Test123!"
})
print(f"Status: {status}")
token = data.get("access_token")
if token:
    print(f"Token: {token[:30]}...")
else:
    print(f"Error: {data}")

print("\n=== 4. Me (auth check) ===")
if token:
    data, status = get("/api/auth/me", token=token)
    print(f"Status: {status} | {data}")

print("\n=== 5. Portfolio Summary ===")
if token:
    data, status = get("/api/portfolio/summary", token=token)
    print(f"Status: {status} | {json.dumps(data)[:100]}")

print("\n=== 6. Trades List ===")
if token:
    data, status = get("/api/portfolio/trades", token=token)
    print(f"Status: {status} | {json.dumps(data)[:100]}")

print("\n=== 7. Signals Latest ===")
data, status = get("/api/signals/latest")
print(f"Status: {status} | keys={list(data.keys()) if isinstance(data, dict) else 'list'}")

print("\nDone.")

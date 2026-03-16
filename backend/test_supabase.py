"""Test Supabase connection and backend startup."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Load .env
from dotenv import load_dotenv
load_dotenv()

print("=== Environment Check ===")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL', 'NOT SET')[:40]}...")
print(f"SUPABASE_KEY: {os.getenv('SUPABASE_KEY', 'NOT SET')[:30]}...")

print("\n=== Database Module ===")
try:
    from app.database import get_supabase, is_db_available, UsersDB, TradesDB
    client = get_supabase()
    print(f"Supabase client: {'OK' if client else 'None (fallback mode)'}")
    print(f"DB available: {is_db_available()}")

    if client:
        print("\n=== Supabase Connection Test ===")
        try:
            # Try a simple query
            result = client.table("users").select("count", count="exact").execute()
            print(f"users table count: {result.count}")
        except Exception as e:
            print(f"Query error: {e}")

except Exception as e:
    print(f"Import error: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Auth Router Import ===")
try:
    from app.routers.auth import router as auth_router
    print("auth.py: OK")
except Exception as e:
    print(f"auth.py error: {e}")

print("\n=== Portfolio Router Import ===")
try:
    from app.routers.portfolio import router as portfolio_router
    print("portfolio.py: OK")
except Exception as e:
    print(f"portfolio.py error: {e}")

print("\n=== Signals Router Import ===")
try:
    from app.routers.signals import router as signals_router
    print("signals.py: OK")
except Exception as e:
    print(f"signals.py error: {e}")

print("\n=== Main App Import ===")
try:
    from app.main import app
    print("main.py: OK")
except Exception as e:
    print(f"main.py error: {e}")

print("\nDone.")

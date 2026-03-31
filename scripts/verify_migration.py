import os
import asyncio
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_migration():
    # Load env
    load_dotenv(dotenv_path="backend/.env")
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        logger.error("❌ SUPABASE_URL or SUPABASE_KEY missing in .env")
        return

    # Use a dummy client just to verify connection
    try:
        supabase: Client = create_client(url, key)
        logger.info("✅ Supabase client initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Supabase client: {e}")
        return

    # Read migration SQL
    try:
        with open("backend/migrations/003_create_translations.sql", "r", encoding="utf-8") as f:
            sql = f.read()
    except Exception as e:
        logger.error(f"❌ Failed to read migration file: {e}")
        return

    # Supabase Python client does not have a raw SQL execute method exposed directly 
    # to users in the same way as the JS client or a direct postgres connection.
    # However, since we cannot easily run 'psql', we will try to use the 'rpc' method 
    # if a postgres function exists, or we ask the user to run it in the SQL Editor.
    
    logger.info("⚠️ Supabase Python client has limited raw SQL support.")
    logger.info("⚠️ PLEASE RUN THE CONTENT OF 'backend/migrations/003_create_translations.sql' IN THE SUPABASE SQL EDITOR MANUALLY.")
    logger.info("⚠️ Alternatively, I will attempt to verify if tables exist.")
    
    try:
        # Check if language_meta exists
        res = supabase.table("language_meta").select("count", count="exact").limit(1).execute()
        logger.info(f"✅ language_meta exists. Row count: {res.count}")
        
    except Exception:
        logger.warning("❌ language_meta table does not exist or access denied.")
        logger.info("👉 I am creating a one-off script to seed the table via the API if it's missing.")
        # We can't 'CREATE TABLE' via the PostgREST API.
        # The user MUST run the SQL in the editor.
        return False

    return True

if __name__ == "__main__":
    asyncio.run(run_migration())

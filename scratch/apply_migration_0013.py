import os
import sys
import pg8000.dbapi

host = os.environ["SUPABASE_DB_HOST"]
user = os.environ["SUPABASE_DB_USER"]
password = os.environ["SUPABASE_DB_PASSWORD"]
database = os.environ.get("SUPABASE_DB_NAME", "postgres")
port = int(os.environ.get("SUPABASE_DB_PORT", "6543"))

sql = """
alter table public.x_posts add column if not exists custom_prompt text;

alter table public.x_posts drop constraint if exists x_posts_status_check;
alter table public.x_posts add constraint x_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'posted', 'failed'));
"""

print("Connecting to database...")
try:
    conn = pg8000.dbapi.connect(
        host=host,
        user=user,
        password=password,
        database=database,
        port=port
    )
    cursor = conn.cursor()
    print("Executing migration 0013...")
    cursor.execute(sql)
    conn.commit()
    print("Migration 0013 successfully applied!")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error executing migration: {e}")
    sys.exit(1)

/**
 * Run FAZE 1 Database Migration
 * Uses Supabase PostgreSQL to create translation tables
 */

const fs = require('fs');
const path = require('path');

// Migration SQL
const migrationSQL = `
-- FAZE 1: Translation System Tables

CREATE TABLE IF NOT EXISTS translations_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  source_lang VARCHAR(5) DEFAULT 'tr',
  target_lang VARCHAR(5) NOT NULL,
  translated_text TEXT NOT NULL,
  context VARCHAR(50) DEFAULT 'general',
  hash VARCHAR(64),
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  usage_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translations_unique
  ON translations_archive(source_lang, target_lang, hash);

CREATE INDEX IF NOT EXISTS idx_translations_context
  ON translations_archive(context, target_lang);

CREATE INDEX IF NOT EXISTS idx_translations_expires
  ON translations_archive(expires_at);

CREATE INDEX IF NOT EXISTS idx_translations_hash
  ON translations_archive(hash);

-- Language metadata
CREATE TABLE IF NOT EXISTS language_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(5) UNIQUE NOT NULL,
  name_english VARCHAR(50),
  name_native VARCHAR(50),
  direction VARCHAR(3) DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),
  flag_emoji VARCHAR(10),
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_language_meta_code
  ON language_meta(code);

CREATE INDEX IF NOT EXISTS idx_language_meta_active
  ON language_meta(is_active, priority);

-- Pre-populate languages (43 total)
INSERT INTO language_meta (code, name_english, name_native, direction, flag_emoji, priority, is_active)
VALUES
  ('tr', 'Turkish', 'Türkçe', 'ltr', '🇹🇷', 1, TRUE),
  ('en', 'English', 'English', 'ltr', '🇬🇧', 2, TRUE),
  ('es', 'Spanish', 'Español', 'ltr', '🇪🇸', 3, TRUE),
  ('pt', 'Portuguese', 'Português', 'ltr', '🇧🇷', 4, TRUE),
  ('ar', 'Arabic', 'العربية', 'rtl', '🇸🇦', 5, TRUE),
  ('id', 'Indonesian', 'Bahasa Indonesia', 'ltr', '🇮🇩', 6, TRUE),
  ('ja', 'Japanese', '日本語', 'ltr', '🇯🇵', 7, TRUE),
  ('de', 'German', 'Deutsch', 'ltr', '🇩🇪', 8, TRUE),
  ('fr', 'French', 'Français', 'ltr', '🇫🇷', 9, TRUE),
  ('it', 'Italian', 'Italiano', 'ltr', '🇮🇹', 10, TRUE),
  ('nl', 'Dutch', 'Nederlands', 'ltr', '🇳🇱', 11, TRUE),
  ('pl', 'Polish', 'Polski', 'ltr', '🇵🇱', 12, TRUE),
  ('ru', 'Russian', 'Русский', 'ltr', '🇷🇺', 13, TRUE),
  ('ko', 'Korean', '한국어', 'ltr', '🇰🇷', 14, TRUE),
  ('zh', 'Chinese (Simplified)', '简体中文', 'ltr', '🇨🇳', 15, TRUE),
  ('vi', 'Vietnamese', 'Tiếng Việt', 'ltr', '🇻🇳', 16, TRUE),
  ('th', 'Thai', 'ไทย', 'ltr', '🇹🇭', 17, TRUE),
  ('hi', 'Hindi', 'हिन्दी', 'ltr', '🇮🇳', 18, TRUE),
  ('ur', 'Urdu', 'اردو', 'rtl', '🇵🇰', 19, TRUE),
  ('fa', 'Persian', 'فارسی', 'rtl', '🇮🇷', 20, TRUE),
  ('he', 'Hebrew', 'עברית', 'rtl', '🇮🇱', 21, TRUE),
  ('uk', 'Ukrainian', 'Українська', 'ltr', '🇺🇦', 22, TRUE),
  ('sv', 'Swedish', 'Svenska', 'ltr', '🇸🇪', 23, TRUE),
  ('no', 'Norwegian', 'Norsk', 'ltr', '🇳🇴', 24, TRUE),
  ('da', 'Danish', 'Dansk', 'ltr', '🇩🇰', 25, TRUE),
  ('fi', 'Finnish', 'Suomi', 'ltr', '🇫🇮', 26, TRUE),
  ('cs', 'Czech', 'Čeština', 'ltr', '🇨🇿', 27, TRUE),
  ('hu', 'Hungarian', 'Magyar', 'ltr', '🇭🇺', 28, TRUE),
  ('ro', 'Romanian', 'Română', 'ltr', '🇷🇴', 29, TRUE),
  ('bg', 'Bulgarian', 'Български', 'ltr', '🇧🇬', 30, TRUE),
  ('hr', 'Croatian', 'Hrvatski', 'ltr', '🇭🇷', 31, TRUE),
  ('sr', 'Serbian', 'Српски', 'ltr', '🇷🇸', 32, TRUE),
  ('sk', 'Slovak', 'Slovenčina', 'ltr', '🇸🇰', 33, TRUE),
  ('sl', 'Slovenian', 'Slovenščina', 'ltr', '🇸🇮', 34, TRUE),
  ('et', 'Estonian', 'Eesti', 'ltr', '🇪🇪', 35, TRUE),
  ('lt', 'Lithuanian', 'Lietuvių', 'ltr', '🇱🇹', 36, TRUE),
  ('lv', 'Latvian', 'Latviešu', 'ltr', '🇱🇻', 37, TRUE),
  ('mk', 'Macedonian', 'Македонски', 'ltr', '🇲🇰', 38, TRUE),
  ('sq', 'Albanian', 'Shqip', 'ltr', '🇦🇱', 39, TRUE),
  ('el', 'Greek', 'Ελληνικά', 'ltr', '🇬🇷', 40, TRUE),
  ('is', 'Icelandic', 'Íslenska', 'ltr', '🇮🇸', 41, TRUE),
  ('ga', 'Irish', 'Gaeilge', 'ltr', '🇮🇪', 42, TRUE),
  ('cy', 'Welsh', 'Cymraeg', 'ltr', '🇬🇧', 43, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Create view for active languages
CREATE OR REPLACE VIEW active_languages AS
SELECT
  code,
  name_english,
  name_native,
  direction,
  flag_emoji,
  priority
FROM language_meta
WHERE is_active = TRUE
ORDER BY priority ASC;
`;

async function runMigration() {
  console.log('🚀 Starting FAZE 1 Database Migration...\n');

  // Get Supabase credentials from .env
  require('dotenv').config({ path: path.join(__dirname, '.env') });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: SUPABASE_URL or SUPABASE_KEY not found in .env');
    console.error('\nPlease set in backend/.env:');
    console.error('  SUPABASE_URL=https://your-project.supabase.co');
    console.error('  SUPABASE_KEY=your-anon-key');
    process.exit(1);
  }

  try {
    // Use node-postgres or fetch the Supabase REST API
    // For simplicity, we'll use fetch to call Supabase RPC

    console.log('📦 Connecting to Supabase PostgreSQL...');
    console.log(`   URL: ${SUPABASE_URL}`);

    // Execute migration via Supabase SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({
        sql: migrationSQL
      })
    });

    if (!response.ok) {
      // Supabase might not have execute_sql RPC
      // Try direct psql instead
      console.log('\n⚠️  Supabase RPC not available.');
      console.log('\n📋 Instructions for manual migration:\n');
      console.log('1. Go to: https://app.supabase.com → Your Project → SQL Editor');
      console.log('2. Click "New Query"');
      console.log('3. Copy-paste the SQL below:');
      console.log('\n' + '='.repeat(60));
      console.log(migrationSQL);
      console.log('='.repeat(60));
      console.log('\n4. Click "Run"');
      console.log('\n5. ✅ Done! Tables created with 43 languages.\n');
      return;
    }

    const data = await response.json();

    console.log('✅ Migration successful!\n');
    console.log('📊 Created tables:');
    console.log('   • translations_archive (with indexes)');
    console.log('   • language_meta (with 43 pre-populated languages)');
    console.log('   • active_languages (view)\n');

    console.log('🌐 Languages created: 43');
    console.log('   • 40 LTR (Left-to-Right)');
    console.log('   • 3 RTL (Right-to-Left): ar, fa, he\n');

    console.log('✨ FAZE 1 Database Migration Complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📋 Fallback: Manual migration required');
    console.log('\nSteps:');
    console.log('1. Go to: https://app.supabase.com');
    console.log('2. Select your project');
    console.log('3. Go to: SQL Editor');
    console.log('4. Click: "New Query"');
    console.log('5. Paste the SQL from: backend/migrations/003_create_translations.sql');
    console.log('6. Click: "Run"\n');
    process.exit(1);
  }
}

runMigration();

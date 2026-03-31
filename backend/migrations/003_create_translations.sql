-- FAZE 1: Translation System Tables
-- =========================================

-- 1. Çeviriler arşivi tablosu
CREATE TABLE IF NOT EXISTS translations_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Kaynak metin
  source_text TEXT NOT NULL,
  source_lang VARCHAR(5) DEFAULT 'tr',

  -- Çevirilen metin
  target_lang VARCHAR(5) NOT NULL,
  translated_text TEXT NOT NULL,

  -- Konteks (bot_output, ui_copy, market_analysis, vb.)
  context VARCHAR(50) DEFAULT 'general',

  -- SHA256 hash of source text (duplicate detection)
  hash VARCHAR(64),

  -- Cache metadata
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,

  -- Usage tracking
  usage_count INT DEFAULT 1,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_translations_unique
  ON translations_archive(source_lang, target_lang, hash);

CREATE INDEX IF NOT EXISTS idx_translations_context
  ON translations_archive(context, target_lang);

CREATE INDEX IF NOT EXISTS idx_translations_expires
  ON translations_archive(expires_at);

CREATE INDEX IF NOT EXISTS idx_translations_hash
  ON translations_archive(hash);

-- =========================================

-- 2. Dil metadata tablosu
CREATE TABLE IF NOT EXISTS language_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dil kodu (ISO 639-1)
  code VARCHAR(5) UNIQUE NOT NULL,

  -- English name
  name_english VARCHAR(50),

  -- Native name (Türkçe, English, العربية, vb.)
  name_native VARCHAR(50),

  -- Writing direction (ltr: left-to-right, rtl: right-to-left)
  direction VARCHAR(3) DEFAULT 'ltr' CHECK (direction IN ('ltr', 'rtl')),

  -- Flag emoji
  flag_emoji VARCHAR(10),

  -- Active status
  is_active BOOLEAN DEFAULT TRUE,

  -- Display order (1 = Türkçe, 2 = English, vb.)
  priority INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_language_meta_code
  ON language_meta(code);

CREATE INDEX IF NOT EXISTS idx_language_meta_active
  ON language_meta(is_active, priority);

-- =========================================

-- 3. Pre-populate language_meta
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

-- =========================================

-- 4. View: Active languages (for frontend)
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

-- =========================================
-- END FAZE 1 MIGRATION
-- =========================================

"""
Translation Engine — Google Translate + Redis Cache + Supabase Archive
========================================================================

Flow:
  1. Source text hash oluştur (SHA256)
  2. Redis cache'de bak (24 saat TTL)
  3. Cache miss → Supabase archive'de bak
  4. Archive miss → Google Translate API çağır
  5. Sonuç → Redis + Supabase'e kaydet

Supported: 43 dil (tr, en, es, pt, ar, id, ja, de, fr, it, nl, pl, ru, ko, zh, vi, th, hi, ur, fa, he, uk, sv, no, da, fi, cs, hu, ro, bg, hr, sr, sk, sl, et, lt, lv, mk, sq, el, is, ga, cy)
"""

import asyncio
import hashlib
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

# ─── Google Translate Client ────────────────────────────────────────────

# ─── Google Translate Client (REMOVED) ───────────────────────────────────

# ─── Gemini AI Client Entegrasyonu ──────────────────────────────────────

from app.services.gemini_ai import call_gemini

# ─── Redis Client ──────────────────────────────────────────────────────

def get_redis_client():
    """Redis cache client (lazy load)"""
    try:
        import redis as redis_lib
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        client = redis_lib.from_url(redis_url, decode_responses=True, socket_timeout=3)
        client.ping()
        logger.info("✅ Redis connected")
        return client
    except ImportError:
        logger.warning("⚠️  redis not installed. Run: pip install redis")
        return None
    except Exception as e:
        logger.warning(f"⚠️  Redis unavailable (will use fallback): {e}")
        return None


# ─── Supabase Client ───────────────────────────────────────────────────

def get_supabase_client():
    """Supabase database client"""
    from app.database import get_supabase
    return get_supabase()


# ─── Translation Engine ───────────────────────────────────────────────────

class TranslationEngine:
    """
    Multi-language translation engine with caching and archiving.
    Powered by Gemini 2.0 Flash for accurate financial translations.

    Architecture:
      L1 Cache: Redis (24h TTL)
      L2 Cache: Supabase (persistent)
      L3 Fetch: Gemini AI
    """

    def __init__(self):
        self.redis = get_redis_client()
        self.db = get_supabase_client()
        self.supported_langs = {}
        self._load_languages()

    def _load_languages(self):
        """Load supported languages from database"""
        try:
            if not self.db:
                logger.warning("⚠️  Supabase unavailable, using default languages")
                self.supported_langs = self._default_languages()
                return

            result = self.db.table("language_meta")\
                .select("code, name_native, direction, flag_emoji")\
                .eq("is_active", True)\
                .order("priority")\
                .execute()

            if not result.data:
                logger.warning("⚠️  language_meta table empty, using fallback")
                self.supported_langs = self._default_languages()
                return

            for row in result.data:
                self.supported_langs[row['code']] = {
                    'name': row['name_native'],
                    'direction': row['direction'],
                    'flag': row['flag_emoji']
                }
            logger.info(f"✅ Loaded {len(self.supported_langs)} languages")

        except Exception as e:
            logger.error(f"Error loading languages: {e}")
            self.supported_langs = self._default_languages()

    def _default_languages(self) -> Dict:
        """Fallback languages"""
        return {
            'tr': {'name': 'Türkçe', 'direction': 'ltr', 'flag': '🇹🇷'},
            'en': {'name': 'English', 'direction': 'ltr', 'flag': '🇬🇧'},
            'ar': {'name': 'العربية', 'direction': 'rtl', 'flag': '🇸🇦'},
            'es': {'name': 'Español', 'direction': 'ltr', 'flag': '🇪🇸'},
            'pt': {'name': 'Português', 'direction': 'ltr', 'flag': '🇧🇷'},
            'ja': {'name': '日本語', 'direction': 'ltr', 'flag': '🇯🇵'},
        }

    def _hash_text(self, text: str) -> str:
        """SHA256 hash of text for duplicate detection"""
        return hashlib.sha256(text.encode()).hexdigest()

    async def translate(
        self,
        text: str,
        target_lang: str,
        source_lang: str = 'tr',
        context: str = 'general'
    ) -> Optional[str]:
        """
        Translate text using Gemini with caching.

        Args:
            text: Text to translate
            target_lang: Target language code
            source_lang: Source language code
            context: Translation context (bot_output, ui_copy, market_analysis)

        Returns:
            Translated text or original text if translation fails
        """

        # 1. Same language or empty → return as-is
        if source_lang == target_lang or not text or not text.strip():
            return text

        # 2. Hash & cache key
        text_hash = self._hash_text(text)
        cache_key = f"trans:{source_lang}:{target_lang}:{text_hash}"

        # 3. Redis cache check (L1)
        if self.redis:
            try:
                cached = self.redis.get(cache_key)
                if cached:
                    logger.debug(f"✅ Redis hit: {target_lang}")
                    return cached
            except Exception as e:
                logger.debug(f"Redis error: {e}")

        # 4. Supabase archive check (L2)
        if self.db:
            try:
                result = self.db.table("translations_archive")\
                    .select("translated_text")\
                    .eq("source_lang", source_lang)\
                    .eq("target_lang", target_lang)\
                    .eq("hash", text_hash)\
                    .execute()

                if result.data and len(result.data) > 0:
                    translated = result.data[0]['translated_text']
                    # Re-cache to Redis
                    if self.redis:
                        try:
                            self.redis.setex(cache_key, 86400, translated)
                        except:
                            pass
                    logger.debug(f"✅ Supabase hit: {target_lang}")
                    return translated
            except Exception as e:
                logger.debug(f"Supabase archive miss: {e}")

        # 5. Gemini AI Fetch (L3)
        try:
            # Prompt for translation (Optimized for financial UI & preservation style)
            system_prompt = f"""Sen profesyonel bir finansal çevirmensin.
Verilen metni '{source_lang}' dilinden '{target_lang}' diline çevir.

KURALLAR:
1. Finansal terimleri (Ticker, Market Cap, VIX, S&P 500 vb.) koru veya uygun finansal karşılığını kullan.
2. Metin içindeki ikonları, emojileri (🏠, 🔥, 📈 vb.) ve özel karakterleri HİÇ DEĞİŞTİRME, yerlerini koru.
3. Sadece çeviriyi döndür, başka açıklama ekleme.
4. Profesyonel ve akıcı bir dil kullan."""

            prompt = f"Çevrilecek metin: {text}"
            
            translated = await call_gemini(prompt, system_prompt, "gemini-2.0-flash")
            
            # Clean up response (some AI might add quotes)
            translated = translated.strip().strip('"').strip("'")

            if not translated or translated.startswith("⚠️"):
                logger.warning(f"⚠️ Gemini translation failed: {translated}")
                return text

            # 6. Cache to Redis (L1)
            if self.redis:
                try:
                    self.redis.setex(cache_key, 86400, translated)  # 24 hours
                except Exception as e:
                    logger.debug(f"Redis cache error: {e}")

            # 7. Archive to Supabase (L2)
            if self.db:
                try:
                    expires_at = (datetime.now() + timedelta(days=30)).isoformat()
                    self.db.table("translations_archive").insert({
                        "source_text": text,
                        "source_lang": source_lang,
                        "target_lang": target_lang,
                        "translated_text": translated,
                        "context": context,
                        "hash": text_hash,
                        "expires_at": expires_at,
                        "usage_count": 1
                    }).execute()
                except Exception as e:
                    logger.debug(f"Supabase archive write error: {e}")

            logger.info(f"✅ Translated to {target_lang} via Gemini AI")
            return translated

        except Exception as e:
            logger.error(f"Gemini translation crash: {e}")
            return text  # Return original on error

    async def translate_batch(
        self,
        texts: List[str],
        target_lang: str,
        source_lang: str = 'tr',
        context: str = 'general'
    ) -> List[Optional[str]]:
        """
        Translate multiple texts in parallel.

        Args:
            texts: List of texts to translate
            target_lang: Target language code
            source_lang: Source language code
            context: Translation context

        Returns:
            List of translated texts
        """
        tasks = [
            self.translate(text, target_lang, source_lang, context)
            for text in texts
        ]
        return await asyncio.gather(*tasks)

    def get_supported_languages(self) -> Dict:
        """Get all supported languages"""
        return self.supported_langs

    def get_language_direction(self, lang_code: str) -> str:
        """Get text direction for language (ltr or rtl)"""
        lang = self.supported_langs.get(lang_code, {})
        return lang.get('direction', 'ltr')

    def is_language_supported(self, lang_code: str) -> bool:
        """Check if language is supported"""
        return lang_code in self.supported_langs


# ─── Singleton Instance ────────────────────────────────────────────────

_engine_instance = None

def get_translation_engine() -> TranslationEngine:
    """Get or create translation engine singleton"""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = TranslationEngine()
    return _engine_instance

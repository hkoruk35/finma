#!/usr/bin/env python3
"""
FinMA V6+ Enum Translation Seeder
Seeds enum_translations table with all 8 target languages using Gemini API
Task 1.3: Populate enum_translations for TR, EN, ES, PT-BR, DE, FR, ID, MS

Usage:
    python seed_enum_translations.py

Environment variables needed:
    GEMINI_API_KEY
    SUPABASE_URL
    SUPABASE_KEY
"""

import sys
import os
import asyncio
import json
from typing import Optional
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.gemini_ai import call_gemini
from database import get_supabase_client

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

TARGET_LANGUAGES = {
    'tr': 'Turkish',
    'en': 'English',
    'es': 'Spanish',
    'pt-BR': 'Portuguese (Brazil)',
    'de': 'German',
    'fr': 'French',
    'id': 'Indonesian',
    'ms': 'Malay'
}

# Already exists (English seeded in migration)
EXISTING_LANGUAGES = ['en']

# Enum definitions - English source values
ENUM_DEFINITIONS = {
    'sector_key': {
        'tech': 'Technology - Software, hardware, cloud, semiconductors',
        'finance': 'Financials - Banks, insurance, investment firms',
        'healthcare': 'Healthcare - Pharmaceuticals, biotech, medical devices',
        'energy': 'Energy - Oil, gas, renewable energy',
        'materials': 'Basic Materials - Mining, chemicals, metals',
        'industrials': 'Industrials - Manufacturing, machinery, defense',
        'consumer_discr': 'Consumer Discretionary - Retail, automotive, restaurants',
        'consumer_staples': 'Consumer Staples - Food, beverages, household items',
        'telecom': 'Telecommunications - Telecom services, wireless',
        'utilities': 'Utilities - Electric, water, gas utilities'
    },
    'daily_scores_tag': {
        'core': 'Core - Core holdings in portfolio',
        'sector': 'Sector Leader - Leading stock in sector',
        'volume': 'High Volume - Unusual volume activity',
        'gainer': 'Top Gainer - Top performing stock',
        'loser': 'Top Loser - Worst performing stock'
    },
    'daily_scores_tier': {
        'strong': 'Strong - High conviction buy',
        'high': 'High - Good opportunity',
        'watch': 'Watch - Monitor for entry',
        'ignore': 'Ignore - Not recommended'
    },
    'tracking_state_key': {
        'track': 'Track - Monitoring stock',
        'wait': 'Wait - Waiting for better entry',
        'scale_in': 'Scaling In - Building position gradually',
        'buy': 'Buy - Buy signal active',
        'hold': 'Hold - Hold current position',
        'cost_down': 'Cost Down - Reduce position cost',
        'scale_out': 'Scaling Out - Reducing position',
        'sell': 'Sell - Sell signal active'
    },
    'market_regime_key': {
        'bull': 'Bull Market - Uptrend, positive sentiment',
        'bear': 'Bear Market - Downtrend, negative sentiment',
        'sideways': 'Sideways - Range-bound, no clear direction',
        'accumulation': 'Accumulation - Smart money buying',
        'distribution': 'Distribution - Smart money selling'
    },
    'interest_zone_key': {
        'zone_a': 'Zone A - Optimal entry zone (lowest)',
        'zone_b': 'Zone B - Secondary entry zone',
        'zone_c': 'Zone C - Tertiary entry zone',
        'zone_d': 'Zone D - Final entry zone (highest)'
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# Translation Functions
# ─────────────────────────────────────────────────────────────────────────────

async def translate_batch_terms(
    terms: dict[str, str],
    target_lang: str,
    lang_name: str
) -> dict[str, str]:
    """
    Translate a batch of financial terms using Gemini API

    Args:
        terms: dict of {key: english_definition}
        target_lang: language code (e.g., 'es', 'de')
        lang_name: human-readable language name (e.g., 'Spanish', 'German')

    Returns:
        dict of {key: translated_value}
    """

    # Create prompt for Gemini
    terms_list = '\n'.join([f"{k}: {v}" for k, v in terms.items()])

    prompt = f"""You are a professional financial translator. Translate the following financial terms from English to {lang_name}.
Keep translations concise (max 20 chars per term) and use standard financial terminology.
Return ONLY a JSON object with the same keys, no additional text or explanation.

Terms to translate:
{terms_list}

Format your response as valid JSON: {{"key": "translation", ...}}"""

    try:
        response = await call_gemini(
            prompt=prompt,
            system_prompt=f"You are a professional {lang_name} financial translator. Translate financial terms accurately and concisely.",
            model_name='gemini-2.0-flash'
        )

        # Parse JSON response
        translations = json.loads(response)
        return translations

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response for {lang_name}: {e}")
        logger.error(f"Raw response: {response}")
        return {}
    except Exception as e:
        logger.error(f"Error translating to {lang_name}: {e}")
        return {}


async def insert_translations(
    enum_type: str,
    translations: dict[str, str],
    language: str
) -> int:
    """
    Insert translations into enum_translations table

    Args:
        enum_type: type of enum (sector_key, daily_scores_tier, etc.)
        translations: dict of {enum_key: display_value}
        language: language code

    Returns:
        number of rows inserted
    """

    supabase = get_supabase_client()
    count = 0

    for enum_key, display_value in translations.items():
        try:
            result = supabase.table('enum_translations').insert({
                'enum_type': enum_type,
                'enum_key': enum_key,
                'language': language,
                'display_value': display_value
            }, ignore_duplicates=True).execute()

            if result.data:
                count += 1
                logger.debug(f"  ✓ {enum_type}.{enum_key} → {display_value}")

        except Exception as e:
            logger.error(f"  ✗ Failed to insert {enum_type}.{enum_key}: {e}")

    return count


async def seed_language(target_lang: str) -> bool:
    """
    Seed all enum translations for a single language

    Args:
        target_lang: language code (e.g., 'es', 'de')

    Returns:
        success boolean
    """

    lang_name = TARGET_LANGUAGES.get(target_lang, target_lang)
    logger.info(f"\n{'='*60}")
    logger.info(f"Seeding {lang_name} ({target_lang})")
    logger.info(f"{'='*60}")

    total_inserted = 0

    # Process each enum type
    for enum_type, definitions in ENUM_DEFINITIONS.items():
        logger.info(f"\nTranslating {enum_type}...")

        # Translate all terms for this enum type
        translations = await translate_batch_terms(
            definitions,
            target_lang,
            lang_name
        )

        if not translations:
            logger.warning(f"  ⚠ Failed to translate {enum_type}")
            continue

        # Insert into database
        inserted = await insert_translations(
            enum_type,
            translations,
            target_lang
        )

        logger.info(f"  → Inserted {inserted}/{len(definitions)} translations")
        total_inserted += inserted

    logger.info(f"\n✓ Total inserted for {lang_name}: {total_inserted} translations")
    return total_inserted > 0


async def main():
    """Main seeding process"""

    logger.info("FinMA V6+ Enum Translation Seeder")
    logger.info("="*60)

    # Verify Supabase connection
    try:
        supabase = get_supabase_client()
        logger.info("✓ Connected to Supabase")
    except Exception as e:
        logger.error(f"✗ Failed to connect to Supabase: {e}")
        return False

    # Seed each language (except English which is pre-seeded)
    languages_to_seed = [lang for lang in TARGET_LANGUAGES.keys() if lang not in EXISTING_LANGUAGES]

    logger.info(f"\nLanguages to seed: {', '.join(languages_to_seed)}")
    logger.info(f"(Skipping {', '.join(EXISTING_LANGUAGES)} - already seeded)")

    results = {}
    for lang in languages_to_seed:
        try:
            success = await seed_language(lang)
            results[lang] = success
        except Exception as e:
            logger.error(f"Failed to seed {lang}: {e}")
            results[lang] = False

    # Summary
    logger.info(f"\n{'='*60}")
    logger.info("SEEDING SUMMARY")
    logger.info(f"{'='*60}")

    for lang, success in results.items():
        status = "✓ SUCCESS" if success else "✗ FAILED"
        logger.info(f"{lang.ljust(10)} {status}")

    successful = sum(1 for v in results.values() if v)
    logger.info(f"\nTotal: {successful}/{len(results)} languages seeded")

    return all(results.values())


if __name__ == '__main__':
    success = asyncio.run(main())
    sys.exit(0 if success else 1)

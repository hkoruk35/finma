"""
Translation API Routes
======================

GET  /api/v1/translation/languages        - Get all supported languages
GET  /api/v1/translation/translate        - Translate single text
POST /api/v1/translation/batch            - Batch translate
GET  /api/v1/translation/direction/{lang} - Get text direction (ltr/rtl)

Example:
  GET /api/v1/translation/translate?text=Merhaba&target_lang=en&source_lang=tr
  Response: {"translated": "Hello", "target_lang": "en"}
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, Path, HTTPException
from pydantic import BaseModel

class BatchRequest(BaseModel):
    texts: List[str]
    target_lang: str
    source_lang: str = "tr"
    context: str = "general"

from app.services.translation_engine import get_translation_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/translation", tags=["translation"])
engine = get_translation_engine()


@router.get("/languages")
async def get_languages():
    """
    Get all supported languages (43 languages)

    Returns:
        {
          "tr": {"name": "Türkçe", "flag": "🇹🇷", "direction": "ltr"},
          "en": {"name": "English", "flag": "🇬🇧", "direction": "ltr"},
          "ar": {"name": "العربية", "flag": "🇸🇦", "direction": "rtl"},
          ...
        }
    """
    languages = engine.get_supported_languages()
    if not languages:
        raise HTTPException(
            status_code=503,
            detail="Language database unavailable"
        )
    return languages


@router.get("/translate")
async def translate(
    text: str = Query(..., description="Text to translate", min_length=1),
    target_lang: str = Query(..., description="Target language code (e.g., 'en', 'ar')"),
    source_lang: str = Query("tr", description="Source language code (default: 'tr')"),
    context: str = Query("general", description="Context (e.g., 'bot_output', 'ui_copy')")
):
    """
    Translate single text.

    Example:
        GET /translate?text=Merhaba%20Dünya&target_lang=en

    Returns:
        {"translated": "Hello World", "target_lang": "en", "source_lang": "tr"}
    """

    # Validate languages
    if not engine.is_language_supported(target_lang):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: {target_lang}"
        )

    if not engine.is_language_supported(source_lang):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported source language: {source_lang}"
        )

    # Translate
    translated = await engine.translate(
        text=text,
        target_lang=target_lang,
        source_lang=source_lang,
        context=context
    )

    return {
        "original": text,
        "translated": translated,
        "source_lang": source_lang,
        "target_lang": target_lang,
        "context": context
    }


@router.post("/batch")
async def translate_batch(body: BatchRequest):
    """
    Batch translate multiple texts (parallel processing).

    Example:
        POST /batch
        {
          "texts": ["Merhaba", "Dünya"],
          "target_lang": "en"
        }

    Returns:
        {
          "translations": ["Hello", "World"],
          "target_lang": "en",
          "count": 2
        }
    """

    texts = body.texts
    target_lang = body.target_lang
    source_lang = body.source_lang
    context = body.context

    # Validate
    if not texts:
        raise HTTPException(status_code=400, detail="No texts provided")

    if len(texts) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 texts per batch request"
        )

    if not engine.is_language_supported(target_lang):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: {target_lang}"
        )

    # Translate
    translated = await engine.translate_batch(
        texts=texts,
        target_lang=target_lang,
        source_lang=source_lang,
        context=context
    )

    return {
        "originals": texts,
        "translations": translated,
        "source_lang": source_lang,
        "target_lang": target_lang,
        "count": len(texts)
    }


@router.get("/direction/{lang_code}")
async def get_direction(lang_code: str = Path(..., description="Language code (e.g., 'ar', 'en')")):
    """
    Get text direction for a language (ltr or rtl).

    Returns:
        {"lang_code": "ar", "direction": "rtl"}
    """

    if not engine.is_language_supported(lang_code):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {lang_code}"
        )

    direction = engine.get_language_direction(lang_code)

    return {
        "lang_code": lang_code,
        "direction": direction
    }


@router.get("/health")
async def health_check():
    """Health check for translation service"""
    return {
        "status": "ok",
        "service": "translation-engine",
        "languages_loaded": len(engine.get_supported_languages()),
        "google_translate": "active" if engine.google_client else "unavailable",
        "redis": "active" if engine.redis else "unavailable",
        "database": "active" if engine.db else "unavailable"
    }

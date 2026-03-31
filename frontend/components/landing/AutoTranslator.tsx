'use client';

/**
 * AutoTranslator
 * Kullanıcı dil değiştirince tüm sayfanın görünür text'lerini
 * backend /api/v1/translation/translate endpoint'i ile çevirir.
 */

import { useEffect, useRef } from 'react';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'SELECT']);
const SKIP_ATTRS = ['data-notranslate', 'data-ticker', 'data-symbol'];
const BATCH_SIZE = 30;
const STORAGE_KEY = 'finma_language';

function getTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (SKIP_ATTRS.some(a => parent.closest(`[${a}]`))) return NodeFilter.FILTER_REJECT;
      const text = node.textContent?.trim() ?? '';
      if (text.length < 2) return NodeFilter.FILTER_REJECT;
      // Skip pure numbers/symbols/tickers
      if (/^[\d.,+\-% $€£¥]+$/.test(text)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  return nodes;
}

async function batchTranslate(texts: string[], targetLang: string): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    try {
      const params = new URLSearchParams({ target_lang: targetLang });
      chunk.forEach(t => params.append('texts', t));
      const res = await fetch(`/api/v1/translation/batch?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: chunk, target_lang: targetLang })
      });
      if (res.ok) {
        const data = await res.json();
        results.push(...(data.translations ?? chunk));
      } else {
        results.push(...chunk);
      }
    } catch {
      results.push(...chunk);
    }
  }
  return results;
}

// Cache: { lang -> { originalText -> translatedText } }
const translationCache: Record<string, Record<string, string>> = {};

async function translatePage(targetLang: string) {
  if (targetLang === 'tr') {
    // Restore original texts
    document.querySelectorAll('[data-original-text]').forEach(el => {
      const orig = el.getAttribute('data-original-text');
      if (orig && el.firstChild?.nodeType === Node.TEXT_NODE) {
        el.firstChild.textContent = orig;
      }
    });
    return;
  }

  if (!translationCache[targetLang]) translationCache[targetLang] = {};

  const root = document.querySelector('body') as HTMLElement;
  const textNodes = getTextNodes(root);

  // Collect unique texts needing translation
  const toTranslate: { node: Text; text: string }[] = [];
  const unique = new Map<string, Text[]>();

  textNodes.forEach(node => {
    const text = node.textContent?.trim() ?? '';
    if (translationCache[targetLang][text]) {
      // Already cached - apply immediately
      if (node.parentElement) {
        node.parentElement.setAttribute('data-original-text', text);
        node.textContent = translationCache[targetLang][text];
      }
    } else {
      if (!unique.has(text)) unique.set(text, []);
      unique.get(text)!.push(node);
    }
  });

  if (unique.size === 0) return;

  const uniqueTexts = Array.from(unique.keys());
  const translated = await batchTranslate(uniqueTexts, targetLang);

  uniqueTexts.forEach((orig, idx) => {
    const trans = translated[idx] ?? orig;
    translationCache[targetLang][orig] = trans;
    (unique.get(orig) ?? []).forEach(node => {
      if (node.parentElement) {
        node.parentElement.setAttribute('data-original-text', orig);
        node.textContent = trans;
      }
    });
  });
}

export function AutoTranslator() {
  const currentLang = useRef<string>('tr');

  useEffect(() => {
    // Read saved lang on mount
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== 'tr') {
      currentLang.current = saved;
      // Small delay to let page render first
      setTimeout(() => translatePage(saved), 600);
    }

    const handleChange = (e: Event) => {
      const lang = (e as CustomEvent<{ lang: string }>).detail?.lang;
      if (!lang || lang === currentLang.current) return;
      currentLang.current = lang;
      translatePage(lang);
    };

    window.addEventListener('languageChange', handleChange);
    return () => window.removeEventListener('languageChange', handleChange);
  }, []);

  return null; // Renders nothing
}

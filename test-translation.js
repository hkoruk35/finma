/**
 * Translation System Test Script
 * Tests all 43 languages via the translation API
 */

const LANGUAGES = [
  'tr', 'en', 'es', 'pt', 'ar', 'id', 'ja', 'de', 'fr', 'it',
  'nl', 'pl', 'ru', 'ko', 'zh', 'vi', 'th', 'hi', 'ur', 'fa',
  'he', 'uk', 'sv', 'no', 'da', 'fi', 'cs', 'hu', 'ro', 'bg',
  'hr', 'sr', 'sk', 'sl', 'et', 'lt', 'lv', 'mk', 'sq', 'el',
  'is', 'ga', 'cy'
];

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TEXT = 'Hello World';

async function testTranslation(lang) {
  try {
    const response = await fetch(`${API_URL}/api/v1/translation/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [TEST_TEXT],
        target_lang: lang,
        source_lang: 'en',
        context: 'general'
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${lang}: ${data.translations?.[0] || 'No translation'}`);
      return { lang, success: true, translation: data.translations?.[0] };
    } else {
      console.log(`❌ ${lang}: HTTP ${response.status}`);
      return { lang, success: false, status: response.status };
    }
  } catch (error) {
    console.error(`❌ ${lang}: ${error.message}`);
    return { lang, success: false, error: error.message };
  }
}

async function main() {
  console.log(`🌐 Testing translation API for ${LANGUAGES.length} languages`);
  console.log(`📍 API URL: ${API_URL}`);
  console.log(`📝 Test text: "${TEST_TEXT}"\n`);

  const results = [];
  for (const lang of LANGUAGES) {
    const result = await testTranslation(lang);
    results.push(result);
    // Small delay to avoid overwhelming API
    await new Promise(r => setTimeout(r, 100));
  }

  const successful = results.filter(r => r.success).length;
  console.log(`\n📊 Results: ${successful}/${LANGUAGES.length} languages working`);

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n⚠️  Failed languages:`);
    failed.forEach(r => {
      const reason = r.status ? `HTTP ${r.status}` : r.error;
      console.log(`   - ${r.lang}: ${reason}`);
    });
  }
}

main().catch(console.error);

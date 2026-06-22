const https = require('https');

function fetchPage(url, cookie) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cookie': cookie || '',
        'Accept': 'text/html,application/xhtml+xml'
      }
    };
    const req = https.request(opts, (r) => {
      let body = '';
      r.on('data', d => body += d);
      r.on('end', () => resolve({ status: r.statusCode, body, headers: r.headers }));
    });
    req.on('error', e => resolve({ status: 0, body: String(e), headers: {} }));
    req.end();
  });
}

async function main() {
  console.log('=== Testing /swing with valid auth cookie ===');
  const result = await fetchPage('https://bogastock.com/swing', 'boga_auth=valid_session');
  console.log('Status:', result.status);
  
  // Extract error info from HTML
  const body = result.body;
  
  // Look for Next.js error data
  const errorData = body.match(/data-nextjs-error[^>]*>([^<]*)/);
  if (errorData) console.log('Error data attr:', errorData[1]);
  
  // Look for script with error
  const scriptErrors = body.match(/Error.*?(?=\\n|<\/)/g);
  if (scriptErrors) console.log('Script errors:', scriptErrors.slice(0, 5));
  
  // Look for the __NEXT_DATA__ which might have error info
  const nextDataMatch = body.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      console.log('__NEXT_DATA__ keys:', Object.keys(nextData));
      if (nextData.err) console.log('Error:', JSON.stringify(nextData.err, null, 2));
    } catch (e) {
      console.log('Could not parse __NEXT_DATA__');
    }
  }
  
  // Check for any error text
  if (body.includes('TypeError')) {
    const typeErrIdx = body.indexOf('TypeError');
    console.log('TypeError context:', body.substring(typeErrIdx, typeErrIdx + 200));
  }
  
  if (body.includes('Cannot read')) {
    const idx = body.indexOf('Cannot read');
    console.log('Cannot read context:', body.substring(idx, idx + 200));
  }
  
  // Check if it renders Daily Swing content
  if (body.includes('Daily Swing')) {
    console.log('Page HAS Daily Swing content!');
  } else {
    console.log('Page does NOT have Daily Swing content');
    console.log('Body length:', body.length);
    // Print first 1000 chars
    console.log('First 1000 chars:', body.substring(0, 1000));
  }
}

main().catch(console.error);

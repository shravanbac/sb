/*
 * Workfront Fusion CORS Proxy - AEM Edge Function
 * Deploy to: /tools/api/workfront-proxy.js
 */

const FUSION_ENDPOINTS = {
  submit: 'https://hook.fusion.adobe.com/p1hfpwx8u0wzugeusvy1siybrj2wklnh',
  'check-status': 'https://hook.fusion.adobe.com/285qiwwjzhdttkr5jcyg48nr72xghf7t',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default async function main(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();
    const { action = 'submit', ...payload } = body;
    const targetUrl = FUSION_ENDPOINTS[action];

    if (!targetUrl) {
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let result;
    
    try {
      result = JSON.parse(text);
    } catch {
      result = { status: response.ok ? 'success' : 'error', message: text || 'Processed' };
    }

    return jsonResponse(result, response.status);
  } catch (error) {
    return jsonResponse({ error: 'Proxy error', message: error.message }, 500);
  }
}

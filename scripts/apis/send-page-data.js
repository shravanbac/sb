export default async function handler({ req }) {
  if (req.method !== 'POST') {
    return {
      status: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload = await req.json();

    const FUSION_WEBHOOK = 'https://hook.fusion.adobe.com/4r1b2137fbuus3vcm1kavi1f2g992y9o';
    const credentials = btoa('secure-user:secure');

    const response = await fetch(FUSION_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return {
        status: 200,
        body: JSON.stringify({ success: true }),
      };
    }
    return {
      status: response.status,
      body: JSON.stringify({ error: 'Webhook failed' }),
    };
  } catch (error) {
    return {
      status: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

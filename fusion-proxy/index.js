// Adobe I/O Runtime action - CORS handled automatically by Runtime for web actions

async function main(params) {
  // Only POST allowed
  if (params.__ow_method !== 'post') {
    return { 
      statusCode: 405, 
      body: { error: 'Method not allowed' } 
    };
  }

  try {
    console.log('Params keys:', Object.keys(params).filter(k => !k.startsWith('__')));

    let payload = null;

    // Method 1: data directly in params (Content-Type: application/json)
    if (params.data) {
      console.log('Using params.data');
      payload = params.data;
    }
    // Method 2: Parse __ow_body
    else if (params.__ow_body) {
      console.log('Parsing __ow_body');
      let bodyStr;
      try {
        bodyStr = Buffer.from(params.__ow_body, 'base64').toString('utf8');
      } catch (e) {
        bodyStr = params.__ow_body;
      }
      const parsed = JSON.parse(bodyStr);
      payload = parsed.data || parsed;
    }

    console.log('Payload:', JSON.stringify(payload));

    if (!payload) {
      return { statusCode: 400, body: { error: 'No payload' } };
    }

    // Forward to Fusion with Basic Auth
    const credentials = Buffer.from('secure-user:secure').toString('base64');
    
    const response = await fetch('https://hook.fusion.adobe.com/4r1b2137fbuus3vcm1kavi1f2g992y9o', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Fusion status:', response.status);

    return {
      statusCode: response.ok ? 200 : response.status,
      body: { success: response.ok, fusionStatus: response.status }
    };

  } catch (error) {
    console.error('Error:', error.message);
    return { statusCode: 500, body: { error: error.message } };
  }
}

exports.main = main;
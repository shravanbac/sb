// Adobe I/O Runtime action for Status Check
// Forwards to Fusion webhook with Basic Auth

async function main(params) {
  if (params.__ow_method !== 'post') {
    return { statusCode: 405, body: { error: 'Method not allowed' } };
  }

  try {
    let payload = null;

    // Get payload from params or __ow_body
    if (params.data) {
      payload = params.data;
    } else if (params.__ow_body) {
      let bodyStr;
      try {
        bodyStr = Buffer.from(params.__ow_body, 'base64').toString('utf8');
      } catch (e) {
        bodyStr = params.__ow_body;
      }
      const parsed = JSON.parse(bodyStr);
      payload = parsed.data || parsed;
    }

    // Also check for direct params (action, pageIdentifier, etc.)
    if (!payload && params.action) {
      payload = {
        action: params.action,
        pageIdentifier: params.pageIdentifier,
        org: params.org,
        site: params.site,
        ref: params.ref,
        path: params.path
      };
    }

    if (!payload) {
      return { statusCode: 400, body: { error: 'No payload' } };
    }

    // Forward to Fusion with Basic Auth
    const credentials = Buffer.from('secure-user:secure').toString('base64');
    
    const response = await fetch('https://hook.fusion.adobe.com/44gs9etbqjf5y2n06g8e9ds8ff9jhj07', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = { message: responseText };
    }

    return {
      statusCode: response.ok ? 200 : response.status,
      body: response.ok ? responseData : { success: false, error: responseText }
    };

  } catch (error) {
    console.error('Error:', error.message);
    return { statusCode: 500, body: { error: error.message } };
  }
}

exports.main = main;
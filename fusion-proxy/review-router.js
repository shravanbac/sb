// Adobe I/O Runtime - Unified Review Router
// Routes to different Fusion webhooks based on folder (dev/qa/production)
// Handles both "Send For Review" and "Get Page Status" actions

const CREDENTIALS = Buffer.from('secure-user:secure').toString('base64');

// ============================================
// WEBHOOK CONFIGURATION
// Update SB01 and SB02 URLs when ready
// ============================================
const WEBHOOKS = {
  // Development (dev folder) -> SB02
  dev: {
    submit: 'TODO_SB02_SUBMIT_WEBHOOK',  // Replace with SB02 submit webhook
    status: 'TODO_SB02_STATUS_WEBHOOK',  // Replace with SB02 status webhook
  },
  
  // QA (qa folder) -> SB01
  qa: {
    submit: 'TODO_SB01_SUBMIT_WEBHOOK',  // Replace with SB01 submit webhook
    status: 'TODO_SB01_STATUS_WEBHOOK',  // Replace with SB01 status webhook
  },
  
  // Production (production folder) -> Production
  production: {
    submit: 'https://hook.fusion.adobe.com/ep2dmd26o8rguldc72p6oh8v6j1w6die',
    status: 'https://hook.fusion.adobe.com/44gs9etbqjf5y2n06g8e9ds8ff9jhj07',
  },
};

// Default fallback (pages at root or unknown folders)
const DEFAULT_ENV = 'production';

// ============================================
// ENVIRONMENT DETECTION
// ============================================
function getEnvironment(payload) {
  const path = payload.path || payload.pageIdentifier || '';
  const normalizedPath = path.toLowerCase().replace(/^\/+/, '');
  
  if (normalizedPath.startsWith('dev/') || normalizedPath === 'dev') {
    return 'dev';
  }
  if (normalizedPath.startsWith('qa/') || normalizedPath === 'qa') {
    return 'qa';
  }
  if (normalizedPath.startsWith('production/') || normalizedPath === 'production') {
    return 'production';
  }
  
  // Also check pageIdentifier format: org/site/folder/path
  if (payload.pageIdentifier) {
    const parts = payload.pageIdentifier.split('/');
    if (parts.length >= 3) {
      const folder = parts[2].toLowerCase();
      if (folder === 'dev') return 'dev';
      if (folder === 'qa') return 'qa';
      if (folder === 'production') return 'production';
    }
  }
  
  return DEFAULT_ENV;
}

// ============================================
// MAIN ACTION
// ============================================
async function main(params) {
  if (params.__ow_method !== 'post') {
    return { statusCode: 405, body: { error: 'Method not allowed' } };
  }

  try {
    // Parse payload
    let payload = null;
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

    if (!payload) {
      return { statusCode: 400, body: { error: 'No payload provided' } };
    }

    // Determine environment and action type
    const env = getEnvironment(payload);
    const isStatusCheck = payload.action === 'check-status';
    const actionType = isStatusCheck ? 'status' : 'submit';
    
    // Get webhook URL
    const webhooks = WEBHOOKS[env];
    const webhookUrl = isStatusCheck ? webhooks.status : webhooks.submit;

    console.log(`[Router] Env: ${env}, Action: ${actionType}, Path: ${payload.path || payload.pageIdentifier}`);

    // Check if webhook is configured
    if (webhookUrl.startsWith('TODO_')) {
      return {
        statusCode: 503,
        body: {
          error: `Webhook not configured for ${env} environment`,
          environment: env,
          action: actionType,
          message: `Please configure the ${env} ${actionType} webhook URL in review-router.js`
        }
      };
    }

    // Forward to Fusion webhook with Basic Auth
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${CREDENTIALS}`
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
      body: {
        success: response.ok,
        environment: env,
        action: actionType,
        ...responseData
      }
    };

  } catch (error) {
    console.error('[Router] Error:', error.message);
    return { statusCode: 500, body: { error: error.message } };
  }
}

exports.main = main;
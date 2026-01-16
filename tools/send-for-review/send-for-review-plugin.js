/**
 * Send For Review - DA.live Library Plugin
 * Uses array methods instead of for...of to avoid regenerator-runtime requirement
 */

/* eslint-disable no-console */

const DEFAULT_WEBHOOK = 'https://hook.us2.make.com/d5lqgghlwlcalpy2zw0l7tqukr0u75bd';

/**
 * Get webhook URL from config hierarchy
 */
function getWebhookUrl() {
  if (typeof window !== 'undefined' && window.SFR_WEBHOOK_URL) {
    return window.SFR_WEBHOOK_URL;
  }
  return DEFAULT_WEBHOOK;
}

/**
 * Parse DA.live edit URL to extract context
 */
function parseDAUrl(url) {
  const daMatch = url.match(/da\.live\/edit#\/([^/]+)\/([^/]+)\/?(.*)$/);
  if (daMatch) {
    return {
      owner: daMatch[1],
      repo: daMatch[2],
      path: daMatch[3] || 'index',
      source: 'da.live',
    };
  }
  return null;
}

/**
 * Parse AEM page/live URL to extract context
 */
function parseAEMUrl(url) {
  try {
    const parsed = new URL(url);
    const aemMatch = parsed.host.match(/^([^-]+)--([^-]+)--([^.]+)\.aem\.(page|live)$/);
    if (aemMatch) {
      return {
        ref: aemMatch[1],
        repo: aemMatch[2],
        owner: aemMatch[3],
        path: parsed.pathname.replace(/^\//, '') || 'index',
        env: aemMatch[4],
        source: 'aem',
      };
    }
  } catch (e) {
    // Invalid URL
  }
  return null;
}

/**
 * Build minimal payload for library submission
 */
function buildLibraryPayload(context) {
  const {
    owner, repo, path, ref = 'main',
  } = context;

  const cleanPath = path.replace(/^\/+/, '');
  const name = cleanPath.split('/').filter(Boolean).pop() || 'index';

  const baseHost = `${ref}--${repo}--${owner}`;
  const previewUrl = `https://${baseHost}.aem.page/${cleanPath}`;
  const liveUrl = `https://${baseHost}.aem.live/${cleanPath}`;

  return {
    title: name,
    name,
    path: `/${cleanPath}`,
    previewUrl,
    liveUrl,
    reviewSubmissionDate: new Date().toISOString(),
    source: 'DA.live Library',
    org: owner,
    site: repo,
    ref,
  };
}

/**
 * Post to webhook
 */
async function postToWebhook(payload) {
  const webhookUrl = getWebhookUrl();

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }

  return response;
}

/**
 * Show notification in DA.live
 */
function showNotification(message, type = 'info') {
  // Try DA.live notification system
  if (typeof window !== 'undefined' && window.da?.notify) {
    window.da.notify(message, type);
    return;
  }

  // Fallback to console
  if (type === 'error') {
    console.error(`[Send For Review] ${message}`);
  } else {
    console.info(`[Send For Review] ${message}`);
  }
}

/**
 * Main plugin action handler
 * @param {Object} _event - Event object (unused but required by plugin interface)
 * @param {Object} context - DA.live context with page info
 */
async function handleAction(_event, context) {
  try {
    // Extract context from DA.live or URL
    let pageContext = context;

    if (!pageContext || !pageContext.repo) {
      // Try to parse from current URL
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      pageContext = parseDAUrl(currentUrl) || parseAEMUrl(currentUrl);
    }

    if (!pageContext) {
      showNotification('Could not determine page context', 'error');
      return;
    }

    showNotification('Sending for review...', 'info');

    const payload = buildLibraryPayload(pageContext);
    await postToWebhook(payload);

    showNotification('Review request submitted successfully!', 'success');
  } catch (error) {
    console.error('Send For Review error:', error);
    showNotification(`Failed to submit: ${error.message}`, 'error');
  }
}

/**
 * Plugin initialization
 * Called by DA.live when plugin is loaded
 */
function init(config) {
  // Store config if needed
  if (config?.webhookUrl) {
    if (typeof window !== 'undefined') {
      window.SFR_WEBHOOK_URL = config.webhookUrl;
    }
  }

  return {
    actions: {
      'send-for-review': handleAction,
    },
  };
}

// Default export for DA.live plugin system
export default init;

// Named exports for testing/direct usage
export {
  init,
  handleAction,
  buildLibraryPayload,
  postToWebhook,
  parseDAUrl,
  parseAEMUrl,
};

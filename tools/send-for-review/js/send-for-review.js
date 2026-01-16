/**
 * Send For Review - Comprehensive Page Analysis Tool
 * Generic solution for Sidekick and Library submissions
 */

/* eslint-disable no-console */

// ============================================
// CONFIGURATION
// ============================================
const DEFAULT_WEBHOOK = 'https://hook.us2.make.com/d5lqgghlwlcalpy2zw0l7tqukr0u75bd';

/**
 * Get webhook URL from config hierarchy
 * Priority: window.SFR_WEBHOOK_URL > meta tag > DEFAULT_WEBHOOK
 */
function getWebhookUrl() {
  // Check window variable first
  if (window.SFR_WEBHOOK_URL) {
    return window.SFR_WEBHOOK_URL;
  }

  // Check meta tag
  const metaWebhook = document.querySelector('meta[name="sfr:webhook"]');
  if (metaWebhook?.content) {
    return metaWebhook.content;
  }

  // Return default
  return DEFAULT_WEBHOOK;
}

// ============================================
// CONTEXT EXTRACTION
// ============================================

/**
 * Extract context from URL parameters and referrer
 */
function getContext() {
  const params = new URLSearchParams(window.location.search);

  // Get referrer URL for path extraction
  let refUrl = null;
  if (document.referrer) {
    try {
      refUrl = new URL(document.referrer);
    } catch (e) {
      // Invalid referrer URL
    }
  }

  // Parse host to extract org/site/ref
  const host = params.get('host') || refUrl?.host || '';
  const hostMatch = host.match(/^([^-]+)--([^-]+)--([^.]+)\.aem\.(page|live)$/);

  const ref = params.get('ref') || hostMatch?.[1] || 'main';
  const site = params.get('repo') || hostMatch?.[2] || '';
  const org = params.get('owner') || hostMatch?.[3] || '';
  const env = hostMatch?.[4] || 'page';

  return {
    ref,
    site,
    org,
    host,
    env,
    refUrl,
    isoNow: new Date().toISOString(),
  };
}

// ============================================
// PAGE ANALYSIS FUNCTIONS
// ============================================

/**
 * Analyze content metrics
 */
function analyzeContent(doc) {
  const main = doc.querySelector('main') || doc.body;
  const text = main.textContent || '';

  // Clean text for analysis
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  const sentences = cleanText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = main.querySelectorAll('p');

  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgWordsPerSentence = sentenceCount > 0
    ? Math.round(wordCount / sentenceCount)
    : 0;

  return {
    wordCount,
    characterCount: cleanText.length,
    characterCountNoSpaces: cleanText.replace(/\s/g, '').length,
    sentenceCount,
    paragraphCount: paragraphs.length,
    avgWordsPerSentence,
    readingTimeMinutes: Math.ceil(wordCount / 200),
  };
}

/**
 * Analyze heading structure
 */
function analyzeHeadings(doc) {
  const headings = [];
  const counts = {
    h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0,
  };
  const issues = [];

  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const level = parseInt(h.tagName.charAt(1), 10);
    const tag = h.tagName.toLowerCase();
    counts[tag] += 1;

    headings.push({
      level,
      tag,
      text: h.textContent?.trim() || '',
      id: h.id || '',
    });
  });

  // Validation
  if (counts.h1 === 0) {
    issues.push('Missing H1 heading');
  } else if (counts.h1 > 1) {
    issues.push(`Multiple H1 headings found (${counts.h1})`);
  }

  // Check for skipped levels
  let lastLevel = 0;
  headings.forEach((h) => {
    if (h.level > lastLevel + 1 && lastLevel > 0) {
      issues.push(`Skipped heading level: H${lastLevel} to H${h.level}`);
    }
    lastLevel = h.level;
  });

  return {
    headings,
    counts,
    total: headings.length,
    issues,
    isValid: issues.length === 0,
  };
}

/**
 * Analyze EDS blocks
 */
function analyzeBlocks(doc) {
  const sections = doc.querySelectorAll('main > div');
  const blocks = [];
  const blockSummary = {};

  sections.forEach((section, sectionIndex) => {
    section.querySelectorAll(':scope > div[class]').forEach((block) => {
      const classes = Array.from(block.classList);
      const name = classes[0] || 'unknown';
      const variants = classes.slice(1);

      // Get content preview
      const textContent = block.textContent?.trim() || '';
      const contentPreview = textContent.length > 100
        ? `${textContent.substring(0, 100)}...`
        : textContent;

      blocks.push({
        name,
        section: sectionIndex + 1,
        variants,
        contentPreview,
      });

      // Count occurrences
      blockSummary[name] = (blockSummary[name] || 0) + 1;
    });
  });

  return {
    totalBlocks: blocks.length,
    totalSections: sections.length,
    blocks,
    blockNames: [...new Set(blocks.map((b) => b.name))],
    blockSummary,
  };
}

/**
 * Analyze SEO metadata
 */
function analyzeSEO(doc) {
  const issues = [];

  // Title
  const titleEl = doc.querySelector('title');
  const title = titleEl?.textContent?.trim() || '';
  const titleLength = title.length;

  if (!title) {
    issues.push('Missing page title');
  } else if (titleLength < 30) {
    issues.push('Title too short (< 30 chars)');
  } else if (titleLength > 60) {
    issues.push('Title too long (> 60 chars)');
  }

  // Meta description
  const metaDesc = doc.querySelector('meta[name="description"]');
  const description = metaDesc?.content?.trim() || '';
  const descLength = description.length;

  if (!description) {
    issues.push('Missing meta description');
  } else if (descLength < 120) {
    issues.push('Meta description too short (< 120 chars)');
  } else if (descLength > 160) {
    issues.push('Meta description too long (> 160 chars)');
  }

  // Canonical
  const canonical = doc.querySelector('link[rel="canonical"]')?.href || '';
  if (!canonical) {
    issues.push('Missing canonical URL');
  }

  // Robots
  const robots = doc.querySelector('meta[name="robots"]')?.content || '';

  // Language
  const lang = doc.documentElement.lang || '';
  if (!lang) {
    issues.push('Missing lang attribute');
  }

  return {
    title: { content: title, length: titleLength },
    metaDescription: { content: description, length: descLength },
    canonical,
    robots,
    lang,
    issues,
  };
}

/**
 * Calculate Open Graph score
 */
function calculateOGScore(hasSocialMeta, issueCount) {
  if (!hasSocialMeta) {
    return 0;
  }
  if (issueCount === 0) {
    return 100;
  }
  return 50;
}

/**
 * Analyze Open Graph and social meta
 */
function analyzeOpenGraph(doc) {
  const og = {};
  const twitter = {};
  const issues = [];

  // Open Graph
  doc.querySelectorAll('meta[property^="og:"]').forEach((meta) => {
    const prop = meta.getAttribute('property').replace('og:', '');
    og[prop] = meta.content;
  });

  // Twitter
  doc.querySelectorAll('meta[name^="twitter:"]').forEach((meta) => {
    const name = meta.getAttribute('name').replace('twitter:', '');
    twitter[name] = meta.content;
  });

  // Validation
  if (!og.title) issues.push('Missing og:title');
  if (!og.description) issues.push('Missing og:description');
  if (!og.image) issues.push('Missing og:image');

  const hasSocialMeta = Object.keys(og).length > 0 || Object.keys(twitter).length > 0;
  const score = calculateOGScore(hasSocialMeta, issues.length);

  return {
    openGraph: og,
    twitter,
    issues,
    score,
    hasSocialMeta,
  };
}

/**
 * Analyze accessibility
 */
function analyzeAccessibility(doc) {
  const images = doc.querySelectorAll('img');
  let withAlt = 0;
  let withoutAlt = 0;
  let decorative = 0;

  images.forEach((img) => {
    const alt = img.getAttribute('alt');
    if (alt === '') {
      decorative += 1;
    } else if (alt) {
      withAlt += 1;
    } else {
      withoutAlt += 1;
    }
  });

  const totalImages = images.length;
  const altCoveragePercent = totalImages > 0
    ? Math.round(((withAlt + decorative) / totalImages) * 100)
    : 100;

  const ariaLabels = doc.querySelectorAll('[aria-label]').length;
  const ariaRoles = doc.querySelectorAll('[role]').length;

  const issues = [];
  if (withoutAlt > 0) issues.push(`${withoutAlt} images missing alt text`);
  if (altCoveragePercent < 100) issues.push('Not all images have alt attributes');

  const score = altCoveragePercent;

  return {
    images: {
      total: totalImages,
      withAlt,
      withoutAlt,
      decorative,
      altCoveragePercent,
    },
    aria: {
      labels: ariaLabels,
      roles: ariaRoles,
    },
    issues,
    score,
  };
}

/**
 * Analyze links
 */
function analyzeLinks(doc) {
  const links = doc.querySelectorAll('a[href]');
  let internal = 0;
  let external = 0;
  let mailto = 0;
  let tel = 0;
  const externalLinks = [];

  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    if (href.startsWith('mailto:')) {
      mailto += 1;
    } else if (href.startsWith('tel:')) {
      tel += 1;
    } else if (href.startsWith('http') && !href.includes(window.location.host)) {
      external += 1;
      externalLinks.push({
        href,
        text: link.textContent?.trim() || '',
      });
    } else {
      internal += 1;
    }
  });

  const buttons = doc.querySelectorAll('button, a.button, .button').length;

  return {
    total: links.length,
    internal,
    external,
    buttons,
    mailto,
    tel,
    externalLinks,
  };
}

/**
 * Analyze interactive elements
 */
function analyzeInteractiveElements(doc) {
  return {
    forms: doc.querySelectorAll('form').length,
    buttons: doc.querySelectorAll('button').length,
    inputs: doc.querySelectorAll('input, textarea, select').length,
    videos: doc.querySelectorAll('video').length,
    iframes: doc.querySelectorAll('iframe').length,
  };
}

/**
 * Collect analytics context
 */
function collectAnalytics() {
  const now = new Date();
  return {
    timestamp: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screen: {
      width: window.screen?.width || 0,
      height: window.screen?.height || 0,
      colorDepth: window.screen?.colorDepth || 0,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}

// ============================================
// USER IDENTIFICATION
// ============================================

/**
 * Get submitter email from various sources
 * Tries multiple methods to identify the current user
 */
function getSubmitterEmail() {
  // Method 1: Adobe IMS (if available)
  if (window.adobeIMS?.getUserProfile) {
    try {
      const profile = window.adobeIMS.getUserProfile();
      if (profile?.email) return profile.email;
    } catch (e) {
      // IMS not available or error
    }
  }

  // Method 2: Check adobeIMS async profile
  if (window.adobeIMS?.getProfile) {
    try {
      const profile = window.adobeIMS.getProfile();
      if (profile?.email) return profile.email;
    } catch (e) {
      // Profile not available
    }
  }

  // Method 3: Check for DA.live user context
  if (window.da?.user?.email) {
    return window.da.user.email;
  }

  // Method 4: Check parent window (when in iframe)
  try {
    if (window.parent !== window) {
      if (window.parent.adobeIMS?.getUserProfile) {
        const profile = window.parent.adobeIMS.getUserProfile();
        if (profile?.email) return profile.email;
      }
      if (window.parent.da?.user?.email) {
        return window.parent.da.user.email;
      }
    }
  } catch (e) {
    // Cross-origin access blocked
  }

  // Method 5: Check top window
  try {
    if (window.top !== window) {
      if (window.top.adobeIMS?.getUserProfile) {
        const profile = window.top.adobeIMS.getUserProfile();
        if (profile?.email) return profile.email;
      }
      if (window.top.da?.user?.email) {
        return window.top.da.user.email;
      }
    }
  } catch (e) {
    // Cross-origin access blocked
  }

  // Method 6: Check localStorage for cached user
  try {
    const cachedUser = localStorage.getItem('adobeid_ims_profile');
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser);
      if (parsed?.email) return parsed.email;
    }
  } catch (e) {
    // localStorage not available or parse error
  }

  return 'unknown';
}

// ============================================
// PAYLOAD BUILDING
// ============================================

/**
 * Build full payload with comprehensive analysis
 */
async function buildPayload(ctx, notes = '') {
  const {
    ref, site, org, host, isoNow, env, refUrl,
  } = ctx;

  const refPath = refUrl?.pathname || window.location.pathname || '';
  const cleanPath = refPath.replace(/^\/+/, '');
  const name = (cleanPath.split('/').filter(Boolean).pop() || 'index')
    .replace(/\.[^.]+$/, '');

  // Construct URLs
  const baseHost = `${ref}--${site}--${org}`;
  const previewUrl = `https://${baseHost}.aem.page/${cleanPath}`;
  const liveUrl = `https://${baseHost}.aem.live/${cleanPath}`;

  // Fetch page for analysis
  let doc = document;
  try {
    const response = await fetch(previewUrl);
    if (response.ok) {
      const html = await response.text();
      const parser = new DOMParser();
      doc = parser.parseFromString(html, 'text/html');
    }
  } catch (e) {
    console.warn('Could not fetch page for analysis, using current document');
  }

  // Get page title
  const pageTitle = doc.querySelector('title')?.textContent?.trim()
    || doc.querySelector('h1')?.textContent?.trim()
    || name;

  // Run all analysis
  const contentMetrics = analyzeContent(doc);
  const headingStructure = analyzeHeadings(doc);
  const blocks = analyzeBlocks(doc);
  const seo = analyzeSEO(doc);
  const openGraph = analyzeOpenGraph(doc);
  const accessibility = analyzeAccessibility(doc);
  const links = analyzeLinks(doc);
  const interactiveElements = analyzeInteractiveElements(doc);
  const analytics = collectAnalytics();

  return {
    // Basic Info
    title: pageTitle,
    name,
    path: `/${cleanPath}`,
    url: liveUrl,
    previewUrl,
    liveUrl,
    reviewSubmissionDate: isoNow,
    submittedBy: getSubmitterEmail(),

    // Environment
    host,
    env,
    org,
    site,
    ref,
    source: 'DA.live',

    // Analysis Results
    contentMetrics,
    headingStructure,
    blocks,
    seo,
    openGraph,
    accessibility,
    links,
    interactiveElements,
    analytics,

    // Notes
    notes: notes || '',
  };
}

// ============================================
// WEBHOOK SUBMISSION
// ============================================

/**
 * Post payload to webhook
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
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

// ============================================
// FORWARD DECLARATIONS FOR CIRCULAR REFERENCES
// ============================================

// These will be assigned after function definitions
let renderCard;

// ============================================
// DIALOG AND SUBMISSION HANDLERS
// (Must be defined before renderCard uses them)
// ============================================

/**
 * Submit review with optional notes
 */
const handleSubmitReview = async function handleSubmitReviewFn(notes = '') {
  renderCard({ status: 'loading', message: 'Submitting review request…' });

  try {
    const ctx = getContext();
    const payload = await buildPayload(ctx, notes);
    await postToWebhook(payload);

    renderCard({
      status: 'in-progress',
      message: 'Review request submitted successfully. Review in progress.',
      payload,
    });
  } catch (error) {
    console.error('Submit error:', error);
    renderCard({
      status: 'error',
      message: `Failed to submit review: ${error.message}`,
    });
  }
};

/**
 * Show notes dialog for resubmission
 */
const handleShowNotesDialog = function handleShowNotesDialogFn() {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog">
      <h3>Add Notes (Optional)</h3>
      <textarea id="notes-input" placeholder="Enter any additional notes for this review submission..." rows="4"></textarea>
      <div class="dialog-actions">
        <button id="cancel-btn" class="btn btn-secondary">Cancel</button>
        <button id="submit-btn" class="btn btn-primary">Submit</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
    });
  }

  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const notesInput = document.getElementById('notes-input');
      const notesValue = notesInput ? notesInput.value.trim() : '';
      overlay.remove();
      await handleSubmitReview(notesValue);
    });
  }
};

// ============================================
// UI RENDERING
// ============================================

/**
 * Get SEO issues display text
 */
function getSeoIssuesText(issues) {
  if (issues.length === 0) {
    return 'None';
  }
  return issues.join(', ');
}

/**
 * Get SEO issues CSS class
 */
function getSeoIssuesClass(issues) {
  if (issues.length > 0) {
    return 'warning';
  }
  return 'success';
}

/**
 * Render the card UI
 */
renderCard = function renderCardFn({ status, message, payload }) {
  const details = document.getElementById('details');
  if (!details) return;

  let content = '';
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const inProgress = status === 'in-progress';

  if (isLoading) {
    content = `
      <div class="notice">
        <div class="spinner"></div>
        <p class="status-message loading">${message}</p>
      </div>
    `;
  } else if (isError) {
    content = `
      <div class="notice">
        <p class="status-message error">${message}</p>
        <button id="retry-btn" class="btn btn-primary">Retry</button>
      </div>
    `;
  } else {
    // Success or In-Progress
    const seoClass = getSeoIssuesClass(payload.seo.issues);
    const seoText = getSeoIssuesText(payload.seo.issues);
    const notesHtml = payload.notes ? `
        <div class="detail-row full-width">
          <span class="label">Notes:</span>
          <span class="value">${payload.notes}</span>
        </div>
        ` : '';
    const sendAgainBtn = inProgress ? '<button id="resubmit-btn" class="btn btn-primary">Send Again</button>' : '';

    // Format submission date
    const submissionDate = new Date(payload.reviewSubmissionDate).toLocaleString();

    content = `
      <p class="status-message success">${message}</p>
      <div class="page-details">
        <div class="detail-row">
          <span class="label">Title:</span>
          <span class="value">${payload.title}</span>
        </div>
        <div class="detail-row">
          <span class="label">Name:</span>
          <span class="value">${payload.name}</span>
        </div>
        <div class="detail-row">
          <span class="label">Submitter:</span>
          <span class="value">${payload.submittedBy}</span>
        </div>
        <div class="detail-row">
          <span class="label">Submission Date:</span>
          <span class="value">${submissionDate}</span>
        </div>
        <div class="detail-row">
          <span class="label">SEO Issues:</span>
          <span class="value ${seoClass}">${seoText}</span>
        </div>
        <div class="detail-row">
          <span class="label">Blocks:</span>
          <span class="value">${payload.blocks.totalBlocks} (${payload.blocks.blockNames.join(', ')})</span>
        </div>
        ${notesHtml}
      </div>
      <div class="actions">
        <a href="${payload.previewUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
          View Preview
        </a>
        ${sendAgainBtn}
      </div>
    `;
  }

  details.innerHTML = `
    <div id="review-card">
      <div class="header-bar">
        <img src="./assets/agilent-logo.png" alt="Agilent Logo" class="logo" />
        <span class="header-title">Send For Review</span>
      </div>
      <div class="content">${content}</div>
    </div>
  `;

  // Attach event listeners
  if (status === 'error') {
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  if (status === 'in-progress') {
    const resubmitBtn = document.getElementById('resubmit-btn');
    if (resubmitBtn) {
      resubmitBtn.addEventListener('click', handleShowNotesDialog);
    }
  }
};

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the tool
 */
async function init() {
  await handleSubmitReview();
}

// Start on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================
// EXPORTS
// ============================================

/**
 * Default export for module usage
 */
export default {
  init,
  getContext,
  buildPayload,
  postToWebhook,
  analyzeContent,
  analyzeHeadings,
  analyzeBlocks,
  analyzeSEO,
  analyzeOpenGraph,
  analyzeAccessibility,
  analyzeLinks,
  analyzeInteractiveElements,
};

// Named exports
export {
  init,
  getContext,
  buildPayload,
  postToWebhook,
  analyzeContent,
  analyzeHeadings,
  analyzeBlocks,
  analyzeSEO,
  analyzeOpenGraph,
  analyzeAccessibility,
  analyzeLinks,
  analyzeInteractiveElements,
};

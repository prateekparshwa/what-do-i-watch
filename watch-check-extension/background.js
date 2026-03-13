/**
 * Service worker for "Should I Watch This?" extension.
 * Handles OMDb API calls, caching, and threshold evaluation.
 */

const CACHE_PREFIX = 'rating_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Default thresholds — overridden by user settings
const DEFAULT_IMDB_MIN = 7.3;
const DEFAULT_RT_MIN = 70;

/**
 * Normalize a title for cache keying: lowercase, alphanumeric only.
 */
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Get user-configured thresholds from storage, falling back to defaults.
 */
async function getThresholds() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['imdbMin', 'rtMin'], (result) => {
      resolve({
        imdbMin: result.imdbMin != null ? result.imdbMin : DEFAULT_IMDB_MIN,
        rtMin: result.rtMin != null ? result.rtMin : DEFAULT_RT_MIN
      });
    });
  });
}

/**
 * Get API key from sync storage.
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['omdbApiKey'], (result) => {
      resolve(result.omdbApiKey || null);
    });
  });
}

/**
 * Check cache for a title. Returns cached data if valid, null otherwise.
 */
async function getCached(normalizedTitle) {
  const key = CACHE_PREFIX + normalizedTitle;
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      const entry = result[key];
      if (!entry) {
        resolve(null);
        return;
      }
      // Check TTL
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        chrome.storage.local.remove([key]);
        resolve(null);
        return;
      }
      resolve(entry);
    });
  });
}

/**
 * Store a result in cache.
 */
async function setCache(normalizedTitle, data) {
  const key = CACHE_PREFIX + normalizedTitle;
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [key]: { ...data, timestamp: Date.now() }
    }, resolve);
  });
}

/**
 * Parse Rotten Tomatoes score from OMDb Ratings array.
 * Returns integer (e.g., 94) or null if not found.
 */
function parseRTScore(ratings) {
  if (!Array.isArray(ratings)) return null;
  const rt = ratings.find(r => r.Source === 'Rotten Tomatoes');
  if (!rt) return null;
  const match = rt.Value.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Fetch ratings from OMDb API.
 */
async function fetchFromOMDb(title, apiKey) {
  const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${apiKey}`;
  console.log(`[SIWT-BG] Fetching: ${url}`);
  try {
    const response = await fetch(url);
    console.log(`[SIWT-BG] Response status for "${title}": ${response.status}`);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OMDb API returned ${response.status}: ${body}`);
    }
    const data = await response.json();
    console.log(`[SIWT-BG] Data for "${title}":`, JSON.stringify(data).substring(0, 200));
    return data;
  } catch (err) {
    console.error(`[SIWT-BG] Fetch failed for "${title}":`, err.message);
    throw err;
  }
}

/**
 * Main handler: get ratings for a title, using cache when possible.
 */
async function getRatings(title) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { error: 'no_api_key' };
  }

  const normalized = normalizeTitle(title);

  // Check cache first
  const cached = await getCached(normalized);
  if (cached) {
    // Re-evaluate threshold with current settings (user may have changed them)
    const thresholds = await getThresholds();
    if (cached.notFound) {
      return { meetsThreshold: false, notFound: true, title };
    }
    if (cached.imdbRating === null) {
      return { meetsThreshold: false, imdbRating: null, rtScore: cached.rtScore, title };
    }
    const imdbPasses = cached.imdbRating >= thresholds.imdbMin;
    const rtPasses = cached.rtScore === null || cached.rtScore >= thresholds.rtMin;
    const meetsThreshold = imdbPasses && rtPasses;
    return {
      meetsThreshold,
      imdbRating: cached.imdbRating,
      rtScore: cached.rtScore,
      title
    };
  }

  // Cache miss — call API
  try {
    const data = await fetchFromOMDb(title, apiKey);

    if (data.Response === 'False') {
      // Title not found in OMDb — cache as "not found"
      await setCache(normalized, { notFound: true });
      return { meetsThreshold: false, notFound: true, title };
    }

    const imdbRating = parseFloat(data.imdbRating);
    const rtScore = parseRTScore(data.Ratings);

    // Cache the scores (even if partial)
    await setCache(normalized, {
      notFound: false,
      imdbRating: isNaN(imdbRating) ? null : imdbRating,
      rtScore: rtScore
    });

    // If IMDB is missing entirely, can't evaluate — no badge
    if (isNaN(imdbRating)) {
      return { meetsThreshold: false, imdbRating: null, rtScore, title };
    }

    // Evaluate threshold:
    // - IMDB must always pass
    // - RT must pass only if available (many TV shows / regional titles lack RT scores)
    const thresholds = await getThresholds();
    const imdbPasses = imdbRating >= thresholds.imdbMin;
    const rtPasses = rtScore === null || rtScore >= thresholds.rtMin;
    const meetsThreshold = imdbPasses && rtPasses;

    return { meetsThreshold, imdbRating, rtScore, title };
  } catch (err) {
    return { error: 'api_failure', message: err.message, title };
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_RATINGS') {
    getRatings(message.title).then(sendResponse);
    return true; // Keep message channel open for async response
  }
});

/* eslint-disable no-unused-vars */
/**
 * Platform configuration for "Should I Watch This?" extension.
 * This is the most frequently updated file — selectors may need
 * adjustment as OTT platforms change their DOM.
 */

const SIWT_CONFIG = {
  // Default thresholds (overridden by user settings in chrome.storage.sync)
  IMDB_MIN: 7.3,
  RT_MIN: 70,

  // Cache TTL: 7 days in milliseconds
  CACHE_TTL_MS: 7 * 24 * 60 * 60 * 1000,

  // Badge marker attribute — prevents re-processing the same card
  BADGE_ATTR: 'data-siwt-checked',

  // Debounce interval for MutationObserver (ms)
  DEBOUNCE_MS: 500,

  // Initial delay before first scan (SPA hydration time)
  INITIAL_DELAY_MS: 2000,

  PLATFORMS: {
    netflix: {
      hostPattern: /netflix\.com/,
      cardSelectors: [
        '.title-card-container',
        '.slider-item',
        '.ptrack-content',
        '[data-uia="title-card"]'
      ],
      titleExtractors: [
        (card) => {
          const img = card.querySelector('img[alt]');
          return img ? img.getAttribute('alt') : null;
        },
        (card) => {
          const link = card.querySelector('a[aria-label]');
          return link ? link.getAttribute('aria-label') : null;
        },
        (card) => {
          const fallback = card.querySelector('.fallback-text');
          return fallback ? fallback.textContent.trim() : null;
        }
      ]
    },

    primevideo: {
      hostPattern: /primevideo\.com|amazon\.com\/gp\/video/,
      cardSelectors: [
        '[data-testid="card"]',
        'article',
        '[class*="TitleCard"]',
        '[class*="packshot"]'
      ],
      titleExtractors: [
        (card) => {
          const img = card.querySelector('img[alt]');
          return img ? img.getAttribute('alt') : null;
        },
        (card) => {
          const span = card.querySelector('.av-hover-title span');
          return span ? span.textContent.trim() : null;
        },
        (card) => {
          const aria = card.querySelector('[aria-label]');
          return aria ? aria.getAttribute('aria-label') : null;
        }
      ]
    },

    hotstar: {
      hostPattern: /hotstar\.com/,
      cardSelectors: [
        '[class*="cardContainer"]',
        '[class*="ContentCard"]',
        '[class*="card-container"]',
        '[class*="content-card"]'
      ],
      titleExtractors: [
        (card) => {
          const img = card.querySelector('img[alt]');
          return img ? img.getAttribute('alt') : null;
        },
        (card) => {
          const titleEl = card.querySelector('[class*="title"]');
          return titleEl ? titleEl.textContent.trim() : null;
        }
      ]
    },

    zee5: {
      hostPattern: /zee5\.com/,
      cardSelectors: [
        '[class*="card"]',
        '[class*="movieCard"]',
        '[class*="content-card"]',
        '[class*="slide-item"]'
      ],
      titleExtractors: [
        (card) => {
          const img = card.querySelector('img[alt]');
          return img ? img.getAttribute('alt') : null;
        },
        (card) => {
          const titleEl = card.querySelector('[class*="title"]');
          return titleEl ? titleEl.textContent.trim() : null;
        }
      ]
    },

    sonyliv: {
      hostPattern: /sonyliv\.com/,
      cardSelectors: [
        '[class*="card"]',
        '[class*="content-card"]',
        '[class*="movieCard"]',
        '[class*="slide-item"]'
      ],
      titleExtractors: [
        (card) => {
          const img = card.querySelector('img[alt]');
          return img ? img.getAttribute('alt') : null;
        },
        (card) => {
          const titleEl = card.querySelector('[class*="title"]');
          return titleEl ? titleEl.textContent.trim() : null;
        }
      ]
    }
  }
};

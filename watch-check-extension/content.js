/**
 * Content script for "Should I Watch This?" extension.
 *
 * Two strategies for finding titles:
 * 1. img[alt] — works on most platforms (Hotstar, Zee5, SonyLIV, Prime)
 * 2. a[aria-label] — works on Netflix (where base cards use CSS backgrounds, not img tags)
 *
 * On qualifying cards: green badge at top-right + permanent score bar at bottom.
 */
(function () {
  'use strict';

  const CONFIG = typeof SIWT_CONFIG !== 'undefined' ? SIWT_CONFIG : null;
  if (!CONFIG) {
    console.warn('[SIWT] Config not loaded');
    return;
  }

  console.log('[SIWT] Content script loaded on', window.location.hostname);

  const isNetflix = /netflix\.com/.test(window.location.hostname);

  // Track processed elements
  const processedElements = new WeakSet();

  // API request deduplication and result caching
  const pendingTitles = new Set();
  const localResultCache = new Map();
  const waitingElements = new Map();

  const SKIP_PATTERNS = [
    /^(logo|icon|avatar|profile|banner|background|poster|thumbnail|image|loading|close|back|menu|search|home|notification)/i,
    /^(get it on|download on|available on|install|sign in|sign up|subscribe|upgrade)/i,
    /^(play store|app store|google play|apple|android|ios)/i,
    /^(facebook|twitter|instagram|youtube|whatsapp|telegram|linkedin)/i,
    /^(share|like|comment|follow|subscribe|bell|notification)/i,
    /\.(png|jpg|jpeg|svg|gif|webp)$/i,
    /^(more info|play|watch now|trailer|new episode|my list|audio description)/i,
  ];

  function cleanTitle(raw) {
    if (!raw) return null;
    let title = raw.trim();
    if (title.length < 2 || title.length > 80) return null;
    for (const pattern of SKIP_PATTERNS) {
      if (pattern.test(title)) return null;
    }
    title = title
      .replace(/\s*[-–|:]\s*(hindi|tamil|telugu|kannada|malayalam|bengali|marathi|punjabi|english|spanish|german|french|japanese|korean|dubbed|subtitled|original|trailer|teaser)\s*$/i, '')
      .replace(/\s*[-–|]\s*(watch|stream|play|available)\s.*/i, '')
      .replace(/\s*\((\d{4})\)\s*$/, '')
      .replace(/\s*[-–|]\s*season\s*\d+.*$/i, '')
      .replace(/\s*S\d+\s*$/i, '')
      .trim();
    if (title.length < 2) return null;
    return title;
  }

  function normalizeTitle(title) {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Track which cards we've already badged (by DOM element)
  const badgedCards = new WeakSet();

  /**
   * Inject badge (top-right checkmark) + permanent score bar (bottom) on a card.
   * One badge per card element. Also checks ancestors to avoid duplicates in popups.
   */
  function injectBadge(card, imdbRating, rtScore, title) {
    if (!card || !document.contains(card)) return;

    // Skip if this specific card element already has our badge
    if (badgedCards.has(card)) return;
    if (card.querySelector('.siwt-badge')) return;

    // Skip if any ancestor already has our badge (multiple images in same popup)
    let ancestor = card.parentElement;
    for (let i = 0; i < 6 && ancestor && ancestor !== document.body; i++) {
      if (ancestor.querySelector(':scope > .siwt-badge') || badgedCards.has(ancestor)) return;
      ancestor = ancestor.parentElement;
    }

    badgedCards.add(card);

    // Ensure positioning context
    const pos = window.getComputedStyle(card).position;
    if (pos === 'static') {
      card.style.position = 'relative';
    }

    // --- Green badge (top-right) ---
    const badge = document.createElement('div');
    badge.className = 'siwt-badge';
    badge.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    card.appendChild(badge);

    // --- Permanent score bar (bottom) ---
    const scoreBar = document.createElement('div');
    scoreBar.className = 'siwt-score-bar';
    scoreBar.setAttribute('data-siwt-title', title || '');

    const imdbText = `IMDB ${imdbRating}`;
    const rtText = rtScore != null ? ` · RT ${rtScore}%` : '';
    scoreBar.textContent = imdbText + rtText;

    card.appendChild(scoreBar);
  }

  /**
   * Send rating request and badge card on success.
   */
  function fetchAndBadge(card, title) {
    const normalized = normalizeTitle(title);

    if (localResultCache.has(normalized)) {
      const cached = localResultCache.get(normalized);
      if (cached.meetsThreshold) {
        injectBadge(card, cached.imdbRating, cached.rtScore, title);
      }
      return;
    }

    if (!waitingElements.has(normalized)) waitingElements.set(normalized, []);
    waitingElements.get(normalized).push(card);

    if (pendingTitles.has(normalized)) return;
    pendingTitles.add(normalized);

    chrome.runtime.sendMessage(
      { type: 'GET_RATINGS', title },
      (response) => {
        pendingTitles.delete(normalized);

        if (chrome.runtime.lastError) {
          waitingElements.delete(normalized);
          return;
        }

        if (!response || response.error) {
          waitingElements.delete(normalized);
          return;
        }

        localResultCache.set(normalized, response);

        const cards = waitingElements.get(normalized) || [];
        if (response.meetsThreshold) {
          cards.forEach((c) => injectBadge(c, response.imdbRating, response.rtScore, title));
          console.log(`[SIWT] PASS: "${title}" (IMDB: ${response.imdbRating}, RT: ${response.rtScore != null ? response.rtScore + '%' : 'N/A'})`);
        } else {
          console.log(`[SIWT] FAIL: "${title}" (IMDB: ${response.imdbRating}, RT: ${response.rtScore != null ? response.rtScore + '%' : 'N/A'})`);
        }
        waitingElements.delete(normalized);
      }
    );
  }

  // =====================================================
  // Strategy 1: img[alt] — for Hotstar, Zee5, SonyLIV, Prime
  // =====================================================
  function scanImages() {
    const images = document.querySelectorAll('img[alt]');
    let processed = 0;
    images.forEach((img) => {
      // Fast bail — skip already processed (no layout cost)
      if (processedElements.has(img)) return;

      // Fast bail — skip empty alt (no layout cost)
      const alt = img.getAttribute('alt');
      if (!alt || alt.trim().length === 0) {
        processedElements.add(img);
        return;
      }

      const title = cleanTitle(alt);
      if (!title) {
        processedElements.add(img);
        return;
      }

      // Only now check size (triggers layout)
      const rect = img.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) return;
      if (rect.top > window.innerHeight * 3) return;

      processedElements.add(img);

      // Walk up from image to find the card container
      let card = img.parentElement;
      if (!card) return;
      let el = card;
      for (let i = 0; i < 5 && el && el !== document.body; i++) {
        const r = el.getBoundingClientRect();
        if (r.width >= rect.width && r.width < 500 && r.height > 80) {
          card = el;
          break;
        }
        el = el.parentElement;
      }

      fetchAndBadge(card, title);
      processed++;
    });
    if (processed > 0) console.log(`[SIWT] Scanned ${processed} new images`);
  }

  // =====================================================
  // Strategy 2: a[aria-label] — for Netflix
  // =====================================================
  function scanNetflixCards() {
    const links = document.querySelectorAll('a[aria-label]');
    let processed = 0;

    links.forEach((link) => {
      if (processedElements.has(link)) return;

      const rect = link.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 40) return;
      if (rect.top > window.innerHeight * 3) return;

      const label = link.getAttribute('aria-label');
      if (!label || label.trim().length === 0) return;

      const title = cleanTitle(label);
      if (!title) return;

      processedElements.add(link);

      let card = link;
      let el = link.parentElement;
      for (let i = 0; i < 4 && el && el !== document.body; i++) {
        const r = el.getBoundingClientRect();
        if (r.width > 80 && r.width < 500 && r.height > 80) {
          card = el;
        }
        el = el.parentElement;
      }

      fetchAndBadge(card, title);
      processed++;
    });

    if (processed > 0) console.log(`[SIWT] Scanned ${processed} new Netflix cards`);
  }

  function scanPage() {
    if (isNetflix) {
      scanNetflixCards();
    }
    scanImages();
  }

  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  const slowScan = debounce(scanPage, 800);

  /**
   * Check if a mutation actually added elements we care about
   * (images or links), so we can skip irrelevant DOM churn.
   */
  function mutationHasRelevantNodes(mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue; // Not an element
        // Check if the added node is or contains an img or link
        if (node.tagName === 'IMG' || node.tagName === 'A') return true;
        if (node.querySelector && (node.querySelector('img[alt]') || node.querySelector('a[aria-label]'))) return true;
      }
    }
    return false;
  }

  setTimeout(() => {
    console.log('[SIWT] Starting initial scan...');
    scanPage();

    const observer = new MutationObserver((mutations) => {
      if (mutationHasRelevantNodes(mutations)) {
        // New images/links added — scan quickly (popup opening, new cards loaded)
        // Use requestAnimationFrame for smooth timing without blocking UI
        requestAnimationFrame(() => scanPage());
      } else {
        // Background DOM churn — use slow scan
        slowScan();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('scroll', () => slowScan(), { passive: true });
  }, CONFIG.INITIAL_DELAY_MS);
})();

/**
 * Popup logic for "Should I Watch This?" extension.
 * Manages API key, threshold sliders, and cache stats.
 */
(function () {
  'use strict';

  const CACHE_PREFIX = 'rating_';

  const apiKeyInput = document.getElementById('apiKey');
  const imdbSlider = document.getElementById('imdbSlider');
  const imdbValue = document.getElementById('imdbValue');
  const rtSlider = document.getElementById('rtSlider');
  const rtValue = document.getElementById('rtValue');
  const saveBtn = document.getElementById('saveBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const cacheCount = document.getElementById('cacheCount');
  const statusMsg = document.getElementById('statusMsg');

  // Update slider display values in real time
  imdbSlider.addEventListener('input', () => {
    imdbValue.textContent = parseFloat(imdbSlider.value).toFixed(1);
  });

  rtSlider.addEventListener('input', () => {
    rtValue.textContent = rtSlider.value;
  });

  /**
   * Load saved settings into the UI.
   */
  function loadSettings() {
    chrome.storage.sync.get(['omdbApiKey', 'imdbMin', 'rtMin'], (result) => {
      if (result.omdbApiKey) {
        apiKeyInput.value = result.omdbApiKey;
      }
      if (result.imdbMin != null) {
        imdbSlider.value = result.imdbMin;
        imdbValue.textContent = parseFloat(result.imdbMin).toFixed(1);
      }
      if (result.rtMin != null) {
        rtSlider.value = result.rtMin;
        rtValue.textContent = result.rtMin;
      }
    });
  }

  /**
   * Count cached titles.
   */
  function updateCacheStats() {
    chrome.storage.local.get(null, (items) => {
      const count = Object.keys(items).filter(k => k.startsWith(CACHE_PREFIX)).length;
      cacheCount.textContent = `${count} title${count !== 1 ? 's' : ''} cached`;
    });
  }

  /**
   * Show a temporary status message.
   */
  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = `status ${type}`;
    statusMsg.hidden = false;
    setTimeout(() => {
      statusMsg.hidden = true;
    }, 2500);
  }

  // Save settings
  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('API key is required', 'error');
      return;
    }

    chrome.storage.sync.set({
      omdbApiKey: apiKey,
      imdbMin: parseFloat(imdbSlider.value),
      rtMin: parseInt(rtSlider.value, 10)
    }, () => {
      showStatus('Settings saved!', 'success');
    });
  });

  // Clear cache (only rating_ keys)
  clearCacheBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(k => k.startsWith(CACHE_PREFIX));
      if (keysToRemove.length === 0) {
        showStatus('Cache is already empty', 'success');
        return;
      }
      chrome.storage.local.remove(keysToRemove, () => {
        updateCacheStats();
        showStatus('Cache cleared!', 'success');
      });
    });
  });

  // Test API Key — makes a real OMDb call for "The Dark Knight" and shows full result
  const testBtn = document.getElementById('testBtn');
  const testResult = document.getElementById('testResult');

  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      testResult.textContent = 'Enter an API key first.';
      testResult.className = 'test-result fail';
      testResult.hidden = false;
      return;
    }

    testResult.textContent = 'Testing...';
    testResult.className = 'test-result';
    testResult.hidden = false;

    const url = `https://www.omdbapi.com/?t=The+Dark+Knight&apikey=${apiKey}`;
    try {
      const resp = await fetch(url);
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (_e) {
        testResult.textContent = `Status: ${resp.status}\nResponse: ${text.substring(0, 300)}`;
        testResult.className = 'test-result fail';
        return;
      }

      if (data.Response === 'False') {
        testResult.textContent = `API Error: ${data.Error}`;
        testResult.className = 'test-result fail';
      } else {
        const imdb = data.imdbRating || 'N/A';
        const rt = (data.Ratings || []).find(r => r.Source === 'Rotten Tomatoes');
        testResult.textContent = `API key works!\n"${data.Title}" (${data.Year})\nIMDB: ${imdb}/10\nRT: ${rt ? rt.Value : 'N/A'}`;
        testResult.className = 'test-result pass';
      }
    } catch (err) {
      testResult.textContent = `Fetch failed: ${err.message}\n\nURL: ${url}`;
      testResult.className = 'test-result fail';
    }
  });

  // Initialize
  loadSettings();
  updateCacheStats();
})();

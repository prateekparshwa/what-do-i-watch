# Should I Watch This?

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/should-i-watch-this/kaehidnidcoolcpcninlhjdiilbefban)

A Chrome extension that shows IMDB & Rotten Tomatoes ratings directly on streaming platforms — so you stop wasting time on bad content.

## Supported Platforms

- Netflix
- Prime Video
- JioHotstar
- Zee5
- SonyLIV

## How It Works

The extension scans movie and show cards on supported streaming sites, fetches ratings from the OMDb API, and overlays results right on the page:

- A **green checkmark badge** appears on titles that meet your rating thresholds
- A **score bar** at the bottom of each card shows the IMDB and Rotten Tomatoes scores

Default thresholds are IMDB ≥ 7.3 and RT ≥ 70%, but you can customize both from the extension popup.

Ratings are cached locally for 7 days to keep things fast.

## Setup

1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/should-i-watch-this/kaehidnidcoolcpcninlhjdiilbefban)
2. Get a free API key from [OMDb](https://www.omdbapi.com/apikey.aspx) (free tier works fine)
3. Click the extension icon, enter your API key, and set your rating thresholds
4. Browse any supported streaming site — badges appear automatically

## Privacy

This extension does **not** collect any personal data. Everything (API key, thresholds, cached ratings) is stored locally in your browser.

See the full [Privacy Policy](PRIVACY_POLICY.md).

## License

[MIT](LICENSE)

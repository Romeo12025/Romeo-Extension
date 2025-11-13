# Romeo Nearby Scraper (Chrome Extension)

This extension scrapes profile cards from the Romeo (https://www.romeo.com) Nearby tab and exports a CSV. Images are fetched and embedded as base64 in the CSV (image_base64 column). Optionally, you can provide Face++ (FacePlusPlus) credentials to analyze faces; results will be included in the `facepp_json` column.

Usage

- Load the extension unpacked in Chrome: go to `chrome://extensions`, enable Developer mode, click "Load unpacked" and select this repository folder.
- Open Romeo and visit the "Nearby" tab (so the profile cards are visible on the page).
- Click the extension icon, paste Face++ `api_key` and `api_secret` if you want face analysis, check the box, and click **Scrape Nearby**.
- The extension will collect visible profiles, fetch their images, optionally call Face++, and download a CSV named `romeo_nearby_export.csv`.

Notes & Limitations

- The scraper uses heuristic selectors and best-effort DOM parsing. If Romeo changes their markup you may need to adjust selectors in `content-script.js`.
- Images are fetched and embedded as base64. This can create large CSV files for many profiles.
- Face++ credentials are stored locally in extension storage. Use your own credentials safely.
- If CORS or other network restrictions prevent image downloads, the `image_base64` column may be empty for some profiles.

Security and Ethics

- Make sure you respect Romeo's Terms of Service and local laws when scraping user profiles. This tool is provided for educational/automation purposes only.

Development

- Files of interest:
  - `manifest.json` — extension manifest
  - `popup.html`, `popup.js` — UI
  - `content-script.js` — DOM scraping logic (injected)
  - `background.js` — orchestration, image download, Face++ calls, CSV export

# Timestamp Converter

A Chrome extension that converts highlighted timestamps to your chosen timezone via the right-click context menu.

## Features

- **Configurable timezone** -- click the extension icon to pick from 30+ timezones grouped by region
- **Right-click to convert** -- highlight any timestamp on a page, right-click, and select "Convert timestamp"
- **DST-aware** -- uses the browser's built-in Intl API with IANA timezone names, so offsets are always correct
- **Broad format support** -- parses Unix timestamps, ISO 8601, human-readable dates, and more
- **Missing timezone warning** -- if the selected text has no timezone identifier, the result includes a warning (assumed UTC)

## Supported Formats

| Format | Example |
|---|---|
| Unix seconds | `1710000000` |
| Unix milliseconds | `1710000000000` |
| ISO 8601 | `2024-03-10T14:30:00Z` |
| ISO 8601 with offset | `2024-03-10T14:30:00+05:30` |
| Date + time + tz abbrev | `2026-03-15 23:11:01 UTC` |
| Human-readable | `Sun 15th Mar 2026 at 23:01:08.044 UTC` |
| Date + time (no tz) | `2024-03-10 14:30:00` (warns, assumes UTC) |
| US date | `03/10/2024 14:30` |
| Date only | `2024-03-10` |

Recognized timezone abbreviations include UTC, GMT, EST, EDT, CST, CDT, MST, MDT, PST, PDT, IST, JST, KST, AEST, AEDT, NZST, BST, CET, CEST, and many more.

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the `timestamp-converter-extension` folder
5. The extension icon appears in the toolbar -- click it to choose your target timezone

## Usage

1. Highlight a timestamp on any web page
2. Right-click the selection
3. Click **"Convert timestamp → ..."** in the context menu
4. A toast notification appears with the converted time

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension metadata, permissions, content script and popup registration |
| `background.js` | Service worker -- context menu, timestamp parsing, Intl-based timezone resolution |
| `content.js` | Content script -- renders toast notifications on the page |
| `popup.html` | Timezone selector popup UI |
| `popup.js` | Saves/loads timezone preference from `chrome.storage.sync` |

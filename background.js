const DEFAULT_TZ = "America/Denver";

// Abbreviations → IANA timezone names. The browser's Intl API resolves
// the correct UTC offset (including DST) for any given date automatically.
const TZ_ABBREV_TO_IANA = {
  "UTC":  "UTC",               "GMT":  "UTC",
  "EST":  "America/New_York",  "EDT":  "America/New_York",
  "CST":  "America/Chicago",   "CDT":  "America/Chicago",
  "MST":  "America/Denver",    "MDT":  "America/Denver",
  "PST":  "America/Los_Angeles","PDT": "America/Los_Angeles",
  "AST":  "America/Halifax",   "ADT":  "America/Halifax",
  "HST":  "Pacific/Honolulu",
  "AKST": "America/Anchorage", "AKDT": "America/Anchorage",
  "NST":  "America/St_Johns",  "NDT":  "America/St_Johns",
  "BST":  "Europe/London",
  "CET":  "Europe/Paris",      "CEST": "Europe/Paris",
  "EET":  "Europe/Helsinki",   "EEST": "Europe/Helsinki",
  "WET":  "Europe/Lisbon",     "WEST": "Europe/Lisbon",
  "MSK":  "Europe/Moscow",
  "IST":  "Asia/Kolkata",
  "ICT":  "Asia/Bangkok",
  "SGT":  "Asia/Singapore",    "HKT":  "Asia/Hong_Kong",
  "JST":  "Asia/Tokyo",        "KST":  "Asia/Seoul",
  "AWST": "Australia/Perth",
  "ACST": "Australia/Adelaide", "ACDT": "Australia/Adelaide",
  "AEST": "Australia/Sydney",   "AEDT": "Australia/Sydney",
  "NZST": "Pacific/Auckland",   "NZDT": "Pacific/Auckland",
  "BRT":  "America/Sao_Paulo",
  "ART":  "America/Argentina/Buenos_Aires",
  "WAT":  "Africa/Lagos",       "EAT":  "Africa/Nairobi",
  "GST":  "Asia/Dubai",         "SAST": "Africa/Johannesburg",
  "PKT":  "Asia/Karachi",       "NPT":  "Asia/Kathmandu",
  "MMT":  "Asia/Yangon",        "WIB":  "Asia/Jakarta",
  "PHT":  "Asia/Manila",
};

const TZ_ABBREV_PATTERN = new RegExp(
  "\\b(" + Object.keys(TZ_ABBREV_TO_IANA).join("|") + ")$",
  "i"
);

// ── Context menu ────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  updateContextMenuTitle();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.timezone) updateContextMenuTitle();
});

function updateContextMenuTitle() {
  chrome.storage.sync.get({ timezone: DEFAULT_TZ }, (data) => {
    const label = friendlyTzName(data.timezone);
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "convertTimestamp",
        title: `Convert timestamp → ${label}`,
        contexts: ["selection"]
      });
    });
  });
}

function friendlyTzName(tz) {
  try {
    const parts = tz.replace(/_/g, " ").split("/");
    const city = parts[parts.length - 1];
    const abbrev = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short"
    }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value || "";
    return `${city} (${abbrev})`;
  } catch (_) {
    return tz;
  }
}

// ── Message handler ─────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "convertTimestamp") {
    chrome.storage.sync.get({ timezone: DEFAULT_TZ }, (data) => {
      const selectedText = info.selectionText.trim();
      const result = convertTimestamp(selectedText, data.timezone);

      const payload = {
        action: "showNotification",
        original: selectedText,
        converted: result.formatted,
        success: result.success,
        warning: result.warning || null,
        targetTz: friendlyTzName(data.timezone),
        relativeTime: result.relativeTime || null
      };

      sendToTab(tab.id, payload);
    });
  }
});

async function sendToTab(tabId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
      await chrome.tabs.sendMessage(tabId, payload);
    } catch {
      // Tab is a chrome:// page or otherwise unreachable — nothing to do
    }
  }
}

// ── Intl-based offset resolution ────────────────────────────────────

/**
 * Get the UTC offset (in ms) of an IANA timezone at a specific instant.
 * Uses Intl.DateTimeFormat — always accurate, DST-aware, no hardcoded offsets.
 */
function getTimezoneOffsetMs(ianaTz, atDate) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
  const parts = fmt.formatToParts(atDate);
  const get = (type) => parseInt(parts.find(p => p.type === type).value);

  // hour12:false can produce hour=24 meaning midnight of the next day
  const localMs = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour"), get("minute"), get("second")
  );
  return localMs - atDate.getTime();
}

/**
 * Convert a naive datetime string (no tz info) that is known to be in
 * `sourceTz` (an IANA name) into a UTC Date. Iterates twice to handle
 * DST boundary edge cases.
 */
function resolveToUtc(naiveIso, sourceTz) {
  const asUtc = new Date(naiveIso + "Z");
  if (isNaN(asUtc)) return null;

  if (sourceTz === "UTC") return asUtc;

  const offset1 = getTimezoneOffsetMs(sourceTz, asUtc);
  const attempt = new Date(asUtc.getTime() - offset1);

  const offset2 = getTimezoneOffsetMs(sourceTz, attempt);
  if (offset1 !== offset2) {
    return new Date(asUtc.getTime() - offset2);
  }
  return attempt;
}

// ── Timezone detection helpers ──────────────────────────────────────

function extractTimezoneAbbrev(text) {
  const match = text.match(TZ_ABBREV_PATTERN);
  if (!match) return null;
  const abbrev = match[1].toUpperCase();
  const iana = TZ_ABBREV_TO_IANA[abbrev];
  if (!iana) return null;
  const cleaned = text.slice(0, match.index).trim();
  return { cleaned, iana, abbrev };
}

function hasTimezoneIndicator(text) {
  if (/Z$/i.test(text)) return true;
  if (/[+-]\d{2}:?\d{2}$/.test(text)) return true;
  if (TZ_ABBREV_PATTERN.test(text)) return true;
  return false;
}

// ── Human-date normalization ────────────────────────────────────────

function normalizeHumanDate(text) {
  return text
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\bat\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Main conversion logic ───────────────────────────────────────────

function convertTimestamp(text, targetTz) {
  let date = null;
  let warning = null;
  const noTz = !hasTimezoneIndicator(text);

  // 1. Pure Unix timestamp (10 digits = seconds, 13 digits = milliseconds)
  if (/^\d{10}$/.test(text)) {
    date = new Date(parseInt(text, 10) * 1000);
  } else if (/^\d{13}$/.test(text)) {
    date = new Date(parseInt(text, 10));

  // 2. ISO 8601 with explicit offset or Z
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    date = new Date(text);

  // 3. YYYY-MM-DD HH:MM:SS <TZ_ABBREV>  (e.g. "2026-03-15 23:11:01 UTC")
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?\s+\w+$/i.test(text)) {
    const tz = extractTimezoneAbbrev(text);
    if (tz) {
      const naiveIso = tz.cleaned.replace(" ", "T");
      date = resolveToUtc(naiveIso, tz.iana);
    } else {
      date = new Date(normalizeHumanDate(text));
    }

  // 4. ISO-like without timezone (YYYY-MM-DD HH:MM:SS)
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(text)) {
    date = new Date(text.replace(" ", "T") + "Z");

  // 5. ISO date only (YYYY-MM-DD)
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    date = new Date(text + "T00:00:00Z");

  // 6. US date (MM/DD/YYYY …)
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) {
    const tz = extractTimezoneAbbrev(text);
    if (tz) {
      date = parseFreeformInTimezone(tz.cleaned, tz.iana);
    } else {
      const normalized = text.includes(":") ? text : text + " 12:00:00";
      date = new Date(normalized + " UTC");
    }

  // 7. Human-readable with possible TZ abbrev
  //    e.g. "Sun 15th Mar 2026 at 23:01:08.044 UTC"
  } else {
    const tz = extractTimezoneAbbrev(text);
    const humanText = tz ? tz.cleaned : text;
    const cleaned = normalizeHumanDate(humanText);

    if (tz) {
      date = parseFreeformInTimezone(cleaned, tz.iana);
    } else {
      date = parseFreeformInTimezone(cleaned, "UTC");
    }
  }

  if (!date || isNaN(date.getTime())) {
    return {
      success: false,
      formatted: `Could not parse "${text}" as a timestamp.\n\nSupported formats:\n• Unix seconds / ms (e.g. 1710000000)\n• ISO 8601 (e.g. 2024-03-10T14:30:00Z)\n• YYYY-MM-DD HH:MM:SS [TZ]\n• MM/DD/YYYY HH:MM [TZ]\n• Human-readable (e.g. Sun 15th Mar 2026 at 23:01 UTC)`
    };
  }

  if (noTz && !/^\d{10,13}$/.test(text)) {
    warning = "No timezone found in selected text — assumed UTC.";
  }

  let formatted;
  try {
    formatted = date.toLocaleString("en-US", {
      timeZone: targetTz,
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    });
  } catch (_) {
    return {
      success: false,
      formatted: `Invalid target timezone "${targetTz}".\n\nOpen the extension popup and select a valid timezone.`
    };
  }

  const relativeTime = getRelativeTime(date);

  return { success: true, formatted, warning, relativeTime };
}

function getRelativeTime(date) {
  const diffMs = date.getTime() - Date.now();
  const future = diffMs >= 0;
  let remaining = Math.abs(diffMs);

  const units = [
    ["year",   365.25 * 24 * 60 * 60 * 1000],
    ["month",  30.44  * 24 * 60 * 60 * 1000],
    ["week",   7      * 24 * 60 * 60 * 1000],
    ["day",    24     * 60 * 60 * 1000],
    ["hour",   60     * 60 * 1000],
    ["minute", 60     * 1000],
  ];

  const parts = [];
  for (const [unit, ms] of units) {
    const count = Math.floor(remaining / ms);
    if (count < 1) continue;
    parts.push(`${count} ${unit}${count === 1 ? "" : "s"}`);
    remaining -= count * ms;
    if (parts.length === 2) break;
  }

  if (parts.length === 0) return "just now";
  const label = parts.join(", ");
  return future ? `${label} from now` : `${label} ago`;
}

/**
 * Parse a freeform date string that Date() can understand, then adjust
 * it from the given source IANA timezone to UTC.
 *
 * We force UTC parsing (via " GMT" suffix) so that Date() doesn't apply
 * the machine's local timezone. This avoids DST-gap issues where
 * local-time getters would silently shift the hour.
 */
function parseFreeformInTimezone(dateStr, sourceTz) {
  // Append " GMT" to anchor the parse to UTC, preventing local-tz
  // interpretation. If the string already parses as UTC, great.
  let naive = new Date(dateStr + " GMT");
  if (isNaN(naive)) {
    naive = new Date(dateStr);
    if (isNaN(naive)) return null;
  }

  // Extract UTC components (not local), since we forced a UTC parse
  const y = naive.getUTCFullYear();
  const mo = String(naive.getUTCMonth() + 1).padStart(2, "0");
  const d = String(naive.getUTCDate()).padStart(2, "0");
  const h = String(naive.getUTCHours()).padStart(2, "0");
  const mi = String(naive.getUTCMinutes()).padStart(2, "0");
  const s = String(naive.getUTCSeconds()).padStart(2, "0");
  const ms = String(naive.getUTCMilliseconds()).padStart(3, "0");

  const naiveIso = `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}`;
  return resolveToUtc(naiveIso, sourceTz);
}

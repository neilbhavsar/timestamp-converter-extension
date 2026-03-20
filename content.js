chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "showNotification") {
    showToast(message);
  }
});

function showToast({ original, converted, success, warning, targetTz }) {
  const existing = document.getElementById("ts-converter-toast");
  if (existing) existing.remove();

  if (!document.getElementById("ts-converter-style")) {
    const style = document.createElement("style");
    style.id = "ts-converter-style";
    style.textContent = `
      @keyframes ts-slide-in {
        from { transform: translateX(110%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      @keyframes ts-fade-out {
        from { opacity: 1; }
        to   { opacity: 0; transform: translateY(-8px); }
      }
    `;
    document.head.appendChild(style);
  }

  let accentColor, iconEmoji, statusLabel;
  if (!success) {
    accentColor = "#f87171";
    iconEmoji = "\u26A0\uFE0F";
    statusLabel = "Error";
  } else if (warning) {
    accentColor = "#f9e2af";
    iconEmoji = "\u26A0\uFE0F";
    statusLabel = targetTz || "Converted";
  } else {
    accentColor = "#a78bfa";
    iconEmoji = "\uD83D\uDD50";
    statusLabel = targetTz || "Converted";
  }

  const toast = document.createElement("div");
  toast.id = "ts-converter-toast";
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 16px 20px 14px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    z-index: 2147483647;
    min-width: 280px;
    max-width: 420px;
    border-left: 4px solid ${accentColor};
    animation: ts-slide-in 0.28s cubic-bezier(0.22,1,0.36,1);
    line-height: 1.5;
  `;

  const warningHtml = warning
    ? `<div style="
        margin-bottom:10px; padding:6px 10px; border-radius:6px;
        background:rgba(249,226,175,0.08); border:1px solid rgba(249,226,175,0.2);
        color:#f9e2af; font-size:11px; display:flex; align-items:center; gap:6px;
      ">\u26A0\uFE0F ${escapeHtml(warning)}</div>`
    : "";

  toast.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <span style="font-weight:600; font-size:13px; color:#fff; letter-spacing:0.2px;">
        ${iconEmoji} Timestamp Converter
      </span>
      <button id="ts-close-btn" style="
        background:none; border:none; color:#6c7086; cursor:pointer;
        font-size:18px; line-height:1; padding:0 0 0 12px; margin:0;
      " title="Dismiss">\u00D7</button>
    </div>

    ${warningHtml}

    <div style="margin-bottom:8px;">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.8px; color:#6c7086; margin-bottom:3px;">Selected text</div>
      <div style="
        background:#181825; padding:6px 10px; border-radius:6px;
        color:#a6adc8; font-family:monospace; font-size:12px;
        word-break:break-all; max-height:60px; overflow:auto;
      ">${escapeHtml(original)}</div>
    </div>

    <div>
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.8px; color:#6c7086; margin-bottom:3px;">
        ${success ? escapeHtml(statusLabel) : "Error"}
      </div>
      <div style="
        background:#181825; padding:8px 10px; border-radius:6px;
        color:${accentColor}; font-weight:600; font-size:14px;
        white-space:pre-wrap; word-break:break-word;
      ">${escapeHtml(converted)}</div>
    </div>
  `;

  document.body.appendChild(toast);

  document.getElementById("ts-close-btn").addEventListener("click", () => dismissToast(toast));

  const timer = setTimeout(() => dismissToast(toast), 7000);
  toast._timer = timer;
}

function dismissToast(toast) {
  if (!toast.parentElement) return;
  clearTimeout(toast._timer);
  toast.style.animation = "ts-fade-out 0.25s ease forwards";
  toast.addEventListener("animationend", () => toast.remove(), { once: true });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

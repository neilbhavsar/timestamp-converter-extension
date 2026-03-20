const select = document.getElementById("tz-select");
const savedMsg = document.getElementById("saved-msg");
const currentLabel = document.getElementById("current-tz-label");

const DEFAULT_TZ = "America/Denver";

function formatCurrentTime(tz) {
  try {
    return new Date().toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short"
    });
  } catch {
    return "Invalid timezone";
  }
}

function updateCurrentTime() {
  currentLabel.textContent = formatCurrentTime(select.value);
}

chrome.storage.sync.get({ timezone: DEFAULT_TZ }, (data) => {
  select.value = data.timezone || DEFAULT_TZ;
  updateCurrentTime();
});

let flashTimer;
select.addEventListener("change", () => {
  const tz = select.value;
  chrome.storage.sync.set({ timezone: tz });

  updateCurrentTime();

  savedMsg.classList.add("visible");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => savedMsg.classList.remove("visible"), 1500);
});

setInterval(updateCurrentTime, 1000);

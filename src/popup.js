const select = document.getElementById("tz-select");
const durationInput = document.getElementById("duration-input");
const savedMsg = document.getElementById("saved-msg");
const currentLabel = document.getElementById("current-tz-label");

const DEFAULT_TZ = "America/Denver";
const DEFAULT_DURATION = 5;

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

chrome.storage.sync.get({ timezone: DEFAULT_TZ, displayDuration: DEFAULT_DURATION }, (data) => {
  select.value = data.timezone || DEFAULT_TZ;
  durationInput.value = data.displayDuration || DEFAULT_DURATION;
  updateCurrentTime();
});

let flashTimer;
function flashSaved() {
  savedMsg.classList.add("visible");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => savedMsg.classList.remove("visible"), 1500);
}

select.addEventListener("change", () => {
  chrome.storage.sync.set({ timezone: select.value });
  updateCurrentTime();
  flashSaved();
});

durationInput.addEventListener("change", () => {
  const val = Math.max(1, Math.min(60, parseInt(durationInput.value) || DEFAULT_DURATION));
  durationInput.value = val;
  chrome.storage.sync.set({ displayDuration: val });
  flashSaved();
});

setInterval(updateCurrentTime, 1000);

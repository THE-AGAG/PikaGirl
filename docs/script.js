/*
  FILE: script.js
  GROUP: Game logic / UI wiring / Persistence

  High-level groups inside this file:
  - state (initial values and defaults)
  - DOM selectors (const el)
  - Audio helpers and volume controls
  - Game mechanics (click handling, purchases, prestige)
  - UI rendering and persistence (updateUI, persist/load)

  SAFE TO EDIT (low risk):
  - values in `state` for tuning gameplay (costs, multiplier, critChance, critPower, prestigeCost)
  - `SKINS` array (add/remove skins with local paths)
  - `volumes` default map (initial volume levels)
  - CSS classes and text in `index.html` (see index.html header for exact ids)

  CAUTION (make changes only if you know what you do):
  - ids in `el` map (these are referenced heavily throughout the script)
  - persistence keys and shape stored in `localStorage` (persist()/loadPersisted())
  - async audio playing / unlock logic (autoplay policies)

*/
/* 
---------------------------
Main state object
---------------------------
This object stores all the persistent variables that define the player's
current progress, upgrades, and settings. It acts as the single source
of truth for the game logic and UI updates.
*/
const state = {
  pseudo: "",              // The player's chosen username (string, empty until set)
  score: 0,                // Current score (the main currency of the game)
  totalClicks: 0,          // Total number of clicks performed by the player // (used for stats and achievements)
  autoClickers: 0,         // Number of auto-clickers purchased (passive score generators)
  autoClickCost: 500,       // Current cost to purchase the next auto-click
  multiplier: 1,           // Current multiplier applied to each click // (increases the score gained per click)
  multiplierCost: 1000,     // Current cost to purchase the next multiplier upgrade
  critChance: 0.02,        // Probability of a critical hit per click (2% by default)
  critPower: 5,            // Critical hit multiplier (x5 score when a crit occurs)
  critChanceCost: 2000,     // Cost to upgrade the critical hit chance
  critPowerCost: 3000,      // Cost to upgrade the critical hit power
  tempBoostActive: false,  // Whether a temporary boost is currently active (true/false)
  tempBoostEnd: 0,         // Timestamp (ms) when the temporary boost will end
  tempBoostCost: 300,      // Cost to activate a temporary boost
  prestigeCount: 0,        // Number of times the player has prestiged (soft reset)
  prestigeBonus: 0,        // Permanent percentage bonus gained from prestige // (applies to all future clicks)
  prestigeCost: 20000,      // Initial cost required to perform the first prestige
  lastClickTime: 0,        // Timestamp of the last click (used for CPS tracking // and click speed effects)
  bestTimed: 0,            // Highest score achieved in timed mode (personal best)
  timedActive: false,      // Whether the timed mode is currently active
  timedTimeLeft: 60,       // Remaining time (in seconds) for the timed mode
  timedScore: 0,           // Score accumulated during the current timed session // Daily challenge system
  daily: {
    active: false,         // Whether a daily challenge is currently active
    target: 5000,          // Target score required to complete the challenge
    rewardPct: 5,          // Reward percentage bonus granted upon completion
    expiresAt: 0,          // Expiration timestamp of the current daily challenge
    claimedToday: false    // Whether the daily reward has already been claimed today
  },
  theme: "normal",        // Current visual theme applied to the game
  soundOn: true,           // Whether sound effects are enabled (true/false)
  musicOn: false,          // Whether background music is enabled (true/false)
  achievementsUnlocked: {},// Object storing unlocked achievements // (keys = achievement IDs, values = true/false)
};

/* 
 ---------------------------
 DOM Selectors
 ---------------------------
 This object caches references to all important HTML elements used in the game.
 Instead of calling document.getElementById() repeatedly, we store them here
 for easy and efficient access throughout the script.
 The `el` object is a central registry of all DOM elements used in the game.
 Instead of repeatedly calling `document.getElementById(...)` throughout the code,
 we store references here for easier access and cleaner code.
*/
const el = {
  // --- Intro & Player Setup ---
  startBtn: document.getElementById("startBtn"),          // Button to start the game from the intro screen
  pseudoInput: document.getElementById("pseudo"),         // Text input where the player enters their username
  pseudoForm: document.getElementById("pseudoForm"),      // Form wrapper around the username input
  gameArea: document.getElementById("gameArea"),          // Main container for the game (hidden until game starts)

  // --- Game Stats Display ---
  score: document.getElementById("score"),                // Displays the player's current score
  multiplierStat: document.getElementById("multiplierStat"), // Shows the current click multiplier value
  autoClickStat: document.getElementById("autoClickStat"),   // Shows the current auto-clicker level/stat
  critStat: document.getElementById("critStat"),             // Shows the player's critical hit chance/power
  prestigeStat: document.getElementById("prestigeStat"),     // Displays prestige level or bonuses

  // --- Core Gameplay Elements ---
  clickButton: document.getElementById("clicker"),        // Main clickable button (the "clicker" object)
  gameImage: document.getElementById("gameImage"),        // Image displayed on the click button (e.g., cookie, monster, etc.)
  particlesCanvas: document.getElementById("particlesCanvas"), // Canvas for particle effects when clicking

  // --- Upgrade Buttons ---
  upgradeAuto: document.getElementById("buyAutoClick"),   // Button to purchase auto-clicker upgrades
  upgradeMult: document.getElementById("buyMultiplier"),  // Button to purchase multiplier upgrades
  upgradeCritChance: document.getElementById("buyCritChance"), // Button to increase critical hit chance
  upgradeCritPower: document.getElementById("buyCritPower"),   // Button to increase critical hit damage
  upgradeTempBoost: document.getElementById("buyTempBoost"),   // Button to buy temporary boosts
  doPrestige: document.getElementById("doPrestige"),      // Button to reset progress and gain prestige bonuses

  // --- Achievements ---
  achievementList: document.getElementById("achievementList"),   // Container listing unlocked achievements
  achievementToast: document.getElementById("achievementToast"), // Popup/notification when an achievement is unlocked

  // --- Scoreboards & Bonuses ---
  scoreList: document.getElementById("scoreList"),        // Leaderboard or list of high scores
  bonusButton: document.getElementById("bonusButton"),    // Button to trigger a bonus event
  bonusPopup: document.getElementById("bonusPopup"),      // Popup window showing bonus rewards/info

  // --- Audio & Settings ---
  keySelect: document.getElementById("keySelect"),                // 
  volumeSlider: document.getElementById('volumeSlider'),          // Global volume control slider
  soundTypeSelect: document.getElementById('soundTypeSelect'),    // Dropdown to select sound type (effects/music/etc.)
  soundVolumeSlider: document.getElementById('soundVolumeSlider'),// Slider for adjusting sound effect volume
  musicToggle: document.getElementById("musicToggle"),            // Toggle button for background music on/off
  soundToggle: document.getElementById("soundToggle"),            // Toggle button for sound effects on/off
  themeSelect: document.getElementById("themeSelect"),            // Dropdown to change the game’s visual theme

  // --- Save & Data Management ---
  backupBtn: document.getElementById('backupBtn'),        // Button to create a backup of the save data
  saveNowBtn: document.getElementById("saveNowBtn"),      // Button to manually save progress
  exportBtn: document.getElementById("exportBtn"),        // Button to export save data
  importBtn: document.getElementById("importBtn"),        // Button to import save data
  importFile: document.getElementById("importFile"),      // File input for importing save data
  resetScoresBtn: document.getElementById("resetScoresBtn"), // Button to reset leaderboard/high scores
  backBtn: document.getElementById("backBtn"),            // Button to return to a previous menu/screen

  // --- Game Modes ---
  clickZone: document.getElementById('clickZone'),        // Area where clicks are registered (may include animations)
  startTimedBtn: document.getElementById("startTimedBtn"),// Button to start a timed challenge mode
  timedInfo: document.getElementById("timedInfo"),        // Displays info about the timed challenge
  startDailyBtn: document.getElementById("startDailyBtn"),// Button to start the daily challenge
  dailyInfo: document.getElementById("dailyInfo"),        // Displays info about the daily challenge
  dailyStatus: document.getElementById("dailyStatus"),    // Shows progress/status of the daily challenge

  // --- UI Hints ---
  pressHint: document.getElementById("pressHint"),        // Small hint text (e.g., "Press here to start clicking")

  // --- Audio Elements ---
  clickSound: document.getElementById("clickSound"),      // Sound effect for normal clicks
  critSound: document.getElementById("critSound"),        // Sound effect for critical hits
  achievementSound: document.getElementById("achievementSound"), // Sound effect when unlocking an achievement
  music: document.getElementById("music"),                // Background music element
};

/*
 --- Toast Helper ---
 showToast() displays a temporary, non-blocking notification message.
 If a #toastContainer element exists in the DOM, it creates a styled <div> inside it.
 Otherwise, it falls back to using the native alert() function.
 Options:
    - text: the message to display
    - opts.timeout: how long (ms) before the toast fades out (default: 3000ms)
*/
function showToast(text, opts={timeout:3000}){
  try {
    // Try to find the toast container in the DOM
    const container = document.getElementById('toastContainer');
    if (!container) throw new Error('no container');

    // Create a new toast element
    const t = document.createElement('div');
    t.textContent = text;

    // Inline styling for the toast (dark background, white text, padding, etc.)
    t.style.background = 'rgba(0,0,0,0.8)';
    t.style.color = '#fff';
    t.style.padding = '8px 12px';
    t.style.marginTop = '8px';
    t.style.borderRadius = '6px';
    t.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    t.style.pointerEvents = 'auto'; // allows interaction if needed

    // Add the toast to the container
    container.appendChild(t);

    // Schedule fade-out and removal after the timeout
    setTimeout(()=>{
      try {
        t.style.transition = 'opacity 300ms'; // smooth fade
        t.style.opacity = '0';
        setTimeout(()=>t.remove(), 300); // remove from DOM after fade
      } catch(e){}
    }, opts.timeout || 3000);

    return;
  } catch(e) {
    // If no container exists, fallback to a blocking alert
    try { alert(text); } catch(e){}
  }
}

// --- Inactivity Timer ---
// Tracks when the player stops clicking.
// If no click occurs for INACTIVITY_MS (1 second), the main image resets to its base state.
let __inactivityTimer = null;
const INACTIVITY_MS = 1000;

// --- Active key state ---
// Default key binding (matches dropdown default)
let activeKey = "Space";


// --- CPS Indicator ---
// Cache reference to the CPS (Clicks Per Second) indicator element.
// May not exist at page load; will be null until created dynamically.
let __cpsEl = document.querySelector('.cps-indicator') || null;

// --- CPS State ---
// Array of timestamps (in ms) for recent clicks.
// Used to calculate the player's current CPS (clicks per second).
let __clickTimes = [];

// --- Skins / Shop Catalog ---
// Defines available skins for the clickable object.
// Each skin has:
//   - id: unique identifier
//   - name: display name (French here: "Par défaut", "Rapide", "Pixel")
//   - cost: price in in-game currency
//   - src: image file path for the skin
const SKINS = [
  { id: 'default', name: 'Par défaut', cost: 0, src: 'img/sacha twerk.gif' },
  { id: 'gif2', name: 'Rapide', cost: 5000, src: 'img/gif2.gif' },
  { id: 'pixel', name: 'Pixel', cost: 15000, src: 'img/moyen.gif' },
];

// --- Sound Volumes ---
// Default per-sound volume levels (range: 0.0 to 1.0).
// These can be applied to <audio> elements for fine-grained control.
const volumes = {
  music: 0.5,        // Background music volume
  click: 0.85,       // Normal click sound volume
  crit: 0.5,         // Critical hit sound volume
  achievement: 0.25, // Achievement unlock sound volume
};
/*
  SAFE TO EDIT: change defaults above (volumes, SKINS, state costs) to tune the game.
  EXAMPLE: set state.multiplierCost = 2000 to increase initial mult cost.
*/

// --- Gamepad Connection Events ---
// Purpose: Detect when a controller (PS4, Switch, Xbox, etc.) is connected or disconnected.
// Notes:
// - Browsers fire "gamepadconnected" and "gamepaddisconnected" events.
// - We log the connection and can show a toast to notify the player.
window.addEventListener("gamepadconnected", (e) => {
  showToast("🎮 Manette connectée: " + e.gamepad.id);
});
window.addEventListener("gamepaddisconnected", (e) => {
  showToast("❌ Manette déconnectée: " + e.gamepad.id);
});


// --- Audio helpers ---
// Purpose: Ensure audio elements are initialized with sensible defaults
// and "unlocked" on the first user interaction (required by many browsers
// due to autoplay restrictions).
function unlockAudio() {
  // Collect all audio elements used in the game
  const audios = [el.clickSound, el.critSound, el.achievementSound, el.music];

  audios.forEach(a => {
    if (!a) return; // Skip if element not found

    try {
      // Some browsers/hosts require crossOrigin for remote audio decoding
      a.crossOrigin = 'anonymous';

      // Set a sensible default volume if supported
      if (typeof a.volume === 'number') a.volume = 0.85;

      // Attempt to "unlock" audio by playing and immediately pausing
      // This satisfies autoplay policies that require a user gesture
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          a.pause();
          a.currentTime = 0; // Reset playback position
        }).catch(() => {
          // Ignore errors (e.g., autoplay blocked) — will retry later
        });
      }
    } catch (e) {
      // Fail silently if audio setup fails
    }
  });
}

// --- Music Autoplay on First Gesture ---
// Attach listeners for the first user interaction (click or key press).
// Once triggered, try to start background music if enabled.
document.addEventListener("click", tryPlayMusic, { once: true });
document.addEventListener("keydown", tryPlayMusic, { once: true });

function tryPlayMusic() {
  const musicEl = el.music;           // Background music element
  const musicToggle = el.musicToggle; // Checkbox/toggle for music on/off

  // Only play if the toggle exists and is checked
  if (musicToggle && musicToggle.checked) {
    try {
      musicEl.play().catch(err => console.warn("Music playback blocked:", err));
    } catch (e) {
      // Ignore if element missing or playback fails
    }
  }
}

// --- Volume Initialization ---
const volumeSlider = el.volumeSlider; // Global volume slider element
const music = el.music;               // Background music element

// Apply initial music volume:
// 1. Use saved value from `volumes.music` if available
// 2. Otherwise, use slider value if present
// 3. Fallback to 0.5 (50%)
try {
  if (music) {
    music.volume = (volumes.music !== undefined)
      ? volumes.music
      : (volumeSlider && volumeSlider.value
          ? volumeSlider.value / 100
          : 0.5);
  }
} catch (e) {
  // Ignore if music element missing
}

// --- Volume Slider Sync & Persistence ---
// Listen for changes on the global volume slider.
// Update the music element, persist the value, and keep other UI in sync.
if (volumeSlider) {
  volumeSlider.addEventListener("input", () => {
    try {
      // Convert slider value (0–100) to normalized volume (0.0–1.0)
      const v = Number(volumeSlider.value) / 100;

      // Apply to music element
      music.volume = v;

      // Update in-memory volumes object
      volumes.music = v;

      // Persist in game state
      state.soundVolumes = state.soundVolumes || {};
      state.soundVolumes.music = v;

      // If the user is editing the "music" type in the secondary sound settings,
      // keep that slider in sync as well
      const other = el.soundTypeSelect;
      const otherSlider = el.soundVolumeSlider;
      if (other && other.value === 'music' && otherSlider) {
        otherSlider.value = Math.round(v * 100);
      }

      // Throttle persistence to avoid excessive saves
      throttlePersist();
    } catch (e) {
      // Ignore errors (e.g., missing elements)
    }
  });
}

// --- Initialize volume controls ---
// This function sets up all audio-related UI elements (sliders, toggles, selectors)
// so that they work both before and after the game starts. It ensures that
// persisted settings are loaded, applied to audio elements, and kept in sync
// with the UI controls.
function initVolumeControls() {
  try {
    // --- Load persisted settings ---
    // Attempt to load saved state (volumes, sound type, toggles).
    // If it fails, ignore silently.
    try { loadPersisted(); } catch(e) {}

    // --- DOM references ---
    const globalVol = document.getElementById('volumeSlider'); // Global music volume slider
    const typeSel = el.soundTypeSelect;                        // Dropdown to choose sound type (music, click, crit, achievement)
    const volSlider = el.soundVolumeSlider;                    // Slider to adjust volume for the selected type

    // --- Ensure state.soundVolumes exists ---
    // If not present, initialize it with defaults from `volumes`.
    if (!state.soundVolumes) state.soundVolumes = { ...volumes };
    // Merge persisted values into the in-memory `volumes` object
    Object.assign(volumes, state.soundVolumes || {});

    // --- Apply stored volumes to audio elements ---
    try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
    try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
    try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
    try { if (el.music) el.music.volume = volumes.music; } catch(e){}

    // --- Global music slider setup ---
    if (globalVol) {
      // Initialize slider position from stored music volume (default 50%)
      globalVol.value = Math.round((volumes.music || 0.5) * 100);

      // Remove any previous listener (to avoid duplicates)
      globalVol.removeEventListener('input', globalVol._listenerForScript || (()=>{}));

      // Define new listener
      const l = () => {
        try {
          const v = Number(globalVol.value) / 100; // normalize 0–100 → 0.0–1.0
          if (el.music) el.music.volume = v;
          volumes.music = v;
          state.soundVolumes = state.soundVolumes || {};
          state.soundVolumes.music = v;

          // Keep per-type slider in sync if "music" is selected
          if (typeSel && typeSel.value === 'music' && volSlider) {
            volSlider.value = Math.round(v * 100);
          }

          throttlePersist(); // Save changes (throttled)
        } catch(e){}
      };

      // Attach listener and store reference for later removal
      globalVol.addEventListener('input', l);
      globalVol._listenerForScript = l;
    }

    // --- Per-type selector + slider setup ---
    if (typeSel && volSlider) {
      // Initialize selector and slider from state
      typeSel.value = state.soundType || 'click';
      volSlider.value = Math.round(((volumes[typeSel.value] || 0.5)) * 100);

      // Remove old listener if present
      volSlider.removeEventListener('input', volSlider._listenerForScript || (()=>{}));

      // Listener for per-type volume changes
      const l2 = (ev) => {
        try {
          const t = typeSel.value;              // selected type
          const v = Number(ev.target.value) / 100;
          volumes[t] = v;
          state.soundType = t;
          state.soundVolumes = state.soundVolumes || {};
          state.soundVolumes[t] = v;

          // Apply volume immediately to the correct audio element
          if (t === 'music' && el.music) el.music.volume = v;
          if (t === 'click' && el.clickSound) el.clickSound.volume = v;
          if (t === 'crit' && el.critSound) el.critSound.volume = v;
          if (t === 'achievement' && el.achievementSound) el.achievementSound.volume = v;

          // Keep global slider in sync if adjusting music
          if (t === 'music' && document.getElementById('volumeSlider')) {
            document.getElementById('volumeSlider').value = Math.round(v * 100);
          }

          throttlePersist();
        } catch(e){}
      };

      volSlider.addEventListener('input', l2);
      volSlider._listenerForScript = l2;

      // --- Handle type selection changes ---
      typeSel.removeEventListener('change', typeSel._listenerForScript || (()=>{}));
      const l3 = (ev) => {
        try {
          const t = ev.target.value;
          state.soundType = t;
          // Update slider to reflect the chosen type’s volume
          volSlider.value = Math.round(((volumes[t] || 0.5)) * 100);
          throttlePersist();
        } catch(e){}
      };
      typeSel.addEventListener('change', l3);
      typeSel._listenerForScript = l3;
    }

    // --- Sound toggle (mute/unmute effects) ---
    const sToggle = document.getElementById('soundToggle');
    if (sToggle) {
      // Initialize toggle state (default: ON unless explicitly false)
      sToggle.checked = state.soundOn !== false;

      // Remove old listener if present
      sToggle.removeEventListener('change', sToggle._listenerForScript || (()=>{}));

      // Listener for mute/unmute
      const l4 = () => {
        state.soundOn = sToggle.checked;

        if (!state.soundOn) {
          // Mute all effect sounds
          try { if (el.clickSound) el.clickSound.volume = 0; } catch(e){}
          try { if (el.critSound) el.critSound.volume = 0; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = 0; } catch(e){}
        } else {
          // Restore volumes from stored values
          try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
          try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
        }

        throttlePersist();
      };

      sToggle.addEventListener('change', l4);
      sToggle._listenerForScript = l4;
    }
  } catch (e) {
    // Fail silently if initialization fails
  }
}

// --- Initialize volume UI on load ---
// Ensures that controls are ready even before the game "Start" button is pressed.
try { initVolumeControls(); } catch (e) {}

// --- Volume UI Toggle ---
// Switches between the global volume slider (pre-game) and the in-game per-type controls.
// - When not in-game: show the global slider, hide the per-type controls.
// - When in-game: hide the global slider, show the per-type controls.
function setVolumeUIForGame(inGame) {
  try {
    const globalVol = document.getElementById('volumeSlider');
    const soundControls = document.querySelector('.sound-controls');
    if (globalVol) globalVol.style.display = inGame ? 'none' : '';
    if (soundControls) soundControls.style.display = inGame ? 'flex' : 'none';
  } catch (e) {}
}

// Default state: not in game yet, so show global slider
try { setVolumeUIForGame(false); } catch (e) {}
// Note: audio unlock logic is handled separately in unlockAudio() to avoid duplicate listeners


// --- Startup: triggered when the Start button is clicked ---
el.startBtn.addEventListener("click", () => {
  // Initialize volume controls (ensures sliders and state are ready)
  try { initVolumeControls(); } catch(e) {}

  // --- Validate pseudo (username) ---
  const p = el.pseudoInput.value.trim();
  if (!p) {
    showToast("Le pseudo est obligatoire !"); // notify if missing
    return;
  }
  state.pseudo = p;

  // Hide intro form, show main game area
  el.pseudoForm.style.display = "none";
  el.gameArea.style.display = "grid";

  // Switch to in-game volume UI
  try { setVolumeUIForGame(true); } catch (e) {}

  // Unlock audio now that we have a user gesture (required by browsers)
  unlockAudio();

  // Show backup button
  try { el.backupBtn.style.display = 'inline-block'; } catch (e) {}

  // --- CPS Indicator ---
  // Add a CPS (Clicks Per Second) indicator if it doesn’t exist yet
  if (!document.querySelector('.cps-indicator')) {
    const c = document.createElement('div');
    c.className = 'cps-indicator';
    c.textContent = 'CPS: 0';
    document.getElementById('clickZone').appendChild(c);
  }

  // --- Wire sound type selector + per-type volume slider ---
  try {
    const typeSel = el.soundTypeSelect;
    const volSlider = el.soundVolumeSlider;

    // Ensure persisted state is loaded
    try { loadPersisted(); } catch(e) {}
    if (!state.soundVolumes) state.soundVolumes = { ...volumes };
    Object.assign(volumes, state.soundVolumes || {});

    // Apply stored volumes to audio elements
    try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
    try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
    try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
    try { if (el.music) el.music.volume = volumes.music; } catch(e){}

    if (typeSel && volSlider) {
      // Initialize selector and slider
      const sel = state.soundType || 'click';
      typeSel.value = sel;
      volSlider.value = Math.round((volumes[sel] || 0.5) * 100);

      // Helper: apply volume to a given type
      function applyTypeVolume(type, valuePct, persist=true) {
        const v = Number(valuePct) / 100;
        volumes[type] = v;
        state.soundType = type;
        state.soundVolumes = state.soundVolumes || {};
        state.soundVolumes[type] = v;
        // Apply to the correct audio element
        try {
          if (type === 'music' && el.music) el.music.volume = v;
          if (type === 'click' && el.clickSound) el.clickSound.volume = v;
          if (type === 'crit' && el.critSound) el.critSound.volume = v;
          if (type === 'achievement' && el.achievementSound) el.achievementSound.volume = v;
        } catch(e){}
        if (persist) throttlePersist();
      }

      // Update slider when type changes
      typeSel.addEventListener('change', (ev) => {
        const t = ev.target.value;
        volSlider.value = Math.round((volumes[t] || 0.5) * 100);
        state.soundType = t;
        throttlePersist();
      });

      // Apply volume when slider changes
      volSlider.addEventListener('input', (ev) => {
        const t = typeSel.value;
        applyTypeVolume(t, ev.target.value);
      });
    }

    // --- Sound toggle (mute/unmute effects) ---
    if (el.soundToggle) {
      el.soundToggle.checked = state.soundOn !== false; // default: ON
      el.soundToggle.addEventListener('change', () => {
        state.soundOn = el.soundToggle.checked;
        if (!state.soundOn) {
          // Mute all effect sounds
          try { if (el.clickSound) el.clickSound.volume = 0; } catch(e){}
          try { if (el.critSound) el.critSound.volume = 0; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = 0; } catch(e){}
        } else {
          // Restore stored volumes
          try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
          try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
        }
        throttlePersist();
      });
    }
  } catch (e) {}

  // --- Build simple shop skins list ---
  try {
    const shop = document.querySelector('.shop');
    if (shop && !document.getElementById('skinsList')) {
      const div = document.createElement('div');
      div.id = 'skinsList';
      div.style.marginTop = '8px';
      div.innerHTML = '<h4>Skins</h4>';

      SKINS.forEach(s => {
        const b = document.createElement('button');
        b.className = 'upgrade-btn';
        b.textContent = `${s.name} (Coût: ${formatNumber(s.cost)})`;

        b.addEventListener('click', () => {
          const owned = (state.ownedSkins || []).includes(s.id);
          if (!owned) {
            // Attempt to buy
            if (state.score >= s.cost) {
              state.score -= s.cost;
              state.ownedSkins = state.ownedSkins || [];
              state.ownedSkins.push(s.id);
              state.currentSkin = s.id;
              el.gameImage.src = s.src;
              throttlePersist();
              scheduleUpdateUI();
            } else {
              showToast('Pas assez de points pour acheter ce skin.');
            }
          } else {
            // Already owned → just equip
            state.currentSkin = s.id;
            el.gameImage.src = s.src;
            throttlePersist();
            scheduleUpdateUI();
          }
        });

        div.appendChild(b);
      });

      shop.appendChild(div);
    }
  } catch (e) {}

  // --- Show in-game buttons ---
  try { el.saveNowBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.backBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.exportBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.importBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.resetScoresBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.pressHint.style.display = 'block'; } catch (e) {}

  // --- Final startup tasks ---
  loadPersisted();       // reload persisted state
  updateUI();            // refresh UI with current state
  displayScores();       // show leaderboard
  scheduleBonusButton(); // prepare bonus button events
  ensureDaily();         // initialize daily challenge
});

// --- Keyboard Support ---
// Allow players to trigger a click using the Space or Enter keys.
// This only works when the focus is NOT inside an input or textarea.
// To prevent abuse or accidental rapid-fire, we:
//   - Ignore key repeats (when the key is held down).
//   - Enforce a minimum delay between key-triggered clicks.
let __lastKeyClick = 0;                // Timestamp of the last key-triggered click
const __KEY_MIN_DELAY = 80;            // Minimum delay (ms) between key-triggered clicks

document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  // If the user is typing in an input or textarea, ignore key presses
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

  // Only respond to Space or Enter keys
  if (e.code === 'Space' || e.code === 'Enter') {
    // Ignore OS/browser autorepeat when holding the key down
    if (e.repeat) return;

    const now = Date.now();
    // Enforce throttle: ignore if pressed too soon after last key click
    if (now - __lastKeyClick < __KEY_MIN_DELAY) return;
    __lastKeyClick = now;

    e.preventDefault(); // Prevent scrolling or form submission
    // Simulate a click on the main click button
    try { el.clickButton.click(); } catch (err) {}
  }
});

// --- Gamepad Navigation + Click + Bonus (with deadzone, cooldown, and one-time bonus) ---
// Purpose:
// - Navigate between buttons using the left joystick (up/down).
// - Trigger clicks with the A button (index 0).
// - Claim bonus with the X button (index 2), but only once per appearance.
// - Keyboard fallback: Arrow keys for navigation, Enter for click, B for bonus.
// Fixes:
// - Deadzone: ignores small stick movements so it doesn’t jitter.
// - Cooldown: prevents scrolling too fast when holding the stick.
// - Debounce: ensures one click per button press, not spammed every frame.
// - One-time bonus: prevents claiming the same bonus multiple times.
// --- Configurable constants ---
const DEADZONE = 0.3;      // minimum stick tilt before it counts as movement
const NAV_DELAY = 200;     // delay (ms) between navigation moves
let lastNavTime = 0;       // timestamp of last navigation move
let prevA = false;         // track previous state of button A
let prevX = false;         // track previous state of bonus button
let bonusClaimed = false;  // track if current bonus has been claimed

// --- List of navigable elements (buttons in the game) ---
const navigable = [
  el.clickButton,
  el.upgradeAuto,
  el.upgradeMult,
  el.upgradeCritChance,
  el.upgradeCritPower,
  el.upgradeTempBoost,
  el.doPrestige
];
let navIndex = 0; // index of the currently selected button

// --- Function to visually highlight the focused button ---
function updateFocus() {
  navigable.forEach((btn, i) => {
    if (!btn) return;
    btn.style.outline = (i === navIndex) ? "3px solid yellow" : "none";
  });
}
updateFocus();

// --- Reset bonusClaimed when bonus appears ---
// Call this in your bonus spawn logic whenever you show the bonus button
function showBonus() {
  bonusClaimed = false;
  el.bonusButton.style.display = "inline-block";
}

// --- Keyboard support for Bonus (press "B") ---
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyB") {
    if (!bonusClaimed && el.bonusButton && el.bonusButton.style.display !== "none") {
      el.bonusButton.click();
      bonusClaimed = true; // prevent multiple claims
    }
  }
});

// --- Gamepad polling loop ---
function pollGamepadNav() {
  const gp = navigator.getGamepads()[0]; // first connected gamepad
  if (gp) {
    const now = Date.now();

    // --- Joystick vertical navigation ---
    const y = gp.axes[1]; // vertical axis (-1 up, +1 down)

    if (y > DEADZONE && now - lastNavTime > NAV_DELAY) {
      navIndex = (navIndex + 1) % navigable.length;
      updateFocus();
      lastNavTime = now;
    }
    if (y < -DEADZONE && now - lastNavTime > NAV_DELAY) {
      navIndex = (navIndex - 1 + navigable.length) % navigable.length;
      updateFocus();
      lastNavTime = now;
    }

    // --- Button A click (debounced) ---
    const isAPressed = gp.buttons[0].pressed;
    if (isAPressed && !prevA) {
      navigable[navIndex].click();
    }
    prevA = isAPressed;

    // --- Button X (index 2) → claim bonus (debounced + one-time) ---
    const isXPressed = gp.buttons[2].pressed;
    if (isXPressed && !prevX) {
      if (!bonusClaimed && el.bonusButton && el.bonusButton.style.display !== "none") {
        el.bonusButton.click();
        bonusClaimed = true; // prevent multiple claims
      }
    }
    prevX = isXPressed;
  }

  // Keep polling every frame
  requestAnimationFrame(pollGamepadNav);
}
requestAnimationFrame(pollGamepadNav);

// --- Export / Import Save (client-side JSON) ---
// Allows the player to export their game state to a JSON file and re-import it later.
// --- Export Save ---
el.exportBtn.addEventListener('click', () => {
  try {
    // Clone the current game state
    const exportState = JSON.parse(JSON.stringify(state));

    // Remove audio-related keys (we don’t want to export user-specific audio prefs)
    delete exportState.soundVolumes;
    delete exportState.soundType;
    delete exportState.musicOn;
    delete exportState.soundOn;

    // Remove legacy 'volumes' map if present
    if (exportState.volumes) delete exportState.volumes;

    // Include scoreboard separately (stored in localStorage)
    const scores = JSON.parse(localStorage.getItem('scores') || '[]');

    // Build export object with timestamp, state, and scores
    const toExport = {
      exportedAt: new Date().toISOString(),
      state: exportState,
      scores
    };

    // Convert to JSON string (pretty-printed with 2 spaces)
    const data = JSON.stringify(toExport, null, 2);

    // Create a downloadable blob
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create a temporary <a> element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `clicker-save-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();   // Trigger download
    a.remove();  // Clean up
    URL.revokeObjectURL(url); // Free memory
  } catch (e) {
    showToast('Erreur lors de la création de l\'export');
  }
});

// --- Import Save ---
el.importBtn.addEventListener('click', () => {
  try { el.importFile.click(); } catch (e) {}
});

// Handle file selection
el.importFile.addEventListener('change', (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);

      // Support new export structure { exportedAt, state, scores }
      const incomingState = parsed && parsed.state ? parsed.state : parsed;

      // Merge incoming state into current state, skipping audio-related keys
      const skip = new Set(['soundVolumes','soundType','musicOn','soundOn','volumes']);
      for (const k of Object.keys(incomingState || {})) {
        if (skip.has(k)) continue;
        try { state[k] = incomingState[k]; } catch (e) {}
      }

      // If the file contains scores, replace local scores
      if (parsed && Array.isArray(parsed.scores)) {
        try { localStorage.setItem('scores', JSON.stringify(parsed.scores)); } catch (e) {}
      }

      // Persist minimal state and refresh UI
      throttlePersist();
      loadPersisted();
      scheduleUpdateUI();
      displayScores();
      showToast('Import successful');
    } catch (err) {
      showToast('Invalid import file');
    }
  };

  // Read the file as text
  reader.readAsText(f);
});

// --- Reset scoreboard ---
// Clears all saved progress, scores, daily challenge, and settings.
// Before wiping, creates a backup in localStorage with a timestamped key.
el.resetScoresBtn.addEventListener('click', () => {
  if (!confirm('Reset total? This will erase ALL saved progress, scores, daily challenge and settings. A backup will be created. Continue?')) return;
  try {
    const key = `clicker_backup_before_reset_${new Date().toISOString()}`;
    localStorage.setItem(key, localStorage.getItem('clickerState') || JSON.stringify(state));
  } catch (e) {}

  // Remove all known keys used by the game
  try { localStorage.removeItem('clickerState'); } catch (e) {}
  try { localStorage.removeItem('scores'); } catch (e) {}
  try { localStorage.removeItem('dailyKey'); } catch (e) {}
  try { localStorage.removeItem('az'); } catch (e) {}

  // Reload page to reset in-memory state
  try { location.reload(); } catch (e) { window.location.href = window.location.href; }
});

// --- Back button ---
// Returns to the initial screen by reloading the page.
el.backBtn.addEventListener("click", () => {
  try { location.reload(); } catch (e) { window.location.href = window.location.href; }
});

// --- Sound / Music / Theme Controls ---

// Music toggle: play/pause background music and persist preference
el.musicToggle.addEventListener("change", () => {
  state.musicOn = el.musicToggle.checked;
  if (state.musicOn) {
    const p = el.music.play();
    if (p && typeof p.then === 'function') p.catch(() => { /* ignore autoplay block */ });
  } else {
    try { el.music.pause(); } catch (e) {}
  }
  throttlePersist();
});

// Sound toggle: enable/disable sound effects globally
el.soundToggle.addEventListener("change", () => {
  state.soundOn = el.soundToggle.checked;
  throttlePersist();
});

// --- Theme Selector (custom dropdown) ---
const customSelect = document.getElementById("themeSelect");
const selected = customSelect.querySelector(".selected");
const options = customSelect.querySelectorAll(".options li");

// Toggle dropdown open/close
selected.addEventListener("click", () => {
  customSelect.classList.toggle("open");
});

// Handle theme option selection
options.forEach(opt => {
  opt.addEventListener("click", () => {
    const img = opt.querySelector("img").src;
    const text = opt.textContent;
    const value = opt.dataset.value;

    // Clear current .selected content
    selected.innerHTML = "";

    // Add chosen image
    const newImg = document.createElement("img");
    newImg.src = img;
    newImg.alt = "";
    selected.appendChild(newImg);

    // Add chosen text
    const span = document.createElement("span");
    span.textContent = text;
    selected.appendChild(span);

    // Close dropdown
    customSelect.classList.remove("open");

    // Apply theme by updating body class
    document.body.className = "";
    document.body.classList.add(`theme-${value}`);
  });
});

// --- Main Click Handler ---
// Core gameplay: handles scoring, critical hits, image feedback, sounds, and achievements.
el.clickButton.addEventListener("click", () => {
  const now = Date.now();
  const diff = now - state.lastClickTime;
  state.lastClickTime = now;

  // --- Calculate gain ---
  const isCrit = Math.random() < state.critChance; // chance-based critical hit
  let gain = state.multiplier;
  if (state.tempBoostActive) gain *= 2; // temporary boost doubles gain
  gain *= (1 + state.prestigeBonus / 100); // prestige bonus multiplier
  if (isCrit) gain *= state.critPower; // critical hit multiplier

  state.score += Math.floor(gain);
  state.totalClicks += 1;

  // Record click timestamp for CPS tracking
  try { __clickTimes.push(Date.now()); } catch (e) {}

  // --- Visual feedback based on click speed ---
  // Thresholds (ms between clicks):
  //   fast: <=100ms (10+ cps)
  //   medium: 101–167ms (~6–10 cps)
  //   base: >167ms (1–6 cps)
  if (diff <= 100) {
    el.gameImage.src = themeAsset("fast");
    el.gameImage.style.transform = "scale(1.2)";
  } else if (diff <= 167) {
    el.gameImage.src = themeAsset("medium");
    el.gameImage.style.transform = "scale(1.1)";
  } else {
    el.gameImage.src = themeAsset("base");
    el.gameImage.style.transform = "scale(1)";
  }

  // Reset inactivity timer: revert image to base after 1s of no clicks
  try { if (__inactivityTimer) clearTimeout(__inactivityTimer); } catch (e) {}
  __inactivityTimer = setTimeout(() => {
    try {
      el.gameImage.src = themeAsset("base");
      el.gameImage.style.transform = "scale(1)";
    } catch (e) {}
    __inactivityTimer = null;
  }, INACTIVITY_MS);

  // --- Sounds ---
  if (state.soundOn) {
    const s = (isCrit ? el.critSound : el.clickSound);
    if (!s) {
      console.warn('Audio element missing for click/crit');
    } else {
      try { s.currentTime = 0; } catch (e) {}
      try {
        const p = s.play && s.play();
        if (p && typeof p.then === 'function') {
          p.catch(() => {
            // Fallback: create a transient Audio() instance if playback fails
            try {
              const src = s.src || (isCrit ? (el.critSound && el.critSound.src) : (el.clickSound && el.clickSound.src));
              if (!src) return;
              const fallback = new Audio(src);
              fallback.preload = 'auto';
              const vol = isCrit ? (volumes.crit || 0.5) : (volumes.click || 0.85);
              try { fallback.volume = vol; } catch(e){}
              fallback.play().catch(()=>{});
            } catch (e) { /* ignore */ }
          });
        }
      } catch (e) {
        // Last resort: create Audio and try
        try {
          const src = s.src || (isCrit ? (el.critSound && el.critSound.src) : (el.clickSound && el.clickSound.src));
          if (src) {
            const fallback = new Audio(src);
            fallback.preload = 'auto';
            const vol = isCrit ? (volumes.crit || 0.5) : (volumes.click || 0.85);
            try { fallback.volume = vol; } catch(e){}
            fallback.play().catch(()=>{});
          }
        } catch (ee) {}
      }
    }
  }

  // --- Post-click updates ---
  spawnParticles(isCrit ? "#ffd700" : "#ffffff"); // gold particles for crits
  scheduleUpdateUI();                             // refresh UI
  checkClickAchievements();                       // check for click-related achievements
});

// --- Make the main image clickable too ---
// Clicking the image triggers the same logic as clicking the main button.
try {
  el.gameImage.style.cursor = 'pointer';
  el.gameImage.addEventListener('click', () => {
    try { el.clickButton.click(); } catch (e) {}
  });
} catch (e) {}

// --- Purchases ---
// Upgrade: Auto-clicker
el.upgradeAuto.addEventListener("click", () => {
  if (state.score >= state.autoClickCost) {
    state.score -= state.autoClickCost;
    state.autoClickers += 1;
    state.autoClickCost = Math.floor(state.autoClickCost * 1.5); // cost scaling
    checkUpgradeAchievements();
    scheduleUpdateUI();
    throttlePersist();
  } else showToast("Pas assez de points !");
});

// Upgrade: Multiplier
el.upgradeMult.addEventListener("click", () => {
  if (state.score >= state.multiplierCost) {
    state.score -= state.multiplierCost;
    state.multiplier += 1;
    state.multiplierCost = Math.floor(state.multiplierCost * 2); // cost scaling
    checkUpgradeAchievements();
    scheduleUpdateUI();
    throttlePersist();
  } else showToast("Pas assez de points !");
});

// --- Upgrade: Critical Chance ---
// Increases the player's chance of landing a critical hit.
// Each purchase:
//   - Costs current critChanceCost
//   - Increases crit chance by +1% (0.01), capped at 50%
//   - Doubles the cost for the next upgrade
//   - Unlocks an achievement when upgraded
el.upgradeCritChance.addEventListener("click", () => {
  if (state.score >= state.critChanceCost) {
    state.score -= state.critChanceCost;
    state.critChance = Math.min(0.5, state.critChance + 0.01); // +1%, max 50%
    state.critChanceCost = Math.floor(state.critChanceCost * 2);
    unlockAchievement(`🎯 Crit% augmenté à ${(state.critChance * 100).toFixed(0)}%`);
    scheduleUpdateUI();
    throttlePersist();
  } else {
    showToast("Pas assez de points !");
  }
});


// --- Upgrade: Critical Power ---
// Increases the damage multiplier applied when a critical hit occurs.
// Each purchase:
//   - Costs current critPowerCost
//   - Increases crit power by +5, capped at x50
//   - Doubles the cost for the next upgrade
el.upgradeCritPower.addEventListener("click", () => {
  if (state.score >= state.critPowerCost) {
    state.score -= state.critPowerCost;
    state.critPower = Math.min(50, state.critPower + 5); // max x50
    state.critPowerCost = Math.floor(state.critPowerCost * 2);
    scheduleUpdateUI();
    throttlePersist();
  } else showToast("Pas assez de points !");
});


// --- Upgrade: Temporary Boost ---
// Grants a temporary 30-second boost that doubles click gains.
// Each purchase:
//   - Costs current tempBoostCost
//   - Activates boost immediately
//   - Sets an expiration timestamp (30s from now)
el.upgradeTempBoost.addEventListener("click", () => {
  if (state.score >= state.tempBoostCost) {
    state.score -= state.tempBoostCost;
    state.tempBoostActive = true;
    state.tempBoostEnd = Date.now() + 30000; // 30s duration
    scheduleUpdateUI();
    throttlePersist();
  } else showToast("Pas assez de points !");
});


// --- Prestige System ---
// Prestige allows the player to reset progress in exchange for permanent bonuses.
// Requirements:
//   - Must have at least prestigeCost points
// Effects:
//   - Deducts prestigeCost
//   - Increases prestigeCount by 1
//   - Grants +10% permanent prestige bonus
//   - Resets most progress (soft reset)
//   - Doubles prestigeCost for the next prestige
//   - Unlocks an achievement and shows confetti effect
el.doPrestige.addEventListener("click", () => {
  // Verify cost
  if (state.score < (state.prestigeCost || 20000)) {
    showToast(`Pas assez de points pour effectuer un prestige. Coût : ${state.prestigeCost}`);
    return;
  }
  if (!confirm(`Prestige coûte ${state.prestigeCost} points et réinitialisera la progression. Continuer ?`)) return;

  // Perform prestige
  state.score -= state.prestigeCost;
  state.prestigeCount += 1;
  state.prestigeBonus += 10;

  // --- Soft reset of progress ---
  state.totalClicks = 0;
  state.autoClickers = 0;
  state.autoClickCost = 50;
  state.multiplier = 1;
  state.multiplierCost = 1000;
  state.critChance = 0.10;
  state.critPower = 10;
  state.critChanceCost = 2000;
  state.critPowerCost = 3000;
  state.tempBoostActive = false;
  state.tempBoostEnd = 0;

  // Increase prestige cost for next time
  state.prestigeCost = Math.floor((state.prestigeCost || 20000) * 2);

  unlockAchievement(`🏆 Prestige #${state.prestigeCount}: +10% permanent`);
  scheduleUpdateUI();
  throttlePersist();

  // Visual flair for prestige
  try { showConfetti(); } catch (e) {}
});


// --- Confetti Effect ---
// Simple celebratory animation triggered on prestige.
// Creates a temporary canvas overlay with falling colored rectangles.
function showConfetti() {
  const container = document.getElementById('clickZone');
  if (!container) return;

  // Create canvas overlay
  const cvs = document.createElement('canvas');
  cvs.className = 'confetti';
  cvs.width = container.clientWidth;
  cvs.height = container.clientHeight;
  cvs.style.left = container.offsetLeft + 'px';
  cvs.style.top = container.offsetTop + 'px';
  cvs.style.width = container.clientWidth + 'px';
  cvs.style.height = container.clientHeight + 'px';
  container.appendChild(cvs);

  const ctx2 = cvs.getContext('2d');
  const pieces = [];

  // Generate confetti pieces with random positions, velocities, and colors
  for (let i = 0; i < 60; i++) {
    pieces.push({
      x: Math.random() * cvs.width,
      y: -10 - Math.random() * cvs.height,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 3,
      life: 120,
      color: ['#ffd54f','#ff6a00','#8be9fd','#a777e3'][Math.floor(Math.random() * 4)]
    });
  }

  // Animation loop
  function step() {
    ctx2.clearRect(0, 0, cvs.width, cvs.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity effect
      p.life -= 1;
      ctx2.fillStyle = p.color;
      ctx2.fillRect(p.x, p.y, 6, 4);
    }
    // Continue until all pieces expire, then remove canvas
    if (pieces.some(p => p.life > 0)) {
      requestAnimationFrame(step);
    } else {
      try { cvs.remove(); } catch(e){}
    }
  }
  requestAnimationFrame(step);
}

// --- Timed Mode ---
// A 60-second challenge where the player tries to score as many points as possible.
// - Starts only if not already active
// - Tracks remaining time and score
// - Updates UI every second
// - At the end, saves best score and unlocks an achievement
el.startTimedBtn.addEventListener("click", () => {
  if (state.timedActive) return; // prevent multiple starts
  state.timedActive = true;
  state.timedTimeLeft = 60; // 60 seconds
  state.timedScore = 0;
  unlockAchievement("⏱️ Début du mode chronométré !");

  const interval = setInterval(() => {
    state.timedTimeLeft -= 1;
    el.timedInfo.textContent = `Temps: ${state.timedTimeLeft} | Score: ${state.timedScore} | Meilleur: ${state.bestTimed}`;

    if (state.timedTimeLeft <= 0) {
      clearInterval(interval);
      state.timedActive = false;
      state.bestTimed = Math.max(state.bestTimed, state.timedScore);
      unlockAchievement(`⏱️ Fin: score ${state.timedScore}. Meilleur: ${state.bestTimed}`);
      throttlePersist();
    }
  }, 1000);
});


// --- Backup Button ---
// Creates a timestamped backup of the current game state in localStorage.
// Useful before resets or major changes.
if (el.backupBtn) {
  el.backupBtn.addEventListener('click', () => {
    try {
      const key = `clicker_backup_${new Date().toISOString()}`;
      localStorage.setItem(key, localStorage.getItem('clickerState') || JSON.stringify(state));
      showToast(`Backup créé: ${key}`);
    } catch (e) {
      showToast('Erreur lors de la création du backup');
    }
  });
}


// --- Daily Challenge ---
// A once-per-day 10-minute challenge.
// - Can only be started once per day
// - Prevents restart if already active or completed
// - Marks challenge as started in localStorage
el.startDailyBtn.addEventListener("click", () => {
  const todayKey = new Date().toDateString();
  ensureDaily(false); // initialize daily state if missing

  // Prevent multiple starts in the same day
  const startedKey = localStorage.getItem('dailyStarted');
  if (startedKey === todayKey) {
    showToast('Vous avez déjà démarré le défi aujourd\'hui.');
    return;
  }

  // Prevent starting if already active or completed
  if (state.daily.active) {
    showToast('Un défi est déjà en cours.');
    return;
  }
  if (state.daily.claimedToday) {
    showToast('Vous avez déjà réussi le défi aujourd\'hui.');
    return;
  }

  // Start the challenge
  state.daily.active = true;
  state.daily.expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  try { el.dailyStatus.textContent = "Statut: en cours (10 min)"; } catch(e){}
  try { localStorage.setItem('dailyStarted', todayKey); } catch(e){}

  if (el.startDailyBtn) {
    el.startDailyBtn.disabled = true;
    el.startDailyBtn.textContent = 'En cours...';
  }

  unlockAchievement("📅 Défi quotidien lancé !");
  throttlePersist();
});


// --- Manual Save ---
// Allows the player to save progress instantly.
el.saveNowBtn.addEventListener("click", () => {
  saveScore();
  unlockAchievement("💾 Score sauvegardé manuellement.");
});


// --- Auto-Click Loop ---
// Runs every second.
// - Adds points based on number of auto-clickers and multiplier
// - Applies temporary boost and prestige bonus
// - Updates timed score if in timed mode
// - Ends temporary boost when expired
setInterval(() => {
  if (state.autoClickers > 0) {
    let gain = state.autoClickers * state.multiplier;
    if (state.tempBoostActive) gain *= 2;
    gain *= (1 + state.prestigeBonus / 100);
    state.score += Math.floor(gain);
    if (state.timedActive) state.timedScore += Math.floor(gain);
    scheduleUpdateUI();
  }

  // End temporary boost if expired
  const nowAuto = Date.now();
  if (state.tempBoostActive && nowAuto > state.tempBoostEnd) {
    state.tempBoostActive = false;
    unlockAchievement("⚡ Fin du boost de 30s.");
    scheduleUpdateUI();
  }
}, 1000);


// --- Random Bonus Popup ---
// Periodically spawns a bonus button at a random position.
// - Appears for 5 seconds
// - Grants a random bonus (100–1000 points) when clicked
// - Updates score and UI
function scheduleBonusButton() {
  setTimeout(() => {
    if (!el.bonusButton) return; // guard if button missing
    el.bonusButton.style.display = "block";
    el.bonusButton.style.right = `${12 + Math.random()*40}px`;
    el.bonusButton.style.top = `${-8 + Math.random()*40}px`;

    setTimeout(() => {
      el.bonusButton.style.display = "none";
      scheduleBonusButton(); // schedule next spawn
    }, 5000);
  }, 15000 + Math.random()*15000); // random interval between 15–30s
}

if (el.bonusButton) {
  el.bonusButton.addEventListener("click", () => {
    const bonus = Math.floor(100 + Math.random()*900);
    state.score += bonus;
    if (state.timedActive) state.timedScore += bonus;

    el.bonusPopup.textContent = `🎁 Bonus reçu : +${bonus} points !`;
    el.bonusPopup.style.display = "block";
    setTimeout(() => el.bonusPopup.style.display = "none", 3000);

    updateUI();
  });
}

// --- Achievements System ---

// Unlock a new achievement and display it in the UI.
// - Prevents duplicates (checks if already unlocked).
// - Adds the achievement to the list in the sidebar.
// - Shows a temporary toast notification.
// - Plays a sound effect if sound is enabled.
// - Persists the updated state.
function unlockAchievement(text) {
  // Skip if already unlocked
  if (state.achievementsUnlocked[text]) return;
  state.achievementsUnlocked[text] = true;

  // Add to achievements list in UI
  const li = document.createElement("li");
  li.textContent = text;
  el.achievementList.appendChild(li);

  // Show toast notification
  el.achievementToast.textContent = text;
  el.achievementToast.style.display = "block";

  // Play sound if enabled
  if (state.soundOn) {
    try { el.achievementSound.currentTime = 0; } catch (e) {}
    try { el.achievementSound.volume = 0.25; } catch (e) {}
    const p = el.achievementSound.play();
    if (p && typeof p.then === 'function') p.catch(() => {/* ignore autoplay block */});
  }

  // Hide toast after 2 seconds
  setTimeout(() => el.achievementToast.style.display = "none", 2000);

  // Save progress
  throttlePersist();
}


// --- Click Achievements ---
// Milestones based on total clicks.
// Unlocks achievements at specific thresholds (100 → 10M).
const clickMilestones = [100, 1000, 10000, 100000, 1000000, 10000000];

function checkClickAchievements() {
  for (const m of clickMilestones) {
    if (state.totalClicks === m) {
      unlockAchievement(`💥 ${state.pseudo} a atteint ${m.toLocaleString()} clics !`);
    }
  }

  // Bonus: in timed mode, clicks also add to timed score
  if (state.timedActive) state.timedScore += state.multiplier;
}


// --- Upgrade Achievements ---
// Unlocks achievements when reaching multiples of 10 in upgrades.
function checkUpgradeAchievements() {
  if (state.autoClickers > 0 && state.autoClickers % 10 === 0) {
    unlockAchievement(`⚙️ ${state.pseudo} a atteint ${state.autoClickers} Auto-Clickers !`);
  }
  if (state.multiplier > 0 && state.multiplier % 10 === 0) {
    unlockAchievement(`🔥 Multiplicateur x${state.multiplier} atteint !`);
  }
}


// --- UI Update System ---

// Updates all dynamic UI elements (score, stats, buttons).
// Uses a "previous values" cache to avoid unnecessary DOM updates.
function updateUI() {
  if (!updateUI._prev) updateUI._prev = {};
  const prev = updateUI._prev;

  // Map of element keys → text values
  const mappings = [
    ['score', `Score : ${state.score}`],
    ['multiplierStat', `x${state.multiplier}${state.tempBoostActive ? " (Boost x2)" : ""}`],
    ['autoClickStat', `Auto: ${state.autoClickers}/s`],
    ['critStat', `Crit: ${(state.critChance*100).toFixed(0)}% (x${state.critPower})`],
    ['prestigeStat', `Prestige: ${state.prestigeCount} (+${state.prestigeBonus}%)`],
    ['upgradeAuto', `Acheter Auto-Click (Coût : ${formatNumber(state.autoClickCost)})`],
    ['upgradeMult', `Acheter Multiplicateur (Coût : ${formatNumber(state.multiplierCost)})`],
    ['upgradeCritChance', `Acheter Crit% (Coût : ${formatNumber(state.critChanceCost)})`],
    ['upgradeCritPower', `Acheter Crit x (Coût : ${formatNumber(state.critPowerCost)})`],
    ['upgradeTempBoost', `Boost 30s (Coût : ${formatNumber(state.tempBoostCost)})`],
  ];

  // Update only if value changed
  for (const [key, val] of mappings) {
    if (!el[key]) continue;
    if (prev[key] !== val) {
      el[key].textContent = val;
      prev[key] = val;
    }
  }

  // Update prestige button separately
  if (el.doPrestige) {
    const cost = state.prestigeCost || 20000;
    const label = `Prestige (Coût : ${formatNumber(cost)})`;
    if (updateUI._prev.doPrestige !== label) {
      el.doPrestige.textContent = label;
      updateUI._prev.doPrestige = label;
    }
  }

  // Subtle dynamic background based on score
  const p = Math.min(1, state.score / 100000);
  document.body.style.background =
    `linear-gradient(135deg, rgba(110,142,251,1), rgba(167,119,227,${Math.max(0.4, p)}))`;

  // Sync toggle states with current settings
  if (el.musicToggle) el.musicToggle.checked = state.musicOn;
  if (el.soundToggle) el.soundToggle.checked = state.soundOn;
  if (el.themeSelect) el.themeSelect.value = state.theme;
}

// --- UI Update Scheduler ---
// Prevents redundant updates by batching them into a single
// requestAnimationFrame cycle. This ensures that if multiple
// state changes happen quickly, the UI only re-renders once per frame.
let __uiScheduled = false;
function scheduleUpdateUI() {
  if (__uiScheduled) return; // already scheduled
  __uiScheduled = true;
  requestAnimationFrame(() => {
    try { updateUI(); } catch (e) { console.warn('updateUI error', e); }
    __uiScheduled = false;
  });
}

// --- Persistence Throttle ---
// Avoids writing to localStorage too often (expensive operation).
// Ensures saves happen at most once per second, with a queued backup if needed.
let __lastPersist = 0;
let __pendingPersist = false;
const PERSIST_THROTTLE_MS = 1000;

// --- Theme Assets ---
// Returns the correct image asset depending on the current theme and click speed.
// Keys: 'base', 'medium', 'fast' must be preserved.
function themeAsset(kind) {
  const map = {
    default: {
      base: "img/sacha twerk.gif",
      medium: "img/moyen.gif",
      fast: "img/gif2.gif",
    },
    normal: {
      base: "img/sacha twerk.gif",
      medium: "img/moyen.gif",
      fast: "img/gif2.gif",
    },
    feu: {
      base: "img/feu_base.png",
      medium: "img/feu_medium.png",
      fast: "img/feu_fast.png",
    },
    glace: {
      base: "img/glace.png",
      medium: "img/glace.png",
      fast: "img/glace.png",
    },
    BW: {
      base: "img/bw_base.png",
      medium: "img/bw_medium.png",
      fast: "img/bw_fast.png",
    }
  };
  // fallback if theme or kind doesn’t exist
  const theme = map[state.theme] || map.default;
  return theme[kind] || theme.base;
}

/*
  SAFE TO EDIT: themeAsset map
  - You can change the 'base', 'medium', 'fast' paths per theme to use different images.
  - Keep the same keys ('base','medium','fast') because code references themeAsset('fast'|'medium'|'base').
*/

// --- Utility: Number Formatting ---
// Adds spaces as thousands separators for readability.
function formatNumber(n) {
  if (typeof n !== 'number') n = Number(n) || 0;
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// --- CPS Computation ---
// Calculates clicks per second (CPS) by counting clicks in the last 1s.
// Updates the CPS indicator element and unlocks an achievement if threshold reached.
function computeAndDisplayCPS() {
  const now = Date.now();
  __clickTimes = __clickTimes.filter(t => now - t <= 1000); // keep last 1s
  const cps = __clickTimes.length;

  if (!__cpsEl) __cpsEl = document.querySelector('.cps-indicator');
  if (__cpsEl) __cpsEl.textContent = `CPS: ${cps}`;

  // Achievement for high CPS
  if (cps >= 12) unlockAchievement('⚡ Frenzy: 12 CPS atteint !');
}
setInterval(computeAndDisplayCPS, 500); // update twice per second

// --- Particle Effects ---
// Visual feedback when clicking: spawns particles around the click zone.
let ctx = null;
let particles = [];
if (el.particlesCanvas) {
  try { ctx = el.particlesCanvas.getContext("2d"); } catch(e) { ctx = null; }
}

// Resize canvas to match container
function resizeCanvas() {
  el.particlesCanvas.width = el.particlesCanvas.clientWidth;
  el.particlesCanvas.height = el.particlesCanvas.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
setTimeout(resizeCanvas, 0);

// Spawn particles at click position
function spawnParticles(color="#fff") {
  const rect = el.clickButton.getBoundingClientRect();
  const zoneRect = el.particlesCanvas.getBoundingClientRect();
  const x = rect.left + rect.width/2 - zoneRect.left;
  const y = rect.top + rect.height/2 - zoneRect.top;
  for (let i=0;i<12;i++) {
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*3,
      vy: (Math.random()-0.5)*3 - Math.random()*2,
      life: 40 + Math.random()*20,
      color
    });
  }
}

// Render loop for particles
function renderParticles() {
  if (!ctx || !el.particlesCanvas) return;
  ctx.clearRect(0,0,el.particlesCanvas.width, el.particlesCanvas.height);
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life/60);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fill();
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // gravity
    p.life -= 1;
  });
  particles = particles.filter(p => p.life > 0);
  requestAnimationFrame(renderParticles);
}
if (ctx) renderParticles();

// --- Scoreboard ---
// Saves current score to localStorage and updates leaderboard.
function saveScore() {
  let scores = JSON.parse(localStorage.getItem("scores")) || [];
  const name = (state.pseudo && state.pseudo.trim()) ? state.pseudo.trim()
    : (el.pseudoInput && el.pseudoInput.value && el.pseudoInput.value.trim()) ? el.pseudoInput.value.trim()
    : 'Anonymous';

  scores.push({pseudo: name, score: state.score});
  scores.sort((a,b) => b.score - a.score);
  scores = scores.slice(0,10); // keep top 10
  localStorage.setItem("scores", JSON.stringify(scores));
  displayScores();
}

// Display leaderboard in UI
function displayScores() {
  let scores = JSON.parse(localStorage.getItem("scores")) || [];
  el.scoreList.innerHTML = "";
  scores.forEach(s => {
    const li = document.createElement("li");
    const name = (s && s.pseudo) ? s.pseudo : 'Anonymous';

    const left = document.createElement('span');
    left.textContent = name;
    const right = document.createElement('span');
    right.textContent = formatNumber(Number(s.score) || 0);

    li.appendChild(left);
    li.appendChild(right);

    // Highlight current player
    if (state.pseudo && state.pseudo === name) li.style.fontWeight = '800';

    el.scoreList.appendChild(li);
  });
}

// Clear all scores
function clearAllScores() {
  localStorage.removeItem('scores');
  displayScores();
}

// --- Persistence ---
// Saves and restores game state to/from localStorage.

// Save current state
function persist() {
  localStorage.setItem("clickerState", JSON.stringify({
    pseudo: state.pseudo,
    score: state.score,
    totalClicks: state.totalClicks,
    autoClickers: state.autoClickers,
    autoClickCost: state.autoClickCost,
    multiplier: state.multiplier,
    multiplierCost: state.multiplierCost,
    critChance: state.critChance,
    critPower: state.critPower,
    critChanceCost: state.critChanceCost,
    critPowerCost: state.critPowerCost,
    tempBoostActive: state.tempBoostActive,
    tempBoostEnd: state.tempBoostEnd,
    tempBoostCost: state.tempBoostCost,
    prestigeCount: state.prestigeCount,
    prestigeBonus: state.prestigeBonus,
    prestigeCost: state.prestigeCost,
    bestTimed: state.bestTimed,
    theme: state.theme,
    soundOn: state.soundOn,
    musicOn: state.musicOn,
    achievementsUnlocked: state.achievementsUnlocked,
    daily: state.daily,
    volumes,
    ownedSkins: state.ownedSkins,
    currentSkin: state.currentSkin,
    soundVolumes: state.soundVolumes,
    soundType: state.soundType,
  }));
}

// Throttled persist wrapper
function throttlePersist() {
  const now = Date.now();
  if (now - __lastPersist > PERSIST_THROTTLE_MS) {
    __lastPersist = now;
    try { persist(); } catch (e) {}
  } else {
    if (!__pendingPersist) {
      __pendingPersist = true;
      setTimeout(() => {
        __pendingPersist = false;
        try { persist(); __lastPersist = Date.now(); } catch(e){}
      }, PERSIST_THROTTLE_MS);
    }
  }
}

// Load saved state
function loadPersisted() {
  const data = localStorage.getItem("clickerState");
  if (!data) return;
  try {
    const s = JSON.parse(data);
    Object.assign(state, s);

    // Restore achievements list
    el.achievementList.innerHTML = "";
    Object.keys(state.achievementsUnlocked || {}).forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      el.achievementList.appendChild(li);
    });
    // Resume music if it was enabled
    if (state.musicOn) {
      const p = el.music.play();
      if (p && typeof p.then === 'function') p.catch(() => {/* ignore autoplay block */});
    }

    // Restore theme (fallback to "default" if missing)
    setTheme(state.theme || "normal");

    // Ensure prestigeCost is present (migration for older saves)
    if (!state.prestigeCost) state.prestigeCost = 20000;

    // --- Restore Volumes ---
    // If old-style `volumes` map exists in save, merge into current volumes
    if (s.volumes) {
      Object.assign(volumes, s.volumes);
      try { if (el.music) el.music.volume = volumes.music; } catch (e) {}
      try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch (e) {}
      try { if (el.critSound) el.critSound.volume = volumes.crit; } catch (e) {}
      try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch (e) {}
    }

    // --- Restore Skins ---
    if (s.ownedSkins) state.ownedSkins = s.ownedSkins;
    if (s.currentSkin) {
      state.currentSkin = s.currentSkin;
      const skin = SKINS.find(x => x.id === s.currentSkin);
      if (skin) {
        try { el.gameImage.src = skin.src; } catch (e) {}
      }
    }

    // --- Restore Sound Volumes and Type ---
    if (s.soundVolumes) {
      state.soundVolumes = s.soundVolumes;
      Object.assign(volumes, state.soundVolumes);
    }
    if (s.soundType) state.soundType = s.soundType;

    // --- Update Slider UI ---
    try {
      const globalVol = document.getElementById('volumeSlider');
      if (globalVol && typeof volumes.music === 'number') {
        globalVol.value = Math.round(volumes.music * 100);
      }

      const typeSel = el.soundTypeSelect;
      const volSlider = el.soundVolumeSlider;

      if (typeSel) typeSel.value = state.soundType || 'click';
      if (typeSel && volSlider) {
        const sel = typeSel.value || state.soundType || 'click';
        volSlider.value = Math.round((volumes[sel] || 0.5) * 100);
      }
    } catch (e) {}
  } catch (e) {
    // Ignore errors during load
  }
}

// --- Initial Audio Unlock ---
// Some browsers block audio until the first user gesture.
// Calling unlockAudio() early increases the chance that sounds
// will be ready if the user interacts quickly after load.
unlockAudio();


// --- Audio Monitoring ---
// Utility to help debug audio loading issues.
// - Logs errors if an audio file is missing or corrupt.
// - Reports the readyState of each audio element (0–4).
function monitorAudio(elAudio, name) {
  if (!elAudio) return;
  elAudio.addEventListener('error', (e) => {
    console.warn(`Audio error for ${name}:`, e, 'src=', elAudio.src);
  });
  try {
    console.log(`Audio ${name} readyState=`, elAudio.readyState, 'src=', elAudio.src);
  } catch (e) {}
}

// Attach monitoring to all audio elements
[el.clickSound, el.critSound, el.achievementSound, el.music]
  .forEach((a, i) => monitorAudio(a, ['click','crit','achievement','music'][i]));


// --- Scoreboard Initialization ---
// Populate the scoreboard immediately on load
displayScores();

// Note: Auto-save has been removed. Scores are only saved when the
// player explicitly clicks the Save button. This prevents the
// scoreboard from being spammed with mid-game values.


// --- Daily Challenge Setup ---
// Ensures a daily challenge exists for the current day.
// If forceNew=true or the stored key is not today, a new challenge is generated.
// Otherwise, restores the existing challenge state and updates the UI.
function ensureDaily(forceNew=false) {
  const todayKey = new Date().toDateString();
  const storedKey = localStorage.getItem("dailyKey");

  if (forceNew || storedKey !== todayKey) {
    // --- New challenge ---
    state.daily.target = 3000 + Math.floor(Math.random()*7000); // random target between 3k–10k
    state.daily.rewardPct = 3 + Math.floor(Math.random()*7);    // random reward between +3%–9%
    state.daily.active = false;
    state.daily.expiresAt = 0;
    state.daily.claimedToday = false;

    // Update UI
    el.dailyInfo.textContent = `Objectif du jour: ${state.daily.target} points. Récompense: +${state.daily.rewardPct}% pendant 10 min.`;
    el.dailyStatus.textContent = "Statut: en attente";

    // Store today’s key so the same challenge persists until tomorrow
    localStorage.setItem("dailyKey", todayKey);
    throttlePersist();

  } else {
    // --- Existing challenge ---
    try {
      el.dailyInfo.textContent = `Objectif du jour: ${state.daily.target} points. Récompense: +${state.daily.rewardPct}% pendant 10 min.`;
    } catch(e){}
    try {
      el.dailyStatus.textContent = state.daily.active ? "Statut: en cours" : "Statut: en attente";
    } catch(e){}

    // Update start button state depending on progress
    const startedKey = localStorage.getItem('dailyStarted');
    const todayStarted = (startedKey === todayKey);

    if (el.startDailyBtn) {
      if (state.daily.claimedToday) {
        el.startDailyBtn.disabled = true;
        el.startDailyBtn.textContent = 'Déjà réussi';
      } else if (state.daily.active || todayStarted) {
        el.startDailyBtn.disabled = true;
        el.startDailyBtn.textContent = 'En cours...';
      } else {
        el.startDailyBtn.disabled = false;
        el.startDailyBtn.textContent = 'Tenter le défi';
      }
    }
  }
}


// --- Daily Challenge Tick ---
// Runs every second to check challenge progress and expiration.
setInterval(() => {
  if (!state.daily.active) return;

  const nowDaily = Date.now();

  // --- Success condition ---
  if (state.score >= state.daily.target && !state.daily.claimedToday) {
    state.daily.claimedToday = true;
    state.daily.active = false;
    state.daily.expiresAt = nowDaily + 10*60*1000; // reward lasts 10 minutes
    state.tempBoostActive = true;
    state.tempBoostEnd = state.daily.expiresAt;

    unlockAchievement(`📅 Défi réussi ! +${state.daily.rewardPct}% pendant 10 min`);
    throttlePersist();

    el.dailyStatus.textContent = "Statut: réussi";
    try {
      if (el.startDailyBtn) {
        el.startDailyBtn.disabled = true;
        el.startDailyBtn.textContent = 'Déjà réussi';
      }
    } catch(e){}
    return;
  }

  // --- Expiration condition ---
  if (nowDaily > state.daily.expiresAt && !state.daily.claimedToday) {
    state.daily.active = false;
    el.dailyStatus.textContent = "Statut: expiré";
    try {
      if (el.startDailyBtn) {
        el.startDailyBtn.disabled = false;
        el.startDailyBtn.textContent = 'Tenter le défi';
      }
    } catch(e){}
  }
}, 1000);

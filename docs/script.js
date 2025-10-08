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
// Main state
const state = {
  pseudo: "",
  score: 0,
  totalClicks: 0,
  autoClickers: 0,
  autoClickCost: 500,
  multiplier: 1,
  multiplierCost: 1000,
  critChance: 0.02,       // 2%
  critPower: 5,          // x5
  critChanceCost: 2000,
  critPowerCost: 3000,
  tempBoostActive: false,
  tempBoostEnd: 0,
  tempBoostCost: 500,
  prestigeCount: 0,
  prestigeBonus: 0,       // +% permanent
  prestigeCost: 20000,    // coût initial pour effectuer un prestige
  lastClickTime: 0,
  bestTimed: 0,
  timedActive: false,
  timedTimeLeft: 60,
  timedScore: 0,
  daily: {
    active: false,
    target: 5000,
    rewardPct: 5,
    expiresAt: 0,
    claimedToday: false
  },
  theme: "default",
  soundOn: true,
  musicOn: false,
  achievementsUnlocked: {},
};
// Selectors
const el = {
  startBtn: document.getElementById("startBtn"),
  pseudoInput: document.getElementById("pseudo"),
  pseudoForm: document.getElementById("pseudoForm"),
  gameArea: document.getElementById("gameArea"),
  score: document.getElementById("score"),
  multiplierStat: document.getElementById("multiplierStat"),
  autoClickStat: document.getElementById("autoClickStat"),
  critStat: document.getElementById("critStat"),
  prestigeStat: document.getElementById("prestigeStat"),
  clickButton: document.getElementById("clicker"),
  gameImage: document.getElementById("gameImage"),
  particlesCanvas: document.getElementById("particlesCanvas"),
  upgradeAuto: document.getElementById("buyAutoClick"),
  upgradeMult: document.getElementById("buyMultiplier"),
  upgradeCritChance: document.getElementById("buyCritChance"),
  upgradeCritPower: document.getElementById("buyCritPower"),
  upgradeTempBoost: document.getElementById("buyTempBoost"),
  doPrestige: document.getElementById("doPrestige"),
  achievementList: document.getElementById("achievementList"),
  achievementToast: document.getElementById("achievementToast"),
  scoreList: document.getElementById("scoreList"),
  bonusButton: document.getElementById("bonusButton"),
  startTimedBtn: document.getElementById("startTimedBtn"),
  timedInfo: document.getElementById("timedInfo"),
  startDailyBtn: document.getElementById("startDailyBtn"),
  dailyInfo: document.getElementById("dailyInfo"),
  dailyStatus: document.getElementById("dailyStatus"),
  musicToggle: document.getElementById("musicToggle"),
  soundToggle: document.getElementById("soundToggle"),
  themeSelect: document.getElementById("themeSelect"),
  saveNowBtn: document.getElementById("saveNowBtn"),
  backBtn: document.getElementById("backBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  resetScoresBtn: document.getElementById("resetScoresBtn"),
  pressHint: document.getElementById("pressHint"),
  clickSound: document.getElementById("clickSound"),
  critSound: document.getElementById("critSound"),
  achievementSound: document.getElementById("achievementSound"),
  music: document.getElementById("music"),
};

// Inactivity timer: when no click happens for 1s, revert the main image to base
let __inactivityTimer = null;
const INACTIVITY_MS = 1000;

// CPS indicator state
let __clickTimes = [];// timestamps of recent clicks
// Simple skins/shop catalog
const SKINS = [
  { id: 'default', name: 'Par défaut', cost: 0, src: 'img/sacha twerk.gif' },
  { id: 'gif2', name: 'Rapide', cost: 5000, src: 'img/gif2.gif' },
  { id: 'pixel', name: 'Pixel', cost: 15000, src: 'img/moyen.gif' },
];

// Per-sound volumes (0..1)
const volumes = {
  music: 0.5,
  click: 0.85,
  crit: 0.5,
  achievement: 0.25,
};
/*
  SAFE TO EDIT: change defaults above (volumes, SKINS, state costs) to tune the game.
  EXAMPLE: set state.multiplierCost = 2000 to increase initial mult cost.
*/

// --- Audio helpers: set sensible defaults and try to "unlock" audio on first user gesture ---
function unlockAudio() {
  const audios = [el.clickSound, el.critSound, el.achievementSound, el.music];
  audios.forEach(a => {
    if (!a) return;
    try {
      // Some hosts require crossOrigin to decode remote audio
      a.crossOrigin = 'anonymous';
      // sensible default volumes
      if (typeof a.volume === 'number') a.volume = 0.85;
      // Try a short play/pause to unlock audio on browsers with autoplay policies
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {
          // ignore - will try again later when user interacts
        });
      }
    } catch (e) {
      // ignore
    }
  });
}
// Try to play music on first user gesture (once)
document.addEventListener("click", tryPlayMusic, { once: true });
document.addEventListener("keydown", tryPlayMusic, { once: true });

function tryPlayMusic() {
  const music = document.getElementById("music");
  const musicToggle = document.getElementById("musicToggle");
  if (musicToggle.checked) {
    music.play().catch(err => console.warn("Lecture bloquée :", err));
  }
}
const volumeSlider = document.getElementById("volumeSlider");
const music = document.getElementById("music");

// Appliquer le volume initial
// Apply initial music volume from saved value if any, otherwise from slider default
try {
  music.volume = (volumes.music !== undefined) ? volumes.music : (volumeSlider.value / 100);
} catch (e) { /* ignore if element missing */ }

// Mettre à jour le volume en temps réel et persister le choix
if (volumeSlider) {
  volumeSlider.addEventListener("input", () => {
    try {
      const v = Number(volumeSlider.value) / 100;
      music.volume = v;
      volumes.music = v;
      state.soundVolumes = state.soundVolumes || {};
      state.soundVolumes.music = v;
      // if the user is currently editing the 'music' type with the other slider, keep it in sync
      const other = document.getElementById('soundTypeSelect');
      const otherSlider = document.getElementById('soundVolumeSlider');
      if (other && other.value === 'music' && otherSlider) otherSlider.value = Math.round(v * 100);
      throttlePersist();
    } catch (e) {}
  });
}

// Initialize volume controls (works before and after Start)
function initVolumeControls() {
  try {
    // ensure persisted volumes are loaded into memory
    try { loadPersisted(); } catch(e) {}
    // DOM references
    const globalVol = document.getElementById('volumeSlider');
    const typeSel = document.getElementById('soundTypeSelect');
    const volSlider = document.getElementById('soundVolumeSlider');

    // Ensure soundVolumes exists in state
    if (!state.soundVolumes) state.soundVolumes = { ...volumes };
    Object.assign(volumes, state.soundVolumes || {});

    // Set audio elements to stored volumes
    try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
    try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
    try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
    try { if (el.music) el.music.volume = volumes.music; } catch(e){}

    // Global music slider
    if (globalVol) {
      globalVol.value = Math.round((volumes.music || 0.5) * 100);
      globalVol.removeEventListener('input', globalVol._listenerForScript || (()=>{}));
      const l = () => {
        try {
          const v = Number(globalVol.value) / 100;
          if (el.music) el.music.volume = v;
          volumes.music = v;
          state.soundVolumes = state.soundVolumes || {};
          state.soundVolumes.music = v;
          // sync per-type UI if selecting music
          if (typeSel && typeSel.value === 'music' && volSlider) volSlider.value = Math.round(v*100);
          throttlePersist();
        } catch(e){}
      };
      globalVol.addEventListener('input', l);
      globalVol._listenerForScript = l;
    }

    // Per-type selector + slider
    if (typeSel && volSlider) {
      typeSel.value = state.soundType || 'click';
      volSlider.value = Math.round(((volumes[typeSel.value] || 0.5)) * 100);

      volSlider.removeEventListener('input', volSlider._listenerForScript || (()=>{}));
      const l2 = (ev) => {
        try {
          const t = typeSel.value;
          const v = Number(ev.target.value) / 100;
          volumes[t] = v;
          state.soundType = t;
          state.soundVolumes = state.soundVolumes || {};
          state.soundVolumes[t] = v;
          // apply
          if (t === 'music' && el.music) el.music.volume = v;
          if (t === 'click' && el.clickSound) el.clickSound.volume = v;
          if (t === 'crit' && el.critSound) el.critSound.volume = v;
          if (t === 'achievement' && el.achievementSound) el.achievementSound.volume = v;
          // keep global slider in sync when changing music via type slider
          if (t === 'music' && document.getElementById('volumeSlider')) document.getElementById('volumeSlider').value = Math.round(v*100);
          throttlePersist();
        } catch(e){}
      };
      volSlider.addEventListener('input', l2);
      volSlider._listenerForScript = l2;

      // when changing selection, update the slider to reflect selected type
      typeSel.removeEventListener('change', typeSel._listenerForScript || (()=>{}));
      const l3 = (ev) => {
        try {
          const t = ev.target.value;
          state.soundType = t;
          volSlider.value = Math.round(((volumes[t] || 0.5)) * 100);
          throttlePersist();
        } catch(e){}
      };
      typeSel.addEventListener('change', l3);
      typeSel._listenerForScript = l3;
    }

    // soundToggle behavior (mute/unmute effects)
    const sToggle = document.getElementById('soundToggle');
    if (sToggle) {
      sToggle.checked = state.soundOn !== false;
      sToggle.removeEventListener('change', sToggle._listenerForScript || (()=>{}));
      const l4 = () => {
        state.soundOn = sToggle.checked;
        if (!state.soundOn) {
          try { if (el.clickSound) el.clickSound.volume = 0; } catch(e){}
          try { if (el.critSound) el.critSound.volume = 0; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = 0; } catch(e){}
        } else {
          try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
          try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
        }
        throttlePersist();
      };
      sToggle.addEventListener('change', l4);
      sToggle._listenerForScript = l4;
    }
  } catch (e) { /* ignore initialization errors */ }
}

// Initialize volume UI on load so controls work before Start
try { initVolumeControls(); } catch (e) {}

// Toggle which volume slider is visible depending on whether we are in-game
function setVolumeUIForGame(inGame) {
  try {
    const globalVol = document.getElementById('volumeSlider');
    const soundControls = document.querySelector('.sound-controls');
    if (globalVol) globalVol.style.display = inGame ? 'none' : '';
    if (soundControls) soundControls.style.display = inGame ? 'flex' : 'none';
  } catch (e) {}
}

// default: not in game yet
try { setVolumeUIForGame(false); } catch (e) {}
// Prepare audio on first Start button click (unlock audio reliably)
if (el.startBtn) {
  el.startBtn.addEventListener("click", () => {
    const clickSound = el.clickSound;
    const critSound = el.critSound;
    const achievementSound = el.achievementSound;

    [clickSound, critSound, achievementSound].forEach(s => {
      if (!s) return;
      try { 
        // make achievement sound quieter than click/crit
        s.volume = (s === achievementSound) ? 0.25 : 0.5;
      } catch (e) {}
      try { s.play().then(() => s.pause()).catch(()=>{}); } catch (e) {}
    });

    // Start music if toggle is on
    if (el.music && el.musicToggle && el.musicToggle.checked) {
      try { el.music.volume = (document.getElementById("volumeSlider")?.value || 50) / 100; } catch (e) {}
      try { el.music.play().catch(()=>{}); } catch (e) {}
    }
  });
}
  // Sounds are preloaded above (played+paused to "unlock" on user gesture).
  // Don't attempt to play a click/crit sound here (no isCrit context).


// Startup
el.startBtn.addEventListener("click", () => {
  try { initVolumeControls(); } catch(e) {}
  const p = el.pseudoInput.value.trim();
  if (!p) {
    alert("Le pseudo est obligatoire !");
    return;
  }
  state.pseudo = p;
  el.pseudoForm.style.display = "none";
  el.gameArea.style.display = "grid";
  // show only the in-game per-type volume slider
  try { setVolumeUIForGame(true); } catch (e) {}
  // Try to unlock audio now that we have a user gesture
  unlockAudio();
  // Show backup button
  try { el.backupBtn.style.display = 'inline-block'; } catch (e) {}
  // Add CPS indicator element if missing
  if (!document.querySelector('.cps-indicator')) {
    const c = document.createElement('div');
    c.className = 'cps-indicator';
    c.textContent = 'CPS: 0';
    document.getElementById('clickZone').appendChild(c);
  }
  // Wire sound type select + single volume slider
  try {
    const typeSel = document.getElementById('soundTypeSelect');
    const volSlider = document.getElementById('soundVolumeSlider');
    // ensure state.soundVolumes exists
    // First, restore persisted state so UI uses saved values
    try { loadPersisted(); } catch(e) {}
    if (!state.soundVolumes) state.soundVolumes = { ...volumes };
    // restore persisted volumes into local volumes map
    Object.assign(volumes, state.soundVolumes || {});
    // apply to elements
    try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
    try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
    try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
    try { if (el.music) el.music.volume = volumes.music; } catch(e){}

    if (typeSel && volSlider) {
      // set slider to currently selected type's volume
      const sel = state.soundType || 'click';
      typeSel.value = sel;
        volSlider.value = Math.round((volumes[sel] || 0.5) * 100);

      function applyTypeVolume(type, valuePct, persist=true) {
        const v = Number(valuePct) / 100;
        volumes[type] = v;
        state.soundType = type;
        state.soundVolumes = state.soundVolumes || {};
        state.soundVolumes[type] = v;
        // apply to element
        try {
          if (type === 'music' && el.music) el.music.volume = v;
          if (type === 'click' && el.clickSound) el.clickSound.volume = v;
          if (type === 'crit' && el.critSound) el.critSound.volume = v;
          if (type === 'achievement' && el.achievementSound) el.achievementSound.volume = v;
        } catch(e){}
        if (persist) throttlePersist();
      }

      typeSel.addEventListener('change', (ev) => {
        const t = ev.target.value;
        volSlider.value = Math.round((volumes[t] || 0.5) * 100);
        state.soundType = t; throttlePersist();
      });
      volSlider.addEventListener('input', (ev) => {
        const t = typeSel.value;
        applyTypeVolume(t, ev.target.value);
      });
    }

    // link soundToggle to muting effects (music has its own control)
    if (el.soundToggle) {
      el.soundToggle.checked = state.soundOn !== false; // default true
      el.soundToggle.addEventListener('change', () => {
        state.soundOn = el.soundToggle.checked;
        if (!state.soundOn) {
          try { if (el.clickSound) el.clickSound.volume = 0; } catch(e){}
          try { if (el.critSound) el.critSound.volume = 0; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = 0; } catch(e){}
        } else {
          // reapply stored volumes
          try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch(e){}
          try { if (el.critSound) el.critSound.volume = volumes.crit; } catch(e){}
          try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch(e){}
        }
        throttlePersist();
      });
    }
  } catch (e) {}

  // Build simple shop skins list inside .shop
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
          // buy or equip
          const owned = (state.ownedSkins || []).includes(s.id);
          if (!owned) {
            if (state.score >= s.cost) {
              state.score -= s.cost;
              state.ownedSkins = state.ownedSkins || [];
              state.ownedSkins.push(s.id);
              state.currentSkin = s.id;
              el.gameImage.src = s.src;
              throttlePersist(); scheduleUpdateUI();
            } else alert('Pas assez de points pour acheter ce skin.');
          } else {
            state.currentSkin = s.id;
            el.gameImage.src = s.src;
            throttlePersist(); scheduleUpdateUI();
          }
        });
        div.appendChild(b);
      });
      shop.appendChild(div);
    }
  } catch (e) {}
  // Show Save and Back buttons only when inside the game
  try { el.saveNowBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.backBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.exportBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.importBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.resetScoresBtn.style.display = 'inline-block'; } catch (e) {}
  try { el.pressHint.style.display = 'block'; } catch (e) {}
  loadPersisted();
  updateUI();
  displayScores();
  scheduleBonusButton();
  ensureDaily();
});

// Keyboard support: Space or Enter triggers click when not focusing inputs
// Protect against holding the key down by ignoring key repeats and applying a small throttle
let __lastKeyClick = 0;
const __KEY_MIN_DELAY = 80; // ms minimum between key-triggered clicks
document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    // ignore the OS/browser autorepeat when key is held
    if (e.repeat) return;
    const now = Date.now();
    if (now - __lastKeyClick < __KEY_MIN_DELAY) return;
    __lastKeyClick = now;
    e.preventDefault();
    // simulate click
    try { el.clickButton.click(); } catch (err) {}
  }
});

// Export/import save (client-side JSON)
el.exportBtn.addEventListener('click', () => {
  const data = localStorage.getItem('clickerState') || JSON.stringify(state);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clicker-save-${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
el.importBtn.addEventListener('click', () => {
  try { el.importFile.click(); } catch (e) {}
});
el.importFile.addEventListener('change', (ev) => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      // Merge minimally
  Object.assign(state, parsed);
  throttlePersist();
  loadPersisted();
  scheduleUpdateUI();
  displayScores();
      alert('Import successful');
    } catch (err) { alert('Invalid import file'); }
  };
  reader.readAsText(f);
});

// Reset scoreboard (clears local scores list)
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

// Back button: return to the initial screen
el.backBtn.addEventListener("click", () => {
  // Reload the page to return to the initial state
  try { location.reload(); } catch (e) { window.location.href = window.location.href; }
});

// Sound / music / theme
el.musicToggle.addEventListener("change", () => {
  state.musicOn = el.musicToggle.checked;
  if (state.musicOn) {
    const p = el.music.play();
    if (p && typeof p.then === 'function') p.catch(() => { /* ignore playback denied */ });
  } else {
    try { el.music.pause(); } catch (e) {}
  }
  throttlePersist();
});
el.soundToggle.addEventListener("change", () => {
  state.soundOn = el.soundToggle.checked;
  throttlePersist();
});
el.themeSelect.addEventListener("change", () => {
  state.theme = el.themeSelect.value;
  setTheme(state.theme);
  throttlePersist();
});
function setTheme(name) {
  document.body.classList.remove("theme-default","theme-fire","theme-ice","theme-pixel");
  document.body.classList.add(`theme-${name}`);
}
setTheme("default");

// Main click
el.clickButton.addEventListener("click", () => {
  const now = Date.now();
  const diff = now - state.lastClickTime;
  state.lastClickTime = now;

  // Critical hit?
  const isCrit = Math.random() < state.critChance;
  let gain = state.multiplier;
  if (state.tempBoostActive) gain *= 2;
  gain *= (1 + state.prestigeBonus / 100);
  if (isCrit) gain *= state.critPower;

  state.score += Math.floor(gain);
  state.totalClicks += 1;

  // Record click timestamp for CPS
  try { __clickTimes.push(Date.now()); } catch (e) {}

  // Click speed: image change + dynamic background
  // Click speed thresholds (ms):
  // fast: <=100ms (10+ cps), medium: 101-167ms (~6-10 cps), base: >167ms (1-6 cps)
    // SAFE TO EDIT: adjust thresholds below to change CPS classification
    // ex: set fast threshold to 120 to make 'fast' easier to reach.
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

  // Sounds
  if (state.soundOn) {
    const s = (isCrit ? el.critSound : el.clickSound);
    try { s.currentTime = 0; } catch (e) {}
    const p = s.play();
    if (p && typeof p.then === 'function') p.catch(() => { /* playback blocked */ });
  }

  spawnParticles(isCrit ? "#ffd700" : "#ffffff");
  scheduleUpdateUI();
  checkClickAchievements();
});

// Make the main image clickable too
try {
  el.gameImage.style.cursor = 'pointer';
  el.gameImage.addEventListener('click', () => {
    try { el.clickButton.click(); } catch (e) {}
  });
} catch (e) {}

// Purchases
el.upgradeAuto.addEventListener("click", () => {
  if (state.score >= state.autoClickCost) {
    state.score -= state.autoClickCost;
    state.autoClickers += 1;
    state.autoClickCost = Math.floor(state.autoClickCost * 1.5);
    checkUpgradeAchievements();
    scheduleUpdateUI();
    throttlePersist();
  } else alert("Pas assez de points !");
});

el.upgradeMult.addEventListener("click", () => {
  if (state.score >= state.multiplierCost) {
    state.score -= state.multiplierCost;
    state.multiplier += 1;
    state.multiplierCost = Math.floor(state.multiplierCost * 2);
    checkUpgradeAchievements();
    scheduleUpdateUI();
    throttlePersist();
  } else alert("Pas assez de points !");
});

el.upgradeCritChance.addEventListener("click", () => {
  if (state.score >= state.critChanceCost) {
    state.score -= state.critChanceCost;
    state.critChance = Math.min(0.5, state.critChance + 0.01); // +1%, max 50%
    state.critChanceCost = Math.floor(state.critChanceCost * 2);
    unlockAchievement(`🎯 Crit% augmenté à ${(state.critChance * 100).toFixed(0)}%`);
    scheduleUpdateUI();
    throttlePersist();
  } else {
    alert("Pas assez de points !");
  }
});


el.upgradeCritPower.addEventListener("click", () => {
  if (state.score >= state.critPowerCost) {
    state.score -= state.critPowerCost;
    state.critPower = Math.min(50, state.critPower + 5); // max x50
    state.critPowerCost = Math.floor(state.critPowerCost * 2);
    scheduleUpdateUI();
    throttlePersist();
  } else alert("Pas assez de points !");
});

el.upgradeTempBoost.addEventListener("click", () => {
  if (state.score >= state.tempBoostCost) {
    state.score -= state.tempBoostCost;
    state.tempBoostActive = true;
    state.tempBoostEnd = Date.now() + 30000; // 30s
    scheduleUpdateUI();
    throttlePersist();
  } else alert("Pas assez de points !");
});

el.doPrestige.addEventListener("click", () => {
  // Verify cost
  if (state.score < (state.prestigeCost || 20000)) {
    alert(`Pas assez de points pour effectuer un prestige. Coût : ${state.prestigeCost}`);
    return;
  }
  if (!confirm(`Prestige coûte ${state.prestigeCost} points et réinitialisera la progression. Continuer ?`)) return;

  // Perform prestige
  state.score -= state.prestigeCost;
  state.prestigeCount += 1;
  state.prestigeBonus += 10;

  // Reset soft
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

  // Double the cost for next prestige
  state.prestigeCost = Math.floor((state.prestigeCost || 20000) * 2);

  unlockAchievement(`🏆 Prestige #${state.prestigeCount}: +10% permanent`);
  scheduleUpdateUI();
  throttlePersist();
  // Visual flair for prestige
  try { showConfetti(); } catch (e) {}
});

// Simple confetti effect (temporary particles)
function showConfetti() {
  const container = document.getElementById('clickZone');
  if (!container) return;
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
  for (let i=0;i<60;i++) pieces.push({ x: Math.random()*cvs.width, y: -10 - Math.random()*cvs.height, vx: (Math.random()-0.5)*4, vy: 2+Math.random()*3, life: 120, color: ['#ffd54f','#ff6a00','#8be9fd','#a777e3'][Math.floor(Math.random()*4)] });
  function step() {
    ctx2.clearRect(0,0,cvs.width,cvs.height);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1;
      ctx2.fillStyle = p.color; ctx2.fillRect(p.x, p.y, 6, 4);
    }
    if (pieces.some(p=>p.life>0)) requestAnimationFrame(step); else { try { cvs.remove(); } catch(e){} }
  }
  requestAnimationFrame(step);
}

// Timed mode
el.startTimedBtn.addEventListener("click", () => {
  if (state.timedActive) return;
  state.timedActive = true;
  state.timedTimeLeft = 60;
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

// Backup button: create timestamped backup of clickerState
if (el.backupBtn) {
  el.backupBtn.addEventListener('click', () => {
    try {
      const key = `clicker_backup_${new Date().toISOString()}`;
      localStorage.setItem(key, localStorage.getItem('clickerState') || JSON.stringify(state));
      alert(`Backup créé: ${key}`);
    } catch (e) { alert('Erreur lors de la création du backup'); }
  });
}

// Daily challenge
el.startDailyBtn.addEventListener("click", () => {
  ensureDaily(true);
  state.daily.active = true;
  state.daily.expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  el.dailyStatus.textContent = "Statut: en cours (10 min)";
  unlockAchievement("📅 Défi quotidien lancé !");
  throttlePersist();
});

// Manual save
el.saveNowBtn.addEventListener("click", () => {
  saveScore();
  unlockAchievement("💾 Score sauvegardé manuellement.");
});

// Auto-click loop
setInterval(() => {
  if (state.autoClickers > 0) {
    let gain = state.autoClickers * state.multiplier;
    if (state.tempBoostActive) gain *= 2;
    gain *= (1 + state.prestigeBonus / 100);
    state.score += Math.floor(gain);
    if (state.timedActive) state.timedScore += Math.floor(gain);
    // console.log('auto -> gain', gain, 'new score', state.score);
    scheduleUpdateUI();
  }
  // End boost
  if (state.tempBoostActive && Date.now() > state.tempBoostEnd) {
    state.tempBoostActive = false;
    unlockAchievement("⚡ Fin du boost de 30s.");
    scheduleUpdateUI();
  }
}, 1000);

// Random bonus popup
function scheduleBonusButton() {
  setTimeout(() => {
    if (!el.bonusButton) return; // guard if button missing in DOM
    el.bonusButton.style.display = "block";
    el.bonusButton.style.right = `${12 + Math.random()*40}px`;
    el.bonusButton.style.top = `${-8 + Math.random()*40}px`;
    setTimeout(() => {
      el.bonusButton.style.display = "none";
      scheduleBonusButton();
    }, 5000);
  }, 15000 + Math.random()*15000);
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


// Achievements
function unlockAchievement(text) {
  if (state.achievementsUnlocked[text]) return;
  state.achievementsUnlocked[text] = true;

  const li = document.createElement("li");
  li.textContent = text;
  el.achievementList.appendChild(li);

  el.achievementToast.textContent = text;
  el.achievementToast.style.display = "block";
  if (state.soundOn) {
    try { el.achievementSound.currentTime = 0; } catch (e) {}
    try { el.achievementSound.volume = 0.25; } catch (e) {}
    const p = el.achievementSound.play();
    if (p && typeof p.then === 'function') p.catch(() => {/* ignore */});
  }
  setTimeout(() => el.achievementToast.style.display = "none", 2000);
  throttlePersist();
}

// Click achievements up to 10M
const clickMilestones = [100, 1000, 10000, 100000, 1000000, 10000000];
function checkClickAchievements() {
  for (const m of clickMilestones) {
    if (state.totalClicks === m) {
      unlockAchievement(`💥 ${state.pseudo} a atteint ${m.toLocaleString()} clics !`);
    }
  }
  // score affects timed mode
  if (state.timedActive) state.timedScore += state.multiplier;
}

// Upgrade achievements every 10 levels
function checkUpgradeAchievements() {
  if (state.autoClickers > 0 && state.autoClickers % 10 === 0) {
    unlockAchievement(`⚙️ ${state.pseudo} a atteint ${state.autoClickers} Auto-Clickers !`);
  }
  if (state.multiplier > 0 && state.multiplier % 10 === 0) {
    unlockAchievement(`🔥 Multiplicateur x${state.multiplier} atteint !`);
  }
}

// UI / Stats / Buttons
function updateUI() {
  // Only update DOM when values changed to reduce reflows
  if (!updateUI._prev) updateUI._prev = {};
  const prev = updateUI._prev;
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
  for (const [key, val] of mappings) {
    if (!el[key]) continue;
    if (prev[key] !== val) {
      el[key].textContent = val;
      prev[key] = val;
    }
  }
  // Update prestige button label if present
  if (el.doPrestige) {
    const cost = state.prestigeCost || 20000;
    const label = `Prestige (Coût : ${formatNumber(cost)})`;
    if (updateUI._prev.doPrestige !== label) {
      el.doPrestige.textContent = label;
      updateUI._prev.doPrestige = label;
    }
  }

  // Dynamic background based on score (subtle)
  const p = Math.min(1, state.score / 100000);
  document.body.style.background = `linear-gradient(135deg, rgba(110,142,251,1), rgba(167,119,227,${Math.max(0.4, p)}))`;

  // Music toggle UI
  if (el.musicToggle) el.musicToggle.checked = state.musicOn;
  if (el.soundToggle) el.soundToggle.checked = state.soundOn;
  if (el.themeSelect) el.themeSelect.value = state.theme;
}

// Schedule UI updates via requestAnimationFrame to avoid redundant DOM work
let __uiScheduled = false;
function scheduleUpdateUI() {
  if (__uiScheduled) return;
  __uiScheduled = true;
  requestAnimationFrame(() => {
    try { updateUI(); } catch (e) { console.warn('updateUI error', e); }
    __uiScheduled = false;
  });
}

// Persist throttle: avoid writing to localStorage too often
let __lastPersist = 0;
let __pendingPersist = false;
const PERSIST_THROTTLE_MS = 1000;

// Skins / assets per theme
function themeAsset(kind) {
  const t = state.theme;
  // you can replace these URLs with your own images (assets/default.png etc.)
  const map = {
    default: {
      base: "img/sacha twerk.gif",
      medium: "img/moyen.gif",
      fast: "img/gif2.gif",
    },
    fire: {
      base: "img/sacha twerk.gif",
      medium: "https://via.placeholder.com/150/ff6a00/ffffff?text=Chaud",
      fast: "img/gif2.gif",
    },
    ice: {
      base: "img/sacha twerk.gif",
      medium: "img/moyen.gif",
      fast: "img/gif2.gif",
    },
    pixel: {
      base: "img/sacha twerk.gif",
      medium: "img/moyen.gif",
      fast: "img/gif2.gif",
    }
  };
  return map[t][kind] || map.default.base;
}
/*
  SAFE TO EDIT: themeAsset map
  - You can change the 'base', 'medium', 'fast' paths per theme to use different images.
  - Keep the same keys ('base','medium','fast') because code references themeAsset('fast'|'medium'|'base').
*/

// Utility: format numbers with spaces as thousands separators for readability
function formatNumber(n) {
  if (typeof n !== 'number') n = Number(n) || 0;
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// CPS computation and display
function computeAndDisplayCPS() {
  const now = Date.now();
  // Remove timestamps older than 1s
  __clickTimes = __clickTimes.filter(t => now - t <= 1000);
  const cps = __clickTimes.length;
  const elC = document.querySelector('.cps-indicator');
  if (elC) elC.textContent = `CPS: ${cps}`;
  // achievements: if CPS high
  // SAFE TO EDIT: CPS achievement threshold
  if (cps >= 12) unlockAchievement('⚡ Frenzy: 12 CPS atteint !');
}
setInterval(computeAndDisplayCPS, 250);

// Particles
const ctx = el.particlesCanvas.getContext("2d");
let particles = [];
function resizeCanvas() {
  el.particlesCanvas.width = el.particlesCanvas.clientWidth;
  el.particlesCanvas.height = el.particlesCanvas.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
setTimeout(resizeCanvas, 0);

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
function renderParticles() {
  ctx.clearRect(0,0,el.particlesCanvas.width, el.particlesCanvas.height);
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life/60);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fill();
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life -= 1;
  });
  particles = particles.filter(p => p.life > 0);
  requestAnimationFrame(renderParticles);
}
renderParticles();

// Scoreboard
function saveScore() {
  let scores = JSON.parse(localStorage.getItem("scores")) || [];
  // require a non-empty pseudo to save
  // Prefer the in-state pseudo, fall back to the input field, otherwise use 'Anonymous'
  const name = (state.pseudo && state.pseudo.trim()) ? state.pseudo.trim()
    : (el.pseudoInput && el.pseudoInput.value && el.pseudoInput.value.trim()) ? el.pseudoInput.value.trim()
    : 'Anonymous';
  scores.push({pseudo: name, score: state.score});
  scores.sort((a,b) => b.score - a.score);
  scores = scores.slice(0,10); // Top 10
  localStorage.setItem("scores", JSON.stringify(scores));
  displayScores();
}
function displayScores() {
  let scores = JSON.parse(localStorage.getItem("scores")) || [];
  el.scoreList.innerHTML = "";
  scores.forEach(s => {
    const li = document.createElement("li");
      // create a two-column entry: name left, score right (show anonymous if present)
      const name = (s && s.pseudo) ? s.pseudo : 'Anonymous';
      const left = document.createElement('span');
      left.textContent = name;
      const right = document.createElement('span');
      right.textContent = formatNumber(Number(s.score) || 0);
      li.appendChild(left);
      li.appendChild(right);
      // highlight current player if matches
      if (state.pseudo && state.pseudo === name) li.style.fontWeight = '800';
    el.scoreList.appendChild(li);
  });
}

// Clear all stored scores (requested by user)
function clearAllScores() {
  localStorage.removeItem('scores');
  displayScores();
}

// Execute immediate reset as requested
clearAllScores();

// Persistence
function persist() {
  // NOTE: This writes the `clickerState` object into localStorage.
  // SAFE TO EDIT: you can add/remove simple scalar fields here (numbers, strings, booleans).
  // CAUTION: removing or renaming keys will break restore logic and older saves. If you change keys,
  // update `loadPersisted()` to handle migrations.
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
      setTimeout(() => { __pendingPersist = false; try { persist(); __lastPersist = Date.now(); } catch(e){} }, PERSIST_THROTTLE_MS);
    }
  }
}
function loadPersisted() {
  const data = localStorage.getItem("clickerState");
  if (!data) return;
  try {
    const s = JSON.parse(data);
    // Merge saved data into current state. Safe to add new fields in future releases.
    Object.assign(state, s);
      // Restore achievements list
    el.achievementList.innerHTML = "";
    Object.keys(state.achievementsUnlocked || {}).forEach(text => {
      const li = document.createElement("li");
      li.textContent = text;
      el.achievementList.appendChild(li);
    });
    if (state.musicOn) {
      const p = el.music.play();
      if (p && typeof p.then === 'function') p.catch(() => {/* ignore */});
    }
    setTheme(state.theme || "default");
    // Ensure prestigeCost present
    if (!state.prestigeCost) state.prestigeCost = 20000;
  // restore volumes and audio element volumes
  // SAFE TO EDIT: If you change the persisted schema, add migration code here to support older saves.
    if (s.volumes) {
      Object.assign(volumes, s.volumes);
      try { if (el.music) el.music.volume = volumes.music; } catch (e) {}
      try { if (el.clickSound) el.clickSound.volume = volumes.click; } catch (e) {}
      try { if (el.critSound) el.critSound.volume = volumes.crit; } catch (e) {}
      try { if (el.achievementSound) el.achievementSound.volume = volumes.achievement; } catch (e) {}
    }
    // restore skins
    if (s.ownedSkins) state.ownedSkins = s.ownedSkins;
    if (s.currentSkin) {
      state.currentSkin = s.currentSkin;
      const skin = SKINS.find(x => x.id === s.currentSkin);
      if (skin) {
        try { el.gameImage.src = skin.src; } catch (e) {}
      }
    }
      // restore soundVolumes and selected sound type
      if (s.soundVolumes) {
        state.soundVolumes = s.soundVolumes;
        Object.assign(volumes, state.soundVolumes);
      }
      if (s.soundType) state.soundType = s.soundType;
      // Update slider UI elements if present so they reflect stored values
      try {
        const globalVol = document.getElementById('volumeSlider');
        if (globalVol && typeof volumes.music === 'number') globalVol.value = Math.round(volumes.music * 100);
        const typeSel = document.getElementById('soundTypeSelect');
        const volSlider = document.getElementById('soundVolumeSlider');
        if (typeSel) typeSel.value = state.soundType || 'click';
        if (typeSel && volSlider) {
          const sel = typeSel.value || state.soundType || 'click';
          volSlider.value = Math.round((volumes[sel] || 0.5) * 100);
        }
      } catch (e) {}
  } catch (e) {}
}

// Try an initial unlock in case the user interacts quickly
unlockAudio();

// Monitor audio elements for loading errors (helps debug missing/corrupt filenames)
function monitorAudio(elAudio, name) {
  if (!elAudio) return;
  elAudio.addEventListener('error', (e) => {
    console.warn(`Audio error for ${name}:`, e, 'src=', elAudio.src);
  });
  // report readyState (0 = HAVE_NOTHING .. 4 = HAVE_ENOUGH_DATA)
  try {
    console.log(`Audio ${name} readyState=`, elAudio.readyState, 'src=', elAudio.src);
  } catch (e) {}
}
[el.clickSound, el.critSound, el.achievementSound, el.music].forEach((a, i) => monitorAudio(a, ['click','crit','achievement','music'][i]));

// Populate scoreboard on load
displayScores();

// Auto save
setInterval(() => {
  if (state.pseudo) {
    saveScore();
    throttlePersist();
  }
}, 10000);

// Daily
function ensureDaily(forceNew=false) {
  const todayKey = new Date().toDateString();
  const storedKey = localStorage.getItem("dailyKey");
  if (forceNew || storedKey !== todayKey) {
  // New challenge
    state.daily.target = 3000 + Math.floor(Math.random()*7000); // 3k-10k
    state.daily.rewardPct = 3 + Math.floor(Math.random()*7); // 3-9%
    state.daily.active = false;
    state.daily.expiresAt = 0;
    state.daily.claimedToday = false;
    el.dailyInfo.textContent = `Objectif du jour: ${state.daily.target} points. Récompense: +${state.daily.rewardPct}% pendant 10 min.`;
    el.dailyStatus.textContent = "Statut: en attente";
    localStorage.setItem("dailyKey", todayKey);
    throttlePersist();
  } else {
    el.dailyInfo.textContent = `Objectif du jour: ${state.daily.target} points. Récompense: +${state.daily.rewardPct}% pendant 10 min.`;
    el.dailyStatus.textContent = state.daily.active ? "Statut: en cours" : "Statut: en attente";
  }
}

// Daily challenge tick
setInterval(() => {
  if (state.daily.active) {
    if (state.score >= state.daily.target && !state.daily.claimedToday) {
      state.daily.claimedToday = true;
      state.daily.active = false;
      state.daily.expiresAt = Date.now() + 10*60*1000;
      state.tempBoostActive = true;
      state.tempBoostEnd = state.daily.expiresAt;
      unlockAchievement(`📅 Défi réussi ! +${state.daily.rewardPct}% pendant 10 min`);
  throttlePersist();
      el.dailyStatus.textContent = "Statut: réussi";
    } else if (Date.now() > state.daily.expiresAt && !state.daily.claimedToday) {
      state.daily.active = false;
      el.dailyStatus.textContent = "Statut: expiré";
    }
  }
}, 1000);
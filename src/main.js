import './styles/main.css';
import { ChromaDriftEngine } from './game/engine.js';
import { PALETTE_THEMES } from './game/constants.js';

const viewport = document.getElementById('app');
const canvas = document.getElementById('game-canvas');

const hudTop = document.getElementById('hud-top');
const hudKeys = document.getElementById('hud-keys');
const hudScore = document.getElementById('hud-score');
const hudZone = document.getElementById('hud-zone');
const hudMultiplier = document.getElementById('hud-multiplier');
const hudSpeed = document.getElementById('hud-speed');
const hudNovaPct = document.getElementById('hud-nova-pct');
const hudNovaFill = document.getElementById('hud-nova-fill');
const novaProgressbar = document.getElementById('nova-progressbar');
const shieldPips = Array.from(document.querySelectorAll('#hud-shields .shield-pip'));
const hudCallout = document.getElementById('hud-callout');
const hudCamLabel = document.getElementById('hud-cam-label');
const hudAudioLabel = document.getElementById('hud-audio-label');

const overlayTitle = document.getElementById('overlay-title');
const overlayGameover = document.getElementById('overlay-gameover');
const titleBestScore = document.getElementById('title-best-score');
const titleBestDist = document.getElementById('title-best-dist');

const goScore = document.getElementById('go-score');
const goBest = document.getElementById('go-best');
const goDistance = document.getElementById('go-distance');
const goCombo = document.getElementById('go-combo');
const goGates = document.getElementById('go-gates');
const goKills = document.getElementById('go-kills');

const btnLaunch = document.getElementById('btn-launch');
const btnRetry = document.getElementById('btn-retry');
const btnBackTitle = document.getElementById('btn-back-title');
const btnCamera = document.getElementById('btn-camera');
const btnAudio = document.getElementById('btn-audio');
const btnSettings = document.getElementById('btn-settings');
const btnTitleSettings = document.getElementById('btn-title-settings');

const settingsDialog = document.getElementById('settings-dialog');
const selectResolution = document.getElementById('select-resolution');
const selectPalette = document.getElementById('select-palette');
const rangeBrightness = document.getElementById('range-brightness');
const brightnessValLabel = document.getElementById('brightness-val-label');
const rangeBloom = document.getElementById('range-bloom');
const bloomValLabel = document.getElementById('bloom-val-label');
const selectCamera = document.getElementById('select-camera');

const freqPills = {
  cyan: document.getElementById('pill-cyan'),
  magenta: document.getElementById('pill-magenta'),
  gold: document.getElementById('pill-gold'),
};

const keycapMap = new Map();
for (const el of document.querySelectorAll('.keycap[data-key]')) {
  keycapMap.set(el.dataset.key, el);
}
const novaKeycap = keycapMap.get('KeyX');

const KEY_ALIAS = {
  ArrowLeft: 'KeyA',
  ArrowRight: 'KeyD',
  ArrowUp: 'KeyW',
  ArrowDown: 'KeyS',
  Digit1: 'KeyQ',
  Digit2: 'KeyE',
  Digit3: 'KeyR',
  ShiftRight: 'ShiftLeft',
  ControlLeft: 'KeyC',
  ControlRight: 'KeyC',
  KeyJ: 'KeyF',
  Enter: 'KeyF',
  KeyG: 'KeyX',
};

let calloutTimer = 0;
function showCallout(text) {
  hudCallout.textContent = text;
  hudCallout.classList.add('is-visible');
  clearTimeout(calloutTimer);
  calloutTimer = window.setTimeout(() => {
    hudCallout.classList.remove('is-visible');
  }, 1600);
}

let currentTheme = PALETTE_THEMES.prism;
let currentFreq = 'cyan';

function syncCssColors() {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--freq-cyan', currentTheme.cyanCss);
  rootStyle.setProperty('--freq-magenta', currentTheme.magentaCss);
  rootStyle.setProperty('--freq-gold', currentTheme.goldCss);
  const accentCss = currentTheme[`${currentFreq}Css`] || currentTheme.cyanCss;
  rootStyle.setProperty('--active-accent', accentCss);
}

function updateFreqPills(freq) {
  currentFreq = freq;
  for (const [k, el] of Object.entries(freqPills)) {
    el.classList.toggle('is-active', k === freq);
  }
  syncCssColors();
}

const engine = new ChromaDriftEngine(canvas, {
  isModalOpen() {
    return settingsDialog.open;
  },
  onStateChange(newState) {
    const playing = newState === 'playing';
    hudTop.hidden = !playing;
    hudKeys.hidden = !playing;
    overlayTitle.hidden = newState !== 'title';
    overlayGameover.hidden = newState !== 'gameover';
    titleBestScore.textContent = engine.highScore.toLocaleString();
    titleBestDist.textContent = `${engine.bestDistance.toLocaleString()} m`;
  },
  onFrequencyChanged(freq) {
    updateFreqPills(freq);
  },
  onPaletteUpdated(theme) {
    currentTheme = theme;
    syncCssColors();
  },
  onCameraChanged(idx, name) {
    hudCamLabel.textContent = name;
    selectCamera.value = String(idx);
  },
  onNovaChange(active) {
    viewport.dataset.nova = active ? 'true' : 'false';
  },
  onCallout(msg) {
    showCallout(msg);
  },
  onToggleAudio() {
    const muted = engine.sound.toggleMute();
    hudAudioLabel.textContent = muted ? 'MUTED' : 'SYNTH';
    showCallout(muted ? 'AUDIO MUTED' : 'SYNTH AUDIO ON');
  },
  onRequestTogglePause() {
    if (settingsDialog.open) {
      closeTopLayer(settingsDialog);
    } else {
      openSettings();
    }
  },
  onKeyVisual(code, pressed) {
    const mapped = KEY_ALIAS[code] || code;
    const cap = keycapMap.get(mapped);
    if (cap) {
      cap.classList.toggle('is-pressed', pressed);
    }
  },
  onClearKeys() {
    for (const cap of keycapMap.values()) {
      cap.classList.remove('is-pressed');
    }
  },
  onTelemetry(t) {
    hudScore.textContent = t.score.toLocaleString();
    hudZone.textContent = t.zoneName;
    hudMultiplier.textContent = `x${t.combo.toFixed(1)}`;
    hudSpeed.textContent = `${t.speedKmh} KM/H`;

    hudNovaPct.textContent = t.isNova ? 'OVERDRIVE' : `${t.novaPct}%`;
    hudNovaFill.style.width = `${t.novaPct}%`;
    novaProgressbar.setAttribute('aria-valuenow', String(t.novaPct));
    const ready = t.novaPct >= 100 && !t.isNova;
    novaProgressbar.dataset.ready = ready ? 'true' : 'false';
    if (novaKeycap) novaKeycap.classList.toggle('is-ready', ready);

    shieldPips.forEach((pip, idx) => {
      pip.classList.toggle('active', idx < t.shields);
    });
  },
  onGameOver(stats) {
    hudTop.hidden = true;
    hudKeys.hidden = true;
    overlayGameover.hidden = false;
    goScore.textContent = stats.score.toLocaleString();
    goBest.textContent = stats.bestScore.toLocaleString();
    goDistance.textContent = `${stats.distance.toLocaleString()} m`;
    goCombo.textContent = `x${stats.peakCombo.toFixed(1)}`;
    goGates.textContent = String(stats.gatesPhased);
    goKills.textContent = String(stats.dronesShattered);
  },
});

// Initial UI sync
titleBestScore.textContent = engine.highScore.toLocaleString();
titleBestDist.textContent = `${engine.bestDistance.toLocaleString()} m`;
updateFreqPills('cyan');

// Buttons
btnLaunch.addEventListener('click', () => {
  btnLaunch.blur();
  engine.startGame();
});
btnRetry.addEventListener('click', () => {
  btnRetry.blur();
  engine.startGame();
});
btnBackTitle.addEventListener('click', () => {
  btnBackTitle.blur();
  engine.returnToTitle();
});
btnCamera.addEventListener('click', () => {
  btnCamera.blur();
  engine.cycleCamera();
});
btnAudio.addEventListener('click', () => {
  btnAudio.blur();
  const muted = engine.sound.toggleMute();
  hudAudioLabel.textContent = muted ? 'MUTED' : 'SYNTH';
});

// Settings controls + persistence
function applySavedVisualSettings() {
  const savedRes = localStorage.getItem('chromadrift_res');
  if (savedRes) {
    selectResolution.value = savedRes;
    engine.setResolutionScale(Number(savedRes));
  }
  const savedPalette = localStorage.getItem('chromadrift_palette');
  if (savedPalette && PALETTE_THEMES[savedPalette]) {
    selectPalette.value = savedPalette;
    engine.setPalette(savedPalette);
  }
  const savedBrightness = localStorage.getItem('chromadrift_brightness');
  const brightVal = savedBrightness ? Number(savedBrightness) : 0.8;
  rangeBrightness.value = String(brightVal);
  brightnessValLabel.textContent = `${Math.round(brightVal * 100)}%`;
  engine.setObjectBrightness(brightVal);

  const savedBloom = localStorage.getItem('chromadrift_bloom');
  const bloomVal = savedBloom ? Number(savedBloom) : 0.45;
  rangeBloom.value = String(bloomVal);
  bloomValLabel.textContent = `${Math.round(bloomVal * 100)}%`;
  engine.setBloomStrength(bloomVal);
}

applySavedVisualSettings();

selectResolution.addEventListener('change', (e) => {
  localStorage.setItem('chromadrift_res', e.target.value);
  engine.setResolutionScale(Number(e.target.value));
});
selectPalette.addEventListener('change', (e) => {
  localStorage.setItem('chromadrift_palette', e.target.value);
  engine.setPalette(e.target.value);
});
rangeBrightness.addEventListener('input', (e) => {
  const val = Number(e.target.value);
  localStorage.setItem('chromadrift_brightness', String(val));
  engine.setObjectBrightness(val);
  brightnessValLabel.textContent = `${Math.round(val * 100)}%`;
});
rangeBloom.addEventListener('input', (e) => {
  const val = Number(e.target.value);
  localStorage.setItem('chromadrift_bloom', String(val));
  engine.setBloomStrength(val);
  bloomValLabel.textContent = `${Math.round(val * 100)}%`;
});
selectCamera.addEventListener('change', (e) => {
  engine.setCameraMode(Number(e.target.value));
});

// Native <dialog> top-layer exit transition support (modern-web-guidance)
let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

async function closeTopLayer(element) {
  if (!element.open) return;
  if (!supportsTopLayerExit()) {
    element.setAttribute('data-closing', '');
    const animations = element.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 400)),
      ]);
    }
    if (!element.hasAttribute('data-closing')) return;
    element.removeAttribute('data-closing');
  }
  element.close();
}

function openSettings() {
  if (!settingsDialog.open) {
    engine.setPaused(true);
    settingsDialog.showModal();
  }
}

// Pause gameplay whenever settings invoker is activated (whether via native commandfor or fallback)
btnSettings.addEventListener('click', () => {
  engine.setPaused(true);
  if (!('commandForElement' in HTMLButtonElement.prototype) && !settingsDialog.open) {
    settingsDialog.showModal();
  }
});

btnTitleSettings.addEventListener('click', () => {
  if (!('commandForElement' in HTMLButtonElement.prototype) && !settingsDialog.open) {
    settingsDialog.showModal();
  }
});

// Intercept Esc / cancel and form method="dialog" submit for animated top-layer close
settingsDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeTopLayer(settingsDialog);
});

settingsDialog.addEventListener('submit', (event) => {
  if (event.target.method === 'dialog' && !supportsTopLayerExit()) {
    event.preventDefault();
    closeTopLayer(settingsDialog);
  }
});

// Progressive fallback for closedby="any" light dismiss
if (!('closedBy' in HTMLDialogElement.prototype)) {
  const outside = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  settingsDialog.addEventListener('pointerdown', (e) => {
    pressedOutside = outside(e, settingsDialog);
  });
  settingsDialog.addEventListener('pointerup', (e) => {
    if (pressedOutside && outside(e, settingsDialog)) {
      closeTopLayer(settingsDialog);
    }
  });
}

settingsDialog.addEventListener('close', () => {
  settingsDialog.returnValue = '';
  engine.setPaused(false);
});

// Pause rendering automatically when viewport is skipped by content-visibility
viewport.style.contentVisibility = 'auto';
viewport.style.containIntrinsicSize = 'auto 100vw auto 100vh';
viewport.addEventListener('contentvisibilityautostatechange', (event) => {
  engine.setRenderSuspended(event.skipped);
});

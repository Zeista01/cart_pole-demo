'use strict';

// ════════════════════════════════════════════════════════════
//  LIVE TUNER  — floating panel to edit controller gains
//  in real-time without reloading the page.
//
//  Shows sliders for the active controller only.
//  LQR: Q weights [x, xdot, theta, thetadot] and R
//  MPC: Q weights, R, horizon Nh, iterations Ni
//  PID: Kp/Ki/Kd for angle and position, iMax
// ════════════════════════════════════════════════════════════

// ── Default snapshots for "Reset to defaults" ──────────────
const DEFAULTS = {
  lqr: {
    Q0: P.Qlqr[0], Q1: P.Qlqr[1], Q2: P.Qlqr[2], Q3: P.Qlqr[3],
    R:  P.Rlqr,
  },
  mpc: {
    Q0: P.Qmpc[0], Q1: P.Qmpc[1], Q2: P.Qmpc[2], Q3: P.Qmpc[3],
    R:  P.Rmpc,
    Nh: P.Nh,
    Ni: P.Ni,
  },
  pid: { ...P.pid },
};

// ── Build the panel HTML ────────────────────────────────────
function buildTunerHTML() {
  return `
<div id="tuner">
  <div id="tuner-header">
    <span id="tuner-title">⚙ LIVE TUNER</span>
    <span id="tuner-mode-label" class="lqr">LQR</span>
    <button id="tuner-close">✕</button>
  </div>

  <div id="tuner-tabs">
    <button class="tuner-tab active lqr" data-tab="lqr">LQR</button>
    <button class="tuner-tab mpc"        data-tab="mpc">MPC</button>
    <button class="tuner-tab pid"        data-tab="pid">PID</button>
  </div>

  <!-- ── LQR section ── -->
  <div class="tuner-section active" id="tab-lqr">
    <div class="tuner-group-label">State cost  Q = diag(…)</div>
    ${sliderRow('lqr','lqr-q0','Q[x]',       0.01, 20,  0.01, P.Qlqr[0])}
    ${sliderRow('lqr','lqr-q1','Q[ẋ]',       0.01, 20,  0.01, P.Qlqr[1])}
    ${sliderRow('lqr','lqr-q2','Q[θ]',       1,   100,  0.5,  P.Qlqr[2])}
    ${sliderRow('lqr','lqr-q3','Q[θ̇]',      0.01, 20,  0.01, P.Qlqr[3])}
    <div class="tuner-group-label">Control cost</div>
    ${sliderRow('lqr','lqr-r', 'R',           0.001,1,  0.001,P.Rlqr)}
  </div>

  <!-- ── MPC section ── -->
  <div class="tuner-section" id="tab-mpc">
    <div class="tuner-group-label">State cost  Q = diag(…)</div>
    ${sliderRow('mpc','mpc-q0','Q[x]',       0.01, 20,  0.01, P.Qmpc[0])}
    ${sliderRow('mpc','mpc-q1','Q[ẋ]',       0.01, 20,  0.01, P.Qmpc[1])}
    ${sliderRow('mpc','mpc-q2','Q[θ]',       1,   100,  0.5,  P.Qmpc[2])}
    ${sliderRow('mpc','mpc-q3','Q[θ̇]',      0.01, 20,  0.01, P.Qmpc[3])}
    <div class="tuner-group-label">Control cost & horizon</div>
    ${sliderRow('mpc','mpc-r', 'R',           0.001,1,  0.001,P.Rmpc)}
    ${sliderRow('mpc','mpc-nh','Horizon N',   5,   40,  1,    P.Nh,   true)}
    ${sliderRow('mpc','mpc-ni','Iters/frame', 4,   30,  1,    P.Ni,   true)}
  </div>

  <!-- ── PID section ── -->
  <div class="tuner-section" id="tab-pid">
    <div class="tuner-group-label">Angle loop  (dominant)</div>
    ${sliderRow('pid','pid-kp-th','Kp θ',    1,  200, 0.5,  P.pid.Kp_th)}
    ${sliderRow('pid','pid-ki-th','Ki θ',    0,   20, 0.1,  P.pid.Ki_th)}
    ${sliderRow('pid','pid-kd-th','Kd θ',    0,   30, 0.1,  P.pid.Kd_th)}
    <div class="tuner-group-label">Position loop  (secondary)</div>
    ${sliderRow('pid','pid-kp-x', 'Kp x',   0,   30, 0.1,  P.pid.Kp_x)}
    ${sliderRow('pid','pid-ki-x', 'Ki x',   0,    5, 0.05, P.pid.Ki_x)}
    ${sliderRow('pid','pid-kd-x', 'Kd x',   0,   30, 0.1,  P.pid.Kd_x)}
    <div class="tuner-group-label">Anti-windup</div>
    ${sliderRow('pid','pid-imax', 'iMax',    1,   50, 0.5,  P.pid.iMax)}
  </div>

  <div id="tuner-footer">
    <button class="tuner-foot-btn reset-btn" id="tuner-reset">↺ Defaults</button>
    <button class="tuner-foot-btn apply-btn lqr" id="tuner-apply">▶ Apply &amp; Reset</button>
  </div>
  <div id="tuner-hint">Changes apply live · drag header to move</div>
</div>`;
}

function sliderRow(cls, id, label, min, max, step, val, integer=false) {
  const disp = integer ? Math.round(val) : +val.toFixed(3);
  return `
  <div class="tuner-row">
    <span class="tuner-label">${label}</span>
    <input type="range" class="${cls}" id="${id}"
           min="${min}" max="${max}" step="${step}" value="${val}">
    <span class="tuner-value" id="${id}-val">${disp}</span>
  </div>`;
}

// ── State ───────────────────────────────────────────────────
let _tunerActiveTab = 'lqr';
let _tunerVisible   = false;
let _dragOff        = null;   // {dx, dy} for header-drag

// ── Init ────────────────────────────────────────────────────
function initTuner() {
  document.body.insertAdjacentHTML('beforeend', buildTunerHTML());
  const panel = document.getElementById('tuner');

  // Close button
  document.getElementById('tuner-close').addEventListener('click', hideTuner);

  // Tab switching
  document.querySelectorAll('.tuner-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _tunerActiveTab = btn.dataset.tab;
      refreshTunerTabs();
    });
  });

  // All sliders — live update
  panel.querySelectorAll('input[type=range]').forEach(sl => {
    sl.addEventListener('input', () => {
      updateValueLabel(sl);
      applySliderToP(sl);
    });
  });

  // Reset to defaults
  document.getElementById('tuner-reset').addEventListener('click', resetTunerDefaults);

  // Apply & Reset sim
  document.getElementById('tuner-apply').addEventListener('click', () => {
    applyAllSliders();
    if (sim.mode === 'LQR') { sim.lqrData = solveLQR(); }
    if (sim.mode === 'MPC') { _mpcNeedsInit = true; }
    if (sim.mode === 'PID') { pidReset(); }
    resetSim();
  });

  // Draggable header
  const header = document.getElementById('tuner-header');
  header.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup',   endDrag);

  // Prevent canvas mousedown from firing while interacting with panel
  panel.addEventListener('mousedown', e => e.stopPropagation());
  panel.addEventListener('click',     e => e.stopPropagation());

  syncTunerToMode();
}

// ── Visibility ──────────────────────────────────────────────
function showTuner() {
  _tunerVisible = true;
  document.getElementById('tuner').classList.add('visible');
  syncTunerToMode();
}
function hideTuner() {
  _tunerVisible = false;
  document.getElementById('tuner').classList.remove('visible');
}
function toggleTuner() { _tunerVisible ? hideTuner() : showTuner(); }

// ── Sync tuner UI to current sim mode ───────────────────────
function syncTunerToMode() {
  const mode = sim.mode.toLowerCase();

  // Update mode badge
  const badge = document.getElementById('tuner-mode-label');
  badge.textContent = sim.mode;
  badge.className = mode;

  // Switch to matching tab automatically if that tab exists
  if (['lqr','mpc','pid'].includes(mode)) _tunerActiveTab = mode;

  refreshTunerTabs();
  updateApplyBtn();
}

function refreshTunerTabs() {
  document.querySelectorAll('.tuner-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _tunerActiveTab);
  });
  document.querySelectorAll('.tuner-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === 'tab-' + _tunerActiveTab);
  });
}

function updateApplyBtn() {
  const btn = document.getElementById('tuner-apply');
  if (!btn) return;
  btn.className = `tuner-foot-btn apply-btn ${sim.mode.toLowerCase()}`;
}

// ── Apply a single slider change immediately to P ───────────
function applySliderToP(sl) {
  const v = parseFloat(sl.value);
  switch (sl.id) {
    // LQR
    case 'lqr-q0': P.Qlqr[0] = v; recomputeLQR(); break;
    case 'lqr-q1': P.Qlqr[1] = v; recomputeLQR(); break;
    case 'lqr-q2': P.Qlqr[2] = v; recomputeLQR(); break;
    case 'lqr-q3': P.Qlqr[3] = v; recomputeLQR(); break;
    case 'lqr-r':  P.Rlqr    = v; recomputeLQR(); break;
    // MPC
    case 'mpc-q0': P.Qmpc[0] = v; _mpcNeedsInit = true; break;
    case 'mpc-q1': P.Qmpc[1] = v; _mpcNeedsInit = true; break;
    case 'mpc-q2': P.Qmpc[2] = v; _mpcNeedsInit = true; break;
    case 'mpc-q3': P.Qmpc[3] = v; _mpcNeedsInit = true; break;
    case 'mpc-r':  P.Rmpc    = v; _mpcNeedsInit = true; break;
    case 'mpc-nh': P.Nh      = Math.round(v); _mpcNeedsInit = true; break;
    case 'mpc-ni': P.Ni      = Math.round(v); break;
    // PID
    case 'pid-kp-th': P.pid.Kp_th = v; break;
    case 'pid-ki-th': P.pid.Ki_th = v; break;
    case 'pid-kd-th': P.pid.Kd_th = v; break;
    case 'pid-kp-x':  P.pid.Kp_x  = v; break;
    case 'pid-ki-x':  P.pid.Ki_x  = v; break;
    case 'pid-kd-x':  P.pid.Kd_x  = v; break;
    case 'pid-imax':  P.pid.iMax   = v; break;
  }
}

// LQR re-solve is expensive; debounce it
let _lqrTimer = null;
function recomputeLQR() {
  clearTimeout(_lqrTimer);
  _lqrTimer = setTimeout(() => {
    if (typeof solveLQR === 'function') sim.lqrData = solveLQR();
  }, 120);
}

function applyAllSliders() {
  document.querySelectorAll('#tuner input[type=range]').forEach(sl => applySliderToP(sl));
}

// ── Update the value display next to a slider ────────────────
function updateValueLabel(sl) {
  const valEl = document.getElementById(sl.id + '-val');
  if (!valEl) return;
  const isInt = sl.step === '1';
  valEl.textContent = isInt ? Math.round(sl.value) : (+parseFloat(sl.value).toFixed(3));
}

// ── Reset sliders to factory defaults ───────────────────────
function resetTunerDefaults() {
  const d = DEFAULTS;
  setSlider('lqr-q0', d.lqr.Q0); setSlider('lqr-q1', d.lqr.Q1);
  setSlider('lqr-q2', d.lqr.Q2); setSlider('lqr-q3', d.lqr.Q3);
  setSlider('lqr-r',  d.lqr.R);

  setSlider('mpc-q0', d.mpc.Q0); setSlider('mpc-q1', d.mpc.Q1);
  setSlider('mpc-q2', d.mpc.Q2); setSlider('mpc-q3', d.mpc.Q3);
  setSlider('mpc-r',  d.mpc.R);
  setSlider('mpc-nh', d.mpc.Nh); setSlider('mpc-ni', d.mpc.Ni);

  setSlider('pid-kp-th', d.pid.Kp_th); setSlider('pid-ki-th', d.pid.Ki_th);
  setSlider('pid-kd-th', d.pid.Kd_th); setSlider('pid-kp-x',  d.pid.Kp_x);
  setSlider('pid-ki-x',  d.pid.Ki_x);  setSlider('pid-kd-x',  d.pid.Kd_x);
  setSlider('pid-imax',  d.pid.iMax);

  applyAllSliders();
  if (typeof solveLQR === 'function') sim.lqrData = solveLQR();
  _mpcNeedsInit = true;
  pidReset();
}

function setSlider(id, val) {
  const sl = document.getElementById(id);
  if (!sl) return;
  sl.value = val;
  updateValueLabel(sl);
}

// ── Drag to move panel ───────────────────────────────────────
function startDrag(e) {
  const panel = document.getElementById('tuner');
  const rect  = panel.getBoundingClientRect();
  _dragOff = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
  panel.style.transform = 'none';
  panel.style.left = rect.left + 'px';
  panel.style.top  = rect.top  + 'px';
}
function onDrag(e) {
  if (!_dragOff) return;
  const panel = document.getElementById('tuner');
  panel.style.left = (e.clientX - _dragOff.dx) + 'px';
  panel.style.top  = (e.clientY - _dragOff.dy) + 'px';
}
function endDrag() { _dragOff = null; }
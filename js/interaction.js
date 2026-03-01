'use strict';

// ════════════════════════════════════════════════════════════
//  INTERACTION  —  mouse, touch, keyboard
// ════════════════════════════════════════════════════════════

let dragging = false;

// ── Button hit-testing ──────────────────────────────────────
function tryBtnClick(mx, my) {
  for (const [id, btn] of Object.entries(BTNS)) {
    if (mx >= btn.x && mx <= btn.x + btn.w &&
        my >= btn.y && my <= btn.y + btn.h) {
      handleBtn(id);
      return true;
    }
  }
  return false;
}

function handleBtn(id) {
  if      (id === 'LQR')          { switchMode('LQR'); }
  else if (id === 'MPC')          { switchMode('MPC'); }
  else if (id === 'PID')          { switchMode('PID'); }
  else if (id === 'restart')      { resetSim(); }
  else if (id === 'challenge')    { sim.challenge = !sim.challenge; sim.challengeTimer = 2; }
  else if (id === 'dlLQR')        { downloadCSV('LQR'); }
  else if (id === 'dlMPC')        { downloadCSV('MPC'); }
  else if (id === 'dlPID')        { downloadCSV('PID'); }
  else if (id === 'tune')         { toggleTuner(); }
  // Mobile tab switching
  else if (id === 'tab_plot')     { mobileTab = 'plot'; }
  else if (id === 'tab_state')    { mobileTab = 'state'; }
  else if (id === 'tab_info')     { mobileTab = 'info'; }
  // Mobile plot sub-tabs
  else if (id === 'subPlot_angle')   { mobilePlotTab = 'angle'; }
  else if (id === 'subPlot_control') { mobilePlotTab = 'control'; }
  else if (id === 'subPlot_phase')   { mobilePlotTab = 'phase'; }
  // Mobile push buttons
  else if (id === 'pushLeft')     { sim.pushU = -P.pushMag; sim.pushTimer = P.pushDur; }
  else if (id === 'pushRight')    { sim.pushU =  P.pushMag; sim.pushTimer = P.pushDur; }
}

function switchMode(mode) {
  sim.mode = mode;
  mpcU.fill(0);
  pidReset();
  resetSim();
  if (typeof syncTunerToMode === 'function') syncTunerToMode();
}

// ── Push force from pointer position ────────────────────────
function applyPush(mx) {
  const cartX = SX + sim.s[0] * SC;
  const dir   = mx > cartX ? 1 : -1;
  const dist  = Math.abs(mx - cartX);
  const mag   = Math.min(1, dist / (SC * 1.4));
  sim.pushU     = dir * P.pushMag * (0.5 + mag * 0.6);
  sim.pushTimer = P.pushDur;
}

// ── Mouse ───────────────────────────────────────────────────
cvs.addEventListener('mousedown', e => {
  if (tryBtnClick(e.clientX, e.clientY)) return;
  if (!sim.alive) { resetSim(); return; }
  // On mobile layout, only push if click is in simulation area
  if (isMobile() && (e.clientY < _simTop || e.clientY > _simBot)) return;
  dragging = true;
  applyPush(e.clientX);
});
cvs.addEventListener('mousemove',  e => { if (dragging && sim.alive) applyPush(e.clientX); });
cvs.addEventListener('mouseup',    () => { dragging = false; });
cvs.addEventListener('mouseleave', () => { dragging = false; });

// ── Touch ───────────────────────────────────────────────────
cvs.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  if (tryBtnClick(t.clientX, t.clientY)) return;
  if (!sim.alive) { resetSim(); return; }
  // Only push if touch is in simulation area (mobile) or anywhere (desktop)
  if (isMobile() && (t.clientY < _simTop || t.clientY > _simBot)) return;
  dragging = true;
  applyPush(t.clientX);
}, { passive: false });

cvs.addEventListener('touchmove', e => {
  e.preventDefault();
  if (dragging && sim.alive) applyPush(e.touches[0].clientX);
}, { passive: false });

cvs.addEventListener('touchend', () => { dragging = false; });

// ── Keyboard ────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const key = e.code || e.key;
  switch (key) {
    case 'Space':
      e.preventDefault();
      if (!sim.alive) resetSim();
      break;
    case 'ArrowLeft':
    case 'KeyA':
      sim.pushU = -P.pushMag; sim.pushTimer = 0.22; break;
    case 'ArrowRight':
    case 'KeyD':
      sim.pushU =  P.pushMag; sim.pushTimer = 0.22; break;
    case 'KeyL': switchMode('LQR'); break;
    case 'KeyM': switchMode('MPC'); break;
    case 'KeyI': switchMode('PID'); break;
    case 'KeyC': sim.challenge = !sim.challenge; sim.challengeTimer = 2; break;
    case 'KeyR': resetSim(); break;
    case 'KeyQ': downloadCSV('LQR'); break;
    case 'KeyP': downloadCSV('MPC'); break;
    case 'KeyO': downloadCSV('PID'); break;
    case 'KeyT': toggleTuner(); break;
    case 'BracketLeft':  P.Qlqr[2] = Math.max(1,   P.Qlqr[2] - 2);  sim.lqrData = solveLQR(); break;
    case 'BracketRight': P.Qlqr[2] = Math.min(100, P.Qlqr[2] + 2);  sim.lqrData = solveLQR(); break;
  }
});

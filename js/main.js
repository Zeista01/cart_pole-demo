'use strict';

// ════════════════════════════════════════════════════════════
//  CSV LOGGING
// ════════════════════════════════════════════════════════════
const csvLog = {
  LQR: [],
  MPC: [],
  PID: [],
};
const CSV_HEADER = 'run,t,x,xdot,theta_rad,thetadot,u,alive\n';

function logTick(mode, run, t, s, u, alive) {
  csvLog[mode].push(`${run},${t.toFixed(4)},${s[0].toFixed(5)},${s[1].toFixed(5)},${s[2].toFixed(5)},${s[3].toFixed(5)},${u.toFixed(4)},${alive ? 1 : 0}`);
}

function downloadCSV(mode) {
  const content = CSV_HEADER + csvLog[mode].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${mode.toLowerCase()}_log.csv`;
  a.click();
}

// Expose globally for console access too
window.downloadLQR = () => downloadCSV('LQR');
window.downloadMPC = () => downloadCSV('MPC');
window.downloadPID = () => downloadCSV('PID');
window.csvLog = csvLog;

// ════════════════════════════════════════════════════════════
//  SIMULATION STATE
// ════════════════════════════════════════════════════════════
const sim = {
  s:              [0, 0, 0.08, 0],  // [x, xdot, theta, thetadot]
  u:              0,
  mode:           'LQR',
  lqrData:        null,             // filled by solveLQR()
  alive:          true,
  time:           0,
  balTime:        0,
  pushU:          0,
  pushTimer:      0,
  challenge:      false,
  challengeTimer: 3,
  flash:          0,
  history:        [],
  lqrBest:        0,
  mpcBest:        0,
  pidBest:        0,
  runId:          { LQR: 0, MPC: 0, PID: 0 },  // per-mode run counters
};

// ════════════════════════════════════════════════════════════
//  PER-RUN METRICS
//  Tracked separately for LQR and MPC so the comparison table
//  always shows numbers from the most-recent run of each.
// ════════════════════════════════════════════════════════════
const metrics = {
  LQR: { balTime: 0, settleTime: null, peakAngle: 0, effort: 0, _settledFor: 0 },
  MPC: { balTime: 0, settleTime: null, peakAngle: 0, effort: 0, _settledFor: 0 },
  PID: { balTime: 0, settleTime: null, peakAngle: 0, effort: 0, _settledFor: 0 },
};

function resetMetricsForMode(mode) {
  metrics[mode] = { balTime: 0, settleTime: null, peakAngle: 0, effort: 0, _settledFor: 0 };
}

// ════════════════════════════════════════════════════════════
//  RESET
// ════════════════════════════════════════════════════════════
function resetSim(th0 = 0.08) {
  // Preserve best times across resets
  if (sim.alive || sim.balTime > 0.5) {
    const key = sim.mode === 'LQR' ? 'lqrBest' : sim.mode === 'MPC' ? 'mpcBest' : 'pidBest';
    if (sim.balTime > sim[key]) sim[key] = sim.balTime;
  }
  resetMetricsForMode(sim.mode);
  sim.runId[sim.mode]++;

  sim.s            = [0, 0, th0 + (Math.random() - 0.5) * 0.06, 0];
  sim.u            = 0;
  sim.alive        = true;
  sim.time         = 0;
  sim.balTime      = 0;
  sim.pushU        = 0;
  sim.pushTimer    = 0;
  sim.history      = [];
  sim.challengeTimer = 3;
  sim.flash        = 0;
  mpcU.fill(0);
  _mpcNeedsInit = true;   // force LQR warm-start on next mpcStep call
  pidReset();             // clear PID integrators
}

// ════════════════════════════════════════════════════════════
//  SIMULATION TICK  (called once per animation frame)
// ════════════════════════════════════════════════════════════
function tick(dt) {
  if (!sim.alive) return;

  const sv = sim.s;

  // ── Controller ──────────────────────────────────────────
  let u = 0;
  if (sim.mode === 'LQR' && sim.lqrData) {
    const K = sim.lqrData.K;
    u = -(K[0]*sv[0] + K[1]*sv[1] + K[2]*sv[2] + K[3]*sv[3]);
  } else if (sim.mode === 'MPC') {
    u = mpcStep(sv);
  } else if (sim.mode === 'PID') {
    u = pidStep(sv, dt);
  }

  // ── Manual push ─────────────────────────────────────────
  if (sim.pushTimer > 0) {
    u += sim.pushU;
    sim.pushTimer -= dt;
  }

  // ── Challenge mode ──────────────────────────────────────
  if (sim.challenge) {
    sim.challengeTimer -= dt;
    if (sim.challengeTimer <= 0) {
      sim.pushU     = P.pushMag * (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random());
      sim.pushTimer = 0.3;
      sim.flash     = 1.0;
      sim.challengeTimer = 1.8 + Math.random() * 2.5;
    }
  }
  sim.flash = Math.max(0, sim.flash - dt * 4);

  // Saturate
  u = Math.max(-P.Umax*1.5, Math.min(P.Umax*1.5, u));
  sim.u = u;

  // ── Integrate (sub-steps at dtInner) ───────────────────
  const steps = Math.max(1, Math.round(dt / P.dtInner));
  const dts   = dt / steps;
  let s = sim.s;
  for (let i = 0; i < steps; i++) {
    s = rk4(s, u, dts);
    // Soft wall: damp velocity near track ends
    const ex = Math.abs(s[0]) - P.trackLen;
    if (ex > 0) {
      s[1] -= Math.sign(s[0]) * ex * 60 * dts;
      s[0]  = Math.max(-P.trackLen, Math.min(P.trackLen, s[0]));
    }
  }

  if (s.some(v => !isFinite(v))) {
    logTick(sim.mode, sim.runId[sim.mode], sim.time, s, u, false);
    sim.alive = false; return;
  }
  sim.s    = s;
  sim.time += dt;

  // ── Failure check ───────────────────────────────────────
  if (Math.abs(s[2]) > Math.PI * 0.65) {
    logTick(sim.mode, sim.runId[sim.mode], sim.time, s, u, false);
    sim.alive = false;
    const key = sim.mode === 'LQR' ? 'lqrBest' : sim.mode === 'MPC' ? 'mpcBest' : 'pidBest';
    if (sim.balTime > sim[key]) sim[key] = sim.balTime;
    return;
  }
  sim.balTime += dt;

  // ── Log this tick ─────────────────────────────────────────
  logTick(sim.mode, sim.runId[sim.mode], sim.time, s, u, true);

  // ── Update metrics for active controller ─────────────────
  const m = metrics[sim.mode];
  m.balTime = sim.balTime;
  m.effort += u * u * dt;          // ∫u²dt
  const absT = Math.abs(s[2]);
  if (absT > m.peakAngle) m.peakAngle = absT;

  // Settle time: first time |θ| stays below threshold for settleDur seconds
  if (m.settleTime === null) {
    if (absT < P.settleThresh) {
      m._settledFor += dt;
      if (m._settledFor >= P.settleDur) m.settleTime = sim.balTime - P.settleDur;
    } else {
      m._settledFor = 0;
    }
  }

  // ── History for plots ────────────────────────────────────
  sim.history.push({ th: s[2], thd: s[3], u: sim.u, t: sim.time });
  if (sim.history.length > P.maxHist) sim.history.shift();
}

// ════════════════════════════════════════════════════════════
//  MAIN LOOP
// ════════════════════════════════════════════════════════════
let lastTs = null;

function frame(ts) {
  if (lastTs === null) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);  // cap at 50 ms
  lastTs = ts;
  tick(dt);
  draw();
  requestAnimationFrame(frame);
}

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
console.log('Solving CARE (continuous-time algebraic Riccati equation)…');
sim.lqrData = solveLQR();
console.log('LQR K =', Array.from(sim.lqrData.K).map(v => v.toFixed(3)));

resetSim();
requestAnimationFrame(frame);

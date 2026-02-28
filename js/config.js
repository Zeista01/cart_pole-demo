'use strict';

// ════════════════════════════════════════════════════════════
//  GLOBAL PARAMETERS  (edit here to tune the whole demo)
// ════════════════════════════════════════════════════════════
const P = {
  // ── Physical system ─────────────────────────────────────
  M: 1.0,          // cart mass  (kg)
  m: 0.3,          // pole mass  (kg)
  L: 0.6,          // pole half-length (m)
  g: 9.81,         // gravity    (m/s²)
  b: 0.1,          // cart friction coefficient
  trackLen: 2.7,   // half-track length (m)
  Umax: 30,        // actuator saturation (N)
  dtInner: 0.002,  // physics timestep  (500 Hz)

  // ── LQR weights ─────────────────────────────────────────
  //  State cost diag(Q) = [x, xdot, theta, thetadot]
  Qlqr: [1.0, 0.8, 20.0, 2.5],
  Rlqr: 0.01,

  // ── MPC parameters ──────────────────────────────────────
  Nh:    22,       // prediction horizon steps
  Ni:    12,       // gradient-descent iterations per frame
  dtMpc: 0.025,    // MPC timestep (s)
  Qmpc:  [1.0, 0.8, 28.0, 3.0],
  Rmpc:  0.01,

  // ── Interaction ──────────────────────────────────────────
  pushMag: 22,     // manual push force (N)
  pushDur: 0.22,   // push duration   (s)

  // ── Metrics ─────────────────────────────────────────────
  settleThresh: 0.035,  // ~2° in radians
  settleDur:    0.5,    // seconds pole must stay within threshold

  // ── History buffers ──────────────────────────────────────
  maxHist: 500,

  // ── PID gains ────────────────────────────────────────────
  //  Tuned for the default plant (M=1, m=0.3, L=0.6, g=9.81)
  //  Angle loop is dominant; position loop is soft correction.
  pid: {
    // Gains derived from LQR solution (Q=diag[1,0.8,20,2.5], R=0.01)
    // Closed-loop poles ≈ [-27, -1.7±1.2j, -1.4]  (all stable)
    Kp_th:  64.0,   // proportional  — angle    (≈ |K_lqr[2]|)
    Ki_th:   2.0,   // integral      — angle
    Kd_th:   9.8,   // derivative    — angle    (≈ |K_lqr[3]|)
    Kp_x:   10.0,   // proportional  — position (≈ K_lqr[0])
    Ki_x:    0.5,   // integral      — position
    Kd_x:   15.3,   // derivative    — position (≈ K_lqr[1])
    iMax:    8.0,   // anti-windup clamp for both integrals
  },
};

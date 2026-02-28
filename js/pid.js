'use strict';

// ════════════════════════════════════════════════════════════
//  PID CONTROLLER  —  Parallel form with anti-windup
//
//  Sign convention (verified against LQR K matrix):
//    When pole leans RIGHT (θ > 0), cart must push RIGHT (u > 0)
//    to get underneath it — so angle terms are POSITIVE.
//    When cart drifts RIGHT (x > 0), pull it back LEFT (u < 0)
//    so position terms are NEGATIVE.
//
//    u = +(Kp_th·θ  + Ki_th·∫θ  + Kd_th·θ̇ )   ← angle loop
//        -(Kp_x·x   + Ki_x·∫x   + Kd_x·ẋ  )   ← position loop
//
//  Gains tuned to match LQR closed-loop eigenvalues:
//    K_lqr ≈ [10, 15.3, -64.3, -9.8]  (for Q=diag[1,0.8,20,2.5], R=0.01)
//  Anti-windup: integrals clamped to ±iMax.
// ════════════════════════════════════════════════════════════

const pidState = {
  intTheta: 0,   // ∫ θ dt
  intX:     0,   // ∫ x dt
};

let _pidNeedsInit = true;

function pidReset() {
  pidState.intTheta = 0;
  pidState.intX     = 0;
  _pidNeedsInit     = true;
}

function pidStep(s, dt) {
  if (_pidNeedsInit) {
    _pidNeedsInit = false;
    return 0;
  }

  const [x, xdot, theta, thetadot] = s;
  const { Kp_th, Ki_th, Kd_th, Kp_x, Ki_x, Kd_x, iMax } = P.pid;

  // Accumulate integrals with anti-windup clamp
  pidState.intTheta = Math.max(-iMax, Math.min(iMax, pidState.intTheta + theta * dt));
  pidState.intX     = Math.max(-iMax, Math.min(iMax, pidState.intX     + x     * dt));

  // Angle loop: POSITIVE — push cart in same direction pole is leaning
  const uTheta =  (Kp_th * theta   + Ki_th * pidState.intTheta + Kd_th * thetadot);

  // Position loop: NEGATIVE — pull cart back to centre
  const uX     = -(Kp_x  * x      + Ki_x  * pidState.intX     + Kd_x  * xdot);

  return uTheta + uX;
}

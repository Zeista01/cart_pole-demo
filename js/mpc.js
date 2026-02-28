'use strict';

// ════════════════════════════════════════════════════════════
//  MPC  —  Receding-horizon gradient-descent shooting
//
//  Each frame:
//    1. Warm-start: LQR rollout on first call; shift left on subsequent.
//    2. Run Ni gradient-descent iterations (batch update, normalised step).
//    3. Apply mpcU[0] to the plant; keep remaining inputs for next frame.
//
//  Key fixes vs original:
//    • Warm-starts with LQR rollout instead of all-zeros to avoid the
//      u=0 local minimum (cost landscape has a shallow basin at zero
//      that traps the solver when starting cold).
//    • Cost includes xdot penalty (Qmpc[1]) — was accidentally skipped.
//    • Batch gradient update: all Nh gradients computed before any step.
//    • Normalised gradient step (lr ∝ Umax/‖g‖) prevents saturation.
// ════════════════════════════════════════════════════════════

/** Warm-started control sequence over the horizon. */
const mpcU = new Float64Array(P.Nh);

/** Set to true whenever we need a fresh LQR seed (first call, mode switch, reset). */
let _mpcNeedsInit = true;

/**
 * Seed mpcU by rolling out the LQR controller from state s0.
 * This puts us in the correct basin of attraction from the start.
 */
function mpcSeedLQR(s0) {
  const { Nh, dtMpc, Umax } = P;
  const K = (typeof sim !== 'undefined' && sim.lqrData) ? sim.lqrData.K : null;
  let ss = [...s0];
  for (let k = 0; k < Nh; k++) {
    let u = 0;
    if (K) u = -(K[0]*ss[0] + K[1]*ss[1] + K[2]*ss[2] + K[3]*ss[3]);
    mpcU[k] = Math.max(-Umax, Math.min(Umax, u));
    ss = rk4(ss, u, dtMpc);
  }
  _mpcNeedsInit = false;
}

/**
 * Evaluate stage-plus-terminal cost for a control sequence.
 * Includes all four state costs: x, xdot, theta, thetadot.
 */
function mpcCost(s0, U) {
  let s = [...s0];
  let J = 0;
  const { Nh, dtMpc, Umax, Qmpc, Rmpc } = P;
  const Qf = 15;
  for (let k = 0; k < Nh; k++) {
    const u = Math.max(-Umax, Math.min(Umax, U[k]));
    const [x, xd, th, thd] = s;
    J += Qmpc[0]*x*x + Qmpc[1]*xd*xd + Qmpc[2]*th*th + Qmpc[3]*thd*thd + Rmpc*u*u;
    s = rk4(s, u, dtMpc);
  }
  const [x, xd, th, thd] = s;
  J += Qf * (Qmpc[0]*x*x + Qmpc[1]*xd*xd + Qmpc[2]*th*th + Qmpc[3]*thd*thd);
  return J;
}

/**
 * One MPC solve (warm-start + gradient descent).
 * Mutates mpcU in place, returns the first control action.
 */
function mpcStep(s0) {
  const { Nh, Ni, Umax } = P;

  // ── Warm-start ──────────────────────────────────────────
  if (_mpcNeedsInit) {
    mpcSeedLQR(s0);          // seed from LQR rollout to avoid u=0 trap
  } else {
    mpcU.copyWithin(0, 1);   // receding horizon: shift left one step
    mpcU[Nh - 1] = mpcU[Nh - 2];
  }

  // ── Batch gradient descent ──────────────────────────────
  const eps  = 1.0;                     // finite-difference perturbation (N)
  const grad = new Float64Array(Nh);

  for (let it = 0; it < Ni; it++) {
    const J0 = mpcCost(s0, mpcU);

    // Compute ALL gradients before applying any update (true batch GD)
    for (let k = 0; k < Nh; k++) {
      mpcU[k] += eps;
      grad[k]  = (mpcCost(s0, mpcU) - J0) / eps;
      mpcU[k] -= eps;           // restore exactly before evaluating next k
    }

    // Fixed step size lr=0.5 N/unit-gradient — tuned to stay in the correct
    // basin without overshooting. (Normalised lr = 2*Umax/‖g‖ was too large
    // and would flip the warm-started solution on the first iteration.)
    const lr = 0.5;

    for (let k = 0; k < Nh; k++) {
      mpcU[k] -= lr * grad[k];
      mpcU[k]  = Math.max(-Umax, Math.min(Umax, mpcU[k]));
    }
  }

  return mpcU[0];
}

/**
 * Roll out the current control sequence → predicted state trajectory.
 * Used for drawing the MPC ghost on screen.
 */
function mpcPredict(s0) {
  let s = [...s0];
  const traj = [{ x: s[0], th: s[2] }];
  const { Nh, dtMpc, Umax } = P;
  for (let k = 0; k < Nh; k++) {
    const u = Math.max(-Umax, Math.min(Umax, mpcU[k]));
    s = rk4(s, u, dtMpc);
    traj.push({ x: s[0], th: s[2] });
  }
  return traj;
}
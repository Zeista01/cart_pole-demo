'use strict';

// ════════════════════════════════════════════════════════════
//  NONLINEAR DYNAMICS  (Lagrangian cart-pole)
//  State vector: s = [x, ẋ, θ, θ̇]   θ = 0 → upright
// ════════════════════════════════════════════════════════════

/**
 * Continuous-time derivatives of the cart-pole state.
 * @param {number[]} s  - state [x, xdot, theta, thetadot]
 * @param {number}   u  - applied force on cart (N)
 * @returns {number[]} ds/dt
 */
function deriv([x, xd, th, thd], u) {
  const { M, m, L, g, b } = P;
  const st = Math.sin(th), ct = Math.cos(th);
  const D  = M + m * st * st;            // effective inertia denominator
  const xdd  = (u - b * xd + m * L * thd * thd * st + m * g * st * ct) / D;
  const thdd = (-(M + m) * g * st - ct * (u - b * xd + m * L * thd * thd * st)) / (L * D);
  return [xd, xdd, thd, thdd];
}

/**
 * 4th-order Runge-Kutta integration step.
 */
function rk4(s, u, dt) {
  const k1 = deriv(s, u);
  const s2  = s.map((v, i) => v + 0.5 * dt * k1[i]);
  const k2  = deriv(s2, u);
  const s3  = s.map((v, i) => v + 0.5 * dt * k2[i]);
  const k3  = deriv(s3, u);
  const s4  = s.map((v, i) => v + dt * k3[i]);
  const k4  = deriv(s4, u);
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

// ════════════════════════════════════════════════════════════
//  LINEARISATION  (around upright equilibrium θ = 0)
//  ẋ = A·x + B·u
// ════════════════════════════════════════════════════════════

/**
 * Returns the linearised (A, Bv) matrices at the upright equilibrium.
 * Bv is the 4-element column vector (B is 4×1).
 * @returns {{ A: number[][], Bv: number[] }}
 */
function getLinearizedMatrices() {
  const { M, m, L, g, b } = P;
  const A = [
    [0,  1,             0,          0],
    [0, -b / M,         m * g / M,  0],
    [0,  0,             0,          1],
    [0,  b / (L * M),  -(M + m) * g / (L * M), 0],
  ];
  const Bv = [0, 1 / M, 0, -1 / (L * M)];
  return { A, Bv };
}

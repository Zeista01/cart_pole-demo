# Inverted Pendulum — LQR vs MPC vs PID

A browser-native, zero-dependency control-theory demo.
Push the pole with your mouse and watch three classical controllers fight to keep it upright in real time.

## 🌐 Live Demo

**[[TEST IT OUT](https://zeista01.github.io/cart_pole-demo/)]**

---

## What's inside

| Panel | What it shows |
|---|---|
| **State vector** | x, ẋ, θ, θ̇, u, balance time — updated every frame |
| **Linearised model** | Full A matrix and B vector at the upright equilibrium |
| **Closed-loop eigenvalues** | λ₁…λ₄ of (A − BK), colour-coded by stability |
| **θ(t) plot** | Angle history with ±90° danger zones |
| **u(t) plot** | Control input history with saturation markers |
| **Phase portrait** | θ vs θ̇ trace + live dot |
| **Comparison table** | Balance time, settling time, peak angle, ∫u²dt — LQR vs MPC vs PID |
| **Live Tuner** | Drag-and-drop floating panel to edit all gains in real time |

---

## Controllers

### LQR — Linear Quadratic Regulator

Solves the **continuous-time Algebraic Riccati Equation (CARE)** offline, then applies a fixed linear state-feedback law online:

```
A'P + PA − (1/R) PBB'P + Q = 0     ← CARE (solved once at startup)
K = R⁻¹ B' P                        ← optimal gain matrix
u = −Kx                              ← O(1) online policy
```

**Weights (default)**

```
Q = diag(1.0, 0.8, 20.0, 2.5)    ← penalises  x, ẋ, θ, θ̇
R = 0.01                           ← penalises control effort
```

A high `Q[θ]` relative to `R` produces aggressive corrections; lower values trade stability margin for smoothness. The gain vector K and closed-loop eigenvalues are shown live on screen.

**Online cost:** O(1) — runs at 500 Hz sub-steps inside the physics integrator.

---

### MPC — Model Predictive Control

Receding-horizon **gradient-descent shooting** over a finite future window:

```
minimise   Σ (Q·xₖ² + R·uₖ²)  +  Qf·x_N²     over U = {u₀ … u_{N-1}}
subject to  xₖ₊₁ = f(xₖ, uₖ)  (nonlinear RK4)
            |uₖ| ≤ Umax
```

**How it works each frame:**
1. **Warm-start** — shift previous solution left by one step; seed the last element from the prior tail
2. **Batch gradient descent** — compute all N finite-difference gradients, then take one step (prevents premature convergence)
3. **Apply u₀** to the real plant; retain u₁…u_{N-1} for next frame
4. **Ghost overlay** — the predicted trajectory is drawn on screen

**Parameters (default)**

```
Horizon  Nh  = 22 steps  ×  dtMpc = 0.025 s  →  0.55 s lookahead
Iterations   Ni  = 12 gradient-descent iters per frame
Q = diag(1.0, 0.8, 28.0, 3.0)
R = 0.01
```

**Online cost:** O(Nh² · Ni) — heavier than LQR but adapts to nonlinearity and constraints.

---

### PID — Proportional-Integral-Derivative

A **parallel dual-loop PID** that feeds back all four state variables without needing a system model:

```
u = + (Kp_θ · θ  +  Ki_θ · ∫θ dt  +  Kd_θ · θ̇)     ← angle loop  (dominant)
    − (Kp_x · x  +  Ki_x · ∫x dt  +  Kd_x · ẋ)      ← position loop (soft)
```

**Sign convention (important):** when the pole leans right (θ > 0) the cart must push *right* to get underneath it, so the angle terms are **positive**. The position terms are negative to pull the cart back to centre. This matches the sign of the LQR solution exactly.

**Gains (default) — derived from the LQR K matrix**

```
Angle loop:    Kp_θ = 64.0   Ki_θ = 2.0   Kd_θ = 9.8
Position loop: Kp_x = 10.0   Ki_x = 0.5   Kd_x = 15.3
Anti-windup:   iMax = 8.0    (integral clamped to ± iMax)
```

These gains were obtained by matching the dominant LQR gain vector `K ≈ [10, 15.3, 64.3, 9.8]` (solved for `Q = diag[1, 0.8, 20, 2.5]`, `R = 0.01`), giving closed-loop poles at approximately `{−27, −1.7 ± 1.2j, −1.4}`.

**Anti-windup:** the integral states are clamped to `±iMax` every tick to prevent wind-up during saturation or large disturbances.

**Online cost:** O(1) — identical to LQR.

---

## Live Tuner

Press **T** (or click **⚙ TUNE GAINS** on the right sidebar) to open the floating tuner panel.

| What you can change | Notes |
|---|---|
| **LQR** — Q[x], Q[ẋ], Q[θ], Q[θ̇], R | LQR re-solves the Riccati equation automatically (debounced 120 ms) |
| **MPC** — Q weights, R, horizon N, iters/frame | MPC reseeds from LQR warm-start on next frame |
| **PID** — all 6 gains + iMax | Takes effect immediately on the next tick |

- **Changes are live** — no restart needed for most parameters
- **↺ Defaults** — restores every gain to its original value
- **▶ Apply & Reset** — forces a clean sim restart with current gains
- The panel is **draggable** — grab the header bar to reposition it

---

## Controls

| Key / Action | Effect |
|---|---|
| **P** | Switch to PID |
| **L** | Switch to LQR |
| **M** | Switch to MPC |
| **T** | Toggle Live Tuner panel |
| **← / A** or **→ / D** | Kick left / right |
| **C** | Toggle Challenge mode (random kicks every ~2 s) |
| **R** / **Space** | Restart simulation |
| **Q** | Download LQR response as CSV |
| **P** | Download MPC response as CSV |
| **O** | Download PID response as CSV |
| **Mouse drag** | Continuous push force proportional to distance from cart |
| **Touch** | Works on mobile |

---

## CSV Export

Each controller logs every simulation tick. Download with the **⬇ LQR / MPC / PID** buttons or keyboard shortcuts.

**Columns:** `run, t, x, xdot, theta_rad, thetadot, u, alive`

---

## Physics

Lagrangian equations of motion (nonlinear, no small-angle approximation):

```
(M + m sin²θ) ẍ   =  F − bẋ + mLθ̇² sinθ + mg sinθ cosθ
L(M + m sin²θ) θ̈  =  −(M+m)g sinθ − cosθ (F − bẋ + mLθ̇² sinθ)
```

Integrated with **4th-order Runge-Kutta** at **500 Hz** (dtInner = 0.002 s).
Failure threshold: **|θ| > 117°** from upright.

**Default plant parameters**

| Symbol | Value | Description |
|---|---|---|
| M | 1.0 kg | Cart mass |
| m | 0.3 kg | Pole tip mass |
| L | 0.6 m | Pole half-length |
| g | 9.81 m/s² | Gravity |
| b | 0.1 | Cart friction coefficient |
| Umax | 30 N | Actuator saturation |

---

## Parameter reference (`js/config.js`)

```js
// LQR
P.Qlqr = [1.0, 0.8, 20.0, 2.5]   // state cost weights: x, ẋ, θ, θ̇
P.Rlqr = 0.01                      // control effort weight

// MPC
P.Nh    = 22                       // prediction horizon steps
P.Ni    = 12                       // gradient-descent iters per frame
P.dtMpc = 0.025                    // MPC timestep (s)
P.Qmpc  = [1.0, 0.8, 28.0, 3.0]   // MPC state cost weights
P.Rmpc  = 0.01                     // MPC control effort weight

// PID
P.pid.Kp_th = 64.0                 // angle proportional gain
P.pid.Ki_th =  2.0                 // angle integral gain
P.pid.Kd_th =  9.8                 // angle derivative gain
P.pid.Kp_x  = 10.0                 // position proportional gain
P.pid.Ki_x  =  0.5                 // position integral gain
P.pid.Kd_x  = 15.3                 // position derivative gain
P.pid.iMax  =  8.0                 // anti-windup clamp (± N·s)
```

All parameters can also be changed **live** in the browser via the Tuner panel — no code editing required.

---

## File structure

```
├── index.html
├── css/
│   ├── style.css       — global canvas styles
│   └── tuner.css       — live tuner panel styles
└── js/
    ├── config.js       — all tunable parameters (P object)
    ├── physics.js      — nonlinear dynamics, RK4, linearisation
    ├── lqr.js          — CARE solver, Durand-Kerner eigenvalues
    ├── mpc.js          — receding-horizon gradient-descent MPC
    ├── pid.js          — parallel dual-loop PID with anti-windup
    ├── render.js       — canvas drawing (panels, plots, buttons)
    ├── tuner.js        — live gain tuner panel (HTML overlay)
    ├── interaction.js  — mouse, touch, keyboard handlers
    └── main.js         — simulation loop, CSV logging, metrics
```

---

Built with vanilla JS + Canvas API. No frameworks, no WebAssembly, no dependencies.

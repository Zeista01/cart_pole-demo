# Inverted Pendulum — LQR vs MPC

A browser-native, zero-dependency control-theory demo.
Push the pole with your mouse and watch two classical controllers fight to keep it upright.

## Live features

| Panel | What it shows |
|---|---|
| **State vector** | x, ẋ, θ, θ̇, u, balance time — updated every frame |
| **Linearised model** | Full A matrix and B vector at the upright equilibrium |
| **Closed-loop eigenvalues** | λ₁…λ₄ of (A − BK), colour-coded by stability |
| **θ(t) plot** | Angle history with danger zones |
| **u(t) plot** | Control input history, saturation markers |
| **Phase portrait** | θ vs θ̇ trace + live dot |
| **Comparison table** | Balance time, settling time, peak angle, ∫u²dt — LQR vs MPC |

## Controllers

### LQR (Linear Quadratic Regulator)
Solves the continuous-time Algebraic Riccati Equation offline:

```
A'P + PA − (1/R) PBB'P + Q = 0
K = R⁻¹ B' P
u = −Kx
```

O(1) online cost — runs at 500 Hz sub-steps.

### MPC (Model Predictive Control)
Receding-horizon gradient-descent shooting:

- Horizon N = 22 steps × dt = 0.025 s (= 0.55 s lookahead)
- 12 gradient-descent iterations per frame
- Warm-started from previous solution
- Shows predicted trajectory as a ghost overlay

## Controls

| Key / Action | Effect |
|---|---|
| **L** | Switch to LQR |
| **M** | Switch to MPC |
| **← / A** or **→ / D** | Kick left / right |
| **C** | Toggle Challenge mode (random kicks) |
| **R** / **Space** | Restart |
| **[ / ]** | Decrease / increase LQR angle weight Q[θ] live |
| **Mouse drag** | Continuous push force |
| **Touch** | Works on mobile |

## Running locally

No build step required — just open `index.html` in any modern browser:

```bash
# Python 3
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`.

## Physics

Lagrangian equations of motion (nonlinear):

```
(M + m sin²θ) ẍ  =  F − bẋ + mLθ̇²sinθ + mg sinθ cosθ
L(M + m sin²θ) θ̈ =  −(M+m)g sinθ − cosθ (F − bẋ + mLθ̇²sinθ)
```

Integrated with 4th-order Runge-Kutta at 500 Hz.
Failure threshold: |θ| > 117°.

## Parameter tuning (`js/config.js`)

```js
P.Qlqr = [1.0, 0.8, 20.0, 2.5]  // x, ẋ, θ, θ̇ weights
P.Rlqr = 0.01                     // control effort weight
P.Nh   = 22                       // MPC horizon steps
P.Ni   = 12                       // gradient iters / frame
```

---

Built with vanilla JS + Canvas API. No frameworks, no WebAssembly, no dependencies.

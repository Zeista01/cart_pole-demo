'use strict';

// ════════════════════════════════════════════════════════════
//  MINIMAL COMPLEX-NUMBER HELPERS  (used only for eigenvalues)
// ════════════════════════════════════════════════════════════
const C = {
  add: (a, b) => ({ r: a.r + b.r, i: a.i + b.i }),
  sub: (a, b) => ({ r: a.r - b.r, i: a.i - b.i }),
  mul: (a, b) => ({ r: a.r * b.r - a.i * b.i, i: a.r * b.i + a.i * b.r }),
  div: (a, b) => {
    const d = b.r * b.r + b.i * b.i + 1e-300;
    return { r: (a.r * b.r + a.i * b.i) / d, i: (a.i * b.r - a.r * b.i) / d };
  },
  abs:  a => Math.sqrt(a.r * a.r + a.i * a.i),
  from: v => ({ r: v, i: 0 }),
};

// ════════════════════════════════════════════════════════════
//  CHARACTERISTIC POLYNOMIAL  via Newton's identities
//  Returns [c0,c1,c2,c3] so that det(λI-M) = λ^4+c3λ^3+c2λ^2+c1λ+c0
// ════════════════════════════════════════════════════════════
function charPoly4x4(M) {
  const n = 4;
  // helpers
  function mm(A, B) {
    const R = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) R[i][j] += A[i][k] * B[k][j];
    return R;
  }
  function tr(A) { let t = 0; for (let i = 0; i < n; i++) t += A[i][i]; return t; }

  const M2 = mm(M, M);
  const M3 = mm(M2, M);
  const M4 = mm(M3, M);

  // Newton's power sums
  const p1 = tr(M), p2 = tr(M2), p3 = tr(M3), p4 = tr(M4);

  // Elementary symmetric polynomials
  const e1 = p1;
  const e2 = (e1 * p1 - p2) / 2;
  const e3 = (e2 * p1 - e1 * p2 + p3) / 3;
  const e4 = (e3 * p1 - e2 * p2 + e1 * p3 - p4) / 4;

  // det(λI-M) = λ^4 - e1λ^3 + e2λ^2 - e3λ + e4
  return [e4, -e3, e2, -e1];   // [c0, c1, c2, c3]
}

// ════════════════════════════════════════════════════════════
//  DURAND-KERNER  root finder for degree-4 monic polynomial
//  p(z) = z^4 + c[3]z^3 + c[2]z^2 + c[1]z + c[0]
// ════════════════════════════════════════════════════════════
function evalPoly4(c, z) {
  // Horner: (((z + c3)z + c2)z + c1)z + c0
  let v = C.from(1);
  for (let k = 3; k >= 0; k--) {
    v = C.add(C.mul(v, z), C.from(c[k]));
  }
  return v;
}

function durandKerner(c, maxIter = 120) {
  // Spread initial guesses around the origin, radius ~ bound on |roots|
  const bound = 1 + Math.max(...c.map(Math.abs));
  let roots = [0, 1, 2, 3].map(k => ({
    r: bound * Math.cos(2 * Math.PI * k / 4 + 0.3),
    i: bound * Math.sin(2 * Math.PI * k / 4 + 0.3),
  }));

  for (let it = 0; it < maxIter; it++) {
    roots = roots.map((ri, i) => {
      const pv   = evalPoly4(c, ri);
      let denom  = C.from(1);
      for (let j = 0; j < 4; j++) {
        if (j !== i) denom = C.mul(denom, C.sub(ri, roots[j]));
      }
      return C.sub(ri, C.div(pv, denom));
    });
  }
  // Clean up floating-point imaginary noise
  return roots.map(r => ({
    r: r.r,
    i: Math.abs(r.i) < 1e-8 ? 0 : r.i,
  }));
}

// ════════════════════════════════════════════════════════════
//  LQR  —  Continuous-time Algebraic Riccati Equation
//  Iterates dP/dt = A'P + PA - (1/R)PBB'P + Q → P∞
//  Returns { K, A, Bv, Acl, eigenvalues }
// ════════════════════════════════════════════════════════════
function solveLQR() {
  const { A, Bv } = getLinearizedMatrices();
  const Q = P.Qlqr, R = P.Rlqr;

  // Initialise P = diag(Q)
  const Pm = Array.from({ length: 4 }, (_, i) => {
    const r = new Float64Array(4); r[i] = Q[i]; return r;
  });

  const dt = 0.0001;
  for (let it = 0; it < 500000; it++) {
    const PB = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) PB[i] += Pm[i][j] * Bv[j];

    let norm = 0;
    const dP = Array.from({ length: 4 }, () => new Float64Array(4));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let v = Q[i] * (i === j ? 1 : 0);
      for (let k = 0; k < 4; k++) v += A[k][i] * Pm[k][j] + Pm[i][k] * A[k][j];
      v -= PB[i] * PB[j] / R;
      dP[i][j] = v;
      norm += v * v;
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) Pm[i][j] += dt * dP[i][j];
    if (it > 1000 && Math.sqrt(norm) < 1e-10) break;
  }

  // K = R⁻¹ B' P
  const K = new Float64Array(4);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) K[j] += Bv[i] * Pm[i][j] / R;

  // Closed-loop matrix: Acl = A − B K
  const Acl = A.map(row => [...row]);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) Acl[i][j] -= Bv[i] * K[j];

  // Eigenvalues of Acl
  const coeffs = charPoly4x4(Acl);
  const rawEig = durandKerner(coeffs);

  // Pair up complex conjugates and sort by real part
  const eigenvalues = pairConjugates(rawEig);

  console.log('LQR K =', Array.from(K).map(v => v.toFixed(3)).join(', '));
  console.log('CL eigenvalues:', eigenvalues.map(e =>
    `${e.r.toFixed(3)}${e.i >= 0 ? '+' : ''}${e.i.toFixed(3)}i`).join(', '));

  return { K, A, Bv, Acl, eigenvalues, coeffs };
}

// ════════════════════════════════════════════════════════════
//  Helper: collapse nearly-conjugate pairs for display
//  Returns array sorted by real part (most negative first)
// ════════════════════════════════════════════════════════════
function pairConjugates(roots) {
  // Sort by (real, |imag|) so conjugates sit together
  const sorted = [...roots].sort((a, b) => a.r !== b.r ? a.r - b.r : Math.abs(a.i) - Math.abs(b.i));
  // Round near-zero imaginary parts
  return sorted.map(e => ({
    r: +e.r.toFixed(6),
    i: Math.abs(e.i) < 1e-6 ? 0 : +e.i.toFixed(6),
  }));
}

/**
 * Format a single eigenvalue for display.
 * @param {{r:number,i:number}} e
 * @returns {string}
 */
function fmtEig(e) {
  if (Math.abs(e.i) < 1e-4) return e.r.toFixed(3);
  const sgn = e.i >= 0 ? '+' : '−';
  return `${e.r.toFixed(3)} ${sgn} ${Math.abs(e.i).toFixed(3)}i`;
}
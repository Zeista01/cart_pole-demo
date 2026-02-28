'use strict';

// ════════════════════════════════════════════════════════════
//  CANVAS SETUP
// ════════════════════════════════════════════════════════════
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
let W, H, SX, SY, SC;

function onResize() {
  W = cvs.width  = window.innerWidth;
  H = cvs.height = window.innerHeight;
  SX = W * 0.5;
  SY = H * 0.54;
  SC = Math.min(W / 8.5, H / 6);
}
window.addEventListener('resize', onResize);
onResize();

/** World-to-screen transform. */
function ws(mx, my) { return [SX + mx * SC, SY - my * SC]; }

// ════════════════════════════════════════════════════════════
//  COLOUR PALETTE
// ════════════════════════════════════════════════════════════
const COL = {
  bg:           '#020208',
  panel:        'rgba(5,10,22,0.93)',
  panelBorder:  'rgba(40,80,130,0.55)',
  text:         'rgba(170,210,230,0.95)',
  dim:          'rgba(80,130,160,0.72)',
  lqr:          '#00ff88',
  mpc:          '#00d4ff',
  pid:          '#ff9f1c',
  push:         '#ffaa20',
  danger:       '#ff3355',
  railTop:      '#5a7080',
  railBot:      '#2a3840',
  cartTop:      '#2a3f6a',
  cartBot:      '#141e34',
  cartEdge:     '#4488cc',
  matA:         'rgba(100,200,140,0.85)',
  matB:         'rgba(100,180,255,0.85)',
  eigenStable:  '#66ffcc',
  eigenText:    'rgba(140,220,200,0.9)',
  metricHdr:    'rgba(150,200,220,0.8)',
  accent:       'rgba(60,130,200,0.6)',
};

// Button hit-test registry (populated each frame)
const BTNS = {};

// ── Utility ─────────────────────────────────────────────────
function poleColor() {
  if (sim.mode === 'LQR') return COL.lqr;
  if (sim.mode === 'MPC') return COL.mpc;
  return COL.pid;
}

function hexToRgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function blendDanger(hex, d) {
  const [r,g,b] = hexToRgb(hex);
  return `rgb(${Math.round(r*(1-d)+255*d)},${Math.round(g*(1-d))},${Math.round(b*(1-d))})`;
}

function panelBg(x, y, w, h, r = 6) {
  ctx.fillStyle   = COL.panel;
  ctx.strokeStyle = COL.panelBorder;
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.stroke();
}

function label(text, x, y, col = COL.dim, font = '10px JetBrains Mono,monospace') {
  ctx.font = font; ctx.fillStyle = col; ctx.fillText(text, x, y);
}

// ════════════════════════════════════════════════════════════
//  BACKGROUND
// ════════════════════════════════════════════════════════════
function drawBg() {
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(SX, SY, 0, SX, SY, Math.max(W, H) * 0.75);
  rg.addColorStop(0, 'rgba(10,22,44,0.4)');
  rg.addColorStop(1, 'rgba(0,0,10,0.8)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  // Grid
  const gs = SC * 0.5;
  ctx.strokeStyle = 'rgba(20,60,40,0.07)'; ctx.lineWidth = 1;
  for (let x = SX % gs; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = SY % gs; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Challenge flash
  if (sim.flash > 0) {
    ctx.fillStyle = `rgba(255,180,0,${sim.flash * 0.06})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ════════════════════════════════════════════════════════════
//  TRACK
// ════════════════════════════════════════════════════════════
function drawTrack() {
  const tw = P.trackLen * SC, lx = SX - tw, rx = SX + tw, ty = SY, th = 10;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(lx, ty+th+3, rx-lx, 8);
  // Rail
  const tg = ctx.createLinearGradient(0, ty-3, 0, ty+th+4);
  tg.addColorStop(0, COL.railTop); tg.addColorStop(0.3, '#6a8090'); tg.addColorStop(1, COL.railBot);
  ctx.fillStyle = tg; ctx.fillRect(lx, ty-3, rx-lx, th+6);
  ctx.fillStyle = 'rgba(200,230,255,0.1)'; ctx.fillRect(lx, ty-3, rx-lx, 2);
  // Centre dashed line
  ctx.strokeStyle = 'rgba(60,140,90,0.25)'; ctx.lineWidth = 1;
  ctx.setLineDash([5,5]);
  ctx.beginPath(); ctx.moveTo(SX, ty-40); ctx.lineTo(SX, ty+th+30); ctx.stroke();
  ctx.setLineDash([]);
  // Ticks + labels
  ctx.lineWidth = 1;
  for (let mx = -P.trackLen; mx <= P.trackLen + 0.01; mx += 0.5) {
    const sx = SX + mx * SC, tl = Number.isInteger(mx) ? 10 : 6;
    ctx.strokeStyle = 'rgba(100,160,180,0.4)';
    ctx.beginPath(); ctx.moveTo(sx, ty+th); ctx.lineTo(sx, ty+th+tl); ctx.stroke();
    if (Number.isInteger(mx) && mx !== 0) {
      ctx.font = '10px JetBrains Mono,monospace';
      ctx.fillStyle = 'rgba(80,130,150,0.45)'; ctx.textAlign = 'center';
      ctx.fillText(mx + 'm', sx, ty+th+23);
    }
  }
  ctx.textAlign = 'left';
  // End stops
  for (const ex of [lx-4, rx-4]) {
    const sg = ctx.createLinearGradient(0, ty-28, 0, ty+th+18);
    sg.addColorStop(0,'#cc2233'); sg.addColorStop(1,'#881122');
    ctx.fillStyle = sg; ctx.fillRect(ex, ty-28, 9, th+44);
    ctx.fillStyle = '#ff4455'; ctx.fillRect(ex+1, ty-26, 7, 6);
    ctx.font = 'bold 9px JetBrains Mono,monospace'; ctx.fillStyle = '#ff4455';
    ctx.textAlign = 'center'; ctx.fillText('LIMIT', ex+4, ty-32);
  }
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  CART
// ════════════════════════════════════════════════════════════
function drawCart(x) {
  const [sx, sy] = ws(x, 0);
  const cw = SC*0.3, ch = SC*0.17, wr = SC*0.067;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(sx+3, sy+ch+wr+4, cw*0.8, 5, 0, 0, Math.PI*2); ctx.fill();
  // Body
  const bg = ctx.createLinearGradient(sx-cw, sy-ch, sx+cw, sy+ch);
  bg.addColorStop(0, COL.cartTop); bg.addColorStop(0.5,'#223060'); bg.addColorStop(1, COL.cartBot);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(sx-cw, sy-ch, cw*2, ch*2, 8); ctx.fill();
  ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(sx-cw, sy-ch, cw*2, ch*2, 8); ctx.stroke();
  // Glint
  ctx.fillStyle = 'rgba(100,160,255,0.1)';
  ctx.beginPath(); ctx.roundRect(sx-cw+4, sy-ch+4, cw*2-8, ch*0.55, 3); ctx.fill();
  // Mode LED
  const pc = poleColor();
  ctx.shadowColor = pc; ctx.shadowBlur = 14;
  ctx.fillStyle = pc;
  ctx.beginPath(); ctx.arc(sx, sy-ch*0.3, 5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  // Pivot ring
  ctx.fillStyle = '#1e2e50'; ctx.beginPath(); ctx.arc(sx, sy-ch, 11, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sx, sy-ch, 11, 0, Math.PI*2); ctx.stroke();
  // Wheels
  for (const wx of [sx-cw*0.52, sx+cw*0.52]) {
    const wy = sy + ch - 2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(wx+2, wy+2, wr, 0, Math.PI*2); ctx.fill();
    const wg = ctx.createRadialGradient(wx-wr*0.3, wy-wr*0.3, 1, wx, wy, wr);
    wg.addColorStop(0,'#606890'); wg.addColorStop(1,'#1e2640');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#304890'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(wx, wy, wr, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#90a0c0'; ctx.beginPath(); ctx.arc(wx, wy, wr*0.25, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#3a58a0'; ctx.lineWidth = 0.8;
    for (let a = 0; a < 3; a++) {
      const ang = a * Math.PI * 2 / 3;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx+Math.cos(ang)*wr*0.82, wy+Math.sin(ang)*wr*0.82); ctx.stroke();
    }
  }
}

// ════════════════════════════════════════════════════════════
//  POLE
// ════════════════════════════════════════════════════════════
function drawPole(x, th) {
  const [sx, sy] = ws(x, 0);
  const pivX = sx, pivY = sy - SC * 0.17;
  const pLen  = P.L * 2 * SC;
  const tx = pivX + Math.sin(th) * pLen;
  const ty = pivY - Math.cos(th) * pLen;
  const danger = Math.min(1, Math.abs(th) / (Math.PI * 0.55));
  const col    = blendDanger(poleColor(), danger);

  // Layered glow
  for (const [w, a] of [[24,0.04],[12,0.09],[6,0.18],[2.5,1]]) {
    const [r,g,b] = hexToRgb(poleColor());
    const rr = Math.round(r*(1-danger)+255*danger);
    const gg = Math.round(g*(1-danger));
    const bb = Math.round(b*(1-danger));
    ctx.strokeStyle = a < 1 ? `rgba(${rr},${gg},${bb},${a})` : col;
    ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(tx, ty); ctx.stroke();
  }

  // Pivot
  const pg = ctx.createRadialGradient(pivX, pivY, 0, pivX, pivY, 10);
  pg.addColorStop(0,'#e0f0ff'); pg.addColorStop(1,'#304878');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pivX, pivY, 9, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(pivX, pivY, 9, 0, Math.PI*2); ctx.stroke();

  // Bob
  const br = SC * 0.068;
  for (const [scale, alpha] of [[4,0.06],[2.8,0.11],[1.6,0.28],[1,0.9]]) {
    const [r,g,b] = hexToRgb(poleColor());
    const rr = Math.round(r*(1-danger)+255*danger);
    const gg = Math.round(g*(1-danger));
    const bb = Math.round(b*(1-danger));
    ctx.fillStyle = alpha < 0.5 ? `rgba(${rr},${gg},${bb},${alpha})` : col;
    ctx.beginPath(); ctx.arc(tx, ty, br*scale, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx, ty, br*0.32, 0, Math.PI*2); ctx.fill();
}

// ════════════════════════════════════════════════════════════
//  MPC GHOST TRAJECTORY
// ════════════════════════════════════════════════════════════
function drawMPCGhost() {
  const traj = mpcPredict(sim.s);
  ctx.lineCap = 'round';
  for (let k = 1; k < traj.length; k++) {
    const al = Math.pow(1 - k / traj.length, 1.4) * 0.38;
    const { x, th } = traj[k];
    const [sx, sy] = ws(x, 0);
    const pLen = P.L * 2 * SC;
    const tx = sx + Math.sin(th)*pLen, ty = sy - SC*0.17 - Math.cos(th)*pLen;
    ctx.strokeStyle = `rgba(0,200,255,${al})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx, sy-SC*0.17); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle   = `rgba(0,200,255,${al*2.5})`;
    ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI*2); ctx.fill();
  }
}

// ════════════════════════════════════════════════════════════
//  FORCE ARROW
// ════════════════════════════════════════════════════════════
function drawForce() {
  const u = sim.u; if (Math.abs(u) < 0.5) return;
  const [sx, sy] = ws(sim.s[0], 0);
  const dir = Math.sign(u), mag = Math.min(1, Math.abs(u) / P.Umax);
  const len = SC * 0.52 * mag, ay = sy - SC * 0.08;
  const sx0 = sx - dir*SC*0.2, ex = sx0 + dir*len;
  const al  = Math.min(0.95, 0.4 + mag*0.6);
  ctx.strokeStyle = `rgba(255,170,20,${al})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx0, ay); ctx.lineTo(ex-dir*12, ay); ctx.stroke();
  ctx.fillStyle = `rgba(255,170,20,${al})`;
  ctx.beginPath(); ctx.moveTo(ex, ay); ctx.lineTo(ex-dir*14, ay-7); ctx.lineTo(ex-dir*14, ay+7); ctx.closePath(); ctx.fill();
  ctx.font = '11px JetBrains Mono,monospace'; ctx.fillStyle = `rgba(255,210,100,${al})`;
  ctx.textAlign = dir > 0 ? 'right' : 'left';
  ctx.fillText(u.toFixed(1)+'N', ex-dir*18, ay-10); ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  TOP BAR
// ════════════════════════════════════════════════════════════
function drawTopBar() {
  ctx.font = 'bold 20px JetBrains Mono,monospace';
  ctx.fillStyle = 'rgba(200,230,255,0.92)';
  ctx.fillText('INVERTED PENDULUM', 20, 34);
  ctx.font = '11px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  ctx.fillText('CONTROL THEORY DEMO  ·  L=LQR  M=MPC  I=PID  ←/→=PUSH  C=CHALLENGE  R=RESET  Q/P/O=CSV', 20, 52);
  ctx.strokeStyle = 'rgba(40,80,130,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 59); ctx.lineTo(W-20, 59); ctx.stroke();
}

// ════════════════════════════════════════════════════════════
//  LEFT SIDEBAR — state + system matrices + eigenvalues
// ════════════════════════════════════════════════════════════
const LEFT_X = 12, LEFT_W = 228;

function drawStatePanel() {
  const py = 68, ph = 148;
  panelBg(LEFT_X, py, LEFT_W, ph, 8);
  ctx.font = 'bold 10px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  ctx.fillText('STATE VECTOR', LEFT_X+8, py+14);

  const rows = [
    ['θ',   (sim.s[2]*180/Math.PI).toFixed(2)+'°',   Math.abs(sim.s[2])>0.3?'#ff9966':'#88ffcc'],
    ['θ̇',  sim.s[3].toFixed(3)+' r/s',              '#e0eeff'],
    ['x',   sim.s[0].toFixed(3)+' m',                Math.abs(sim.s[0])>2?'#ff9966':'#e0eeff'],
    ['ẋ',  sim.s[1].toFixed(3)+' m/s',              '#e0eeff'],
    ['u',   sim.u.toFixed(2)+' N',                   sim.u>0?'#ffcc88':'#88ccff'],
    ['t',   sim.balTime.toFixed(2)+' s',              '#ffdd44'],
  ];
  ctx.font = '12px JetBrains Mono,monospace';
  rows.forEach(([lbl, val, col], i) => {
    const ey = py + 28 + i * 20;
    ctx.fillStyle = COL.dim; ctx.fillText(lbl+':', LEFT_X+8, ey);
    ctx.fillStyle = col;     ctx.fillText(val,    LEFT_X+40, ey);
  });
}

// ── System matrices A and B ──────────────────────────────────
function drawLinearMatrices() {
  if (!sim.lqrData) return;
  const { A, Bv } = sim.lqrData;
  const py = 226, ph = 182;
  panelBg(LEFT_X, py, LEFT_W, ph, 8);

  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim; ctx.fillText('LINEARISED  ẋ = Ax + Bu', LEFT_X+8, py+14);

  // ── A matrix ────────────────────────────────────────────
  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.matA; ctx.fillText('A =', LEFT_X+8, py+32);

  const cellW = 50, cellH = 17, mx0 = LEFT_X+30, my0 = py+38;
  A.forEach((row, i) => {
    // bracket
    const by = my0 + i*cellH;
    ctx.strokeStyle = 'rgba(100,200,140,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx0-4, by-2); ctx.lineTo(mx0-8, by-2); ctx.lineTo(mx0-8, by+13); ctx.lineTo(mx0-4, by+13); ctx.stroke();
    const ex = mx0 + 4*cellW;
    ctx.beginPath(); ctx.moveTo(ex+2, by-2); ctx.lineTo(ex+6, by-2); ctx.lineTo(ex+6, by+13); ctx.lineTo(ex+2, by+13); ctx.stroke();

    row.forEach((val, j) => {
      const tx = mx0 + j*cellW;
      const str = val === 0 ? '  0   ' : val.toFixed(2);
      ctx.font = '10px JetBrains Mono,monospace';
      ctx.fillStyle = val === 0 ? 'rgba(80,120,100,0.5)' : COL.matA;
      ctx.textAlign = 'right'; ctx.fillText(str, tx+cellW-2, by+11);
    });
  });
  ctx.textAlign = 'left';

  // ── B vector ────────────────────────────────────────────
  const by2 = my0 + 4*cellH + 10;
  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.matB; ctx.fillText('B =', LEFT_X+8, by2+11);
  ctx.font = '10px JetBrains Mono,monospace';
  const bx0 = LEFT_X+34;
  ctx.strokeStyle = 'rgba(100,180,255,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx0-4,by2); ctx.lineTo(bx0-8,by2); ctx.lineTo(bx0-8,by2+14); ctx.lineTo(bx0-4,by2+14); ctx.stroke();
  const bex = bx0 + 4*42;
  ctx.beginPath(); ctx.moveTo(bex+2,by2); ctx.lineTo(bex+6,by2); ctx.lineTo(bex+6,by2+14); ctx.lineTo(bex+2,by2+14); ctx.stroke();
  Bv.forEach((val, j) => {
    const str = val === 0 ? ' 0    ' : val.toFixed(3);
    ctx.fillStyle = val === 0 ? 'rgba(80,120,160,0.5)' : COL.matB;
    ctx.textAlign = 'right'; ctx.fillText(str, bx0+j*42+38, by2+12);
  });
  ctx.textAlign = 'left';
}

// ── Closed-loop eigenvalues ──────────────────────────────────
function drawEigenvalues() {
  if (!sim.lqrData) return;
  const { eigenvalues } = sim.lqrData;
  const py = 418, ph = 122;
  panelBg(LEFT_X, py, LEFT_W, ph, 8);

  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim; ctx.fillText('CLOSED-LOOP EIGENVALUES', LEFT_X+8, py+14);
  ctx.font = '9px JetBrains Mono,monospace'; ctx.fillStyle = 'rgba(80,130,100,0.7)';
  ctx.fillText('(A − BK)', LEFT_X+8, py+26);

  eigenvalues.forEach((e, i) => {
    const ey = py + 42 + i * 18;
    // Stability indicator
    const stable = e.r < 0;
    ctx.fillStyle = stable ? '#1a3a28' : '#3a1a18';
    ctx.fillRect(LEFT_X+8, ey-12, LEFT_W-16, 15);
    ctx.strokeStyle = stable ? 'rgba(0,255,136,0.2)' : 'rgba(255,60,60,0.2)';
    ctx.lineWidth = 0.5; ctx.strokeRect(LEFT_X+8, ey-12, LEFT_W-16, 15);

    ctx.font = '10px JetBrains Mono,monospace';
    ctx.fillStyle = 'rgba(130,170,150,0.7)'; ctx.fillText(`λ${i+1}`, LEFT_X+12, ey);
    ctx.fillStyle = stable ? COL.eigenStable : COL.danger;
    ctx.fillText('= ' + fmtEig(e), LEFT_X+30, ey);
  });
}

// ════════════════════════════════════════════════════════════
//  RIGHT SIDEBAR — buttons + controller info + metrics table
// ════════════════════════════════════════════════════════════
const RIGHT_W = 228;
let RIGHT_X;  // computed in draw() each frame as W - RIGHT_W - 12

function drawButtons() {
  const rx = RIGHT_X;
  // Three mode buttons fitted into RIGHT_W
  const mbw = Math.floor((RIGHT_W - 8) / 3);
  modeBtn('PID', rx,           15, sim.mode==='PID', mbw);
  modeBtn('LQR', rx+mbw+4,     15, sim.mode==='LQR', mbw);
  modeBtn('MPC', rx+mbw*2+8,   15, sim.mode==='MPC', mbw);

  actionBtn('\u21ba RESET', rx, 55, '#1a2a3a','#3060a0','restart', 90);
  actionBtn(sim.challenge ? '\u26a1 ON' : '\u26a1 CHALLENGE',
            rx+98, 55, sim.challenge?'#1a3008':'#0e1810', sim.challenge?'#88cc44':'#2a4020',
            'challenge', sim.challenge?88:RIGHT_W-98);

  // Best times
  ctx.font = '10px JetBrains Mono,monospace'; ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,255,136,0.55)'; ctx.fillText('LQR: '+sim.lqrBest.toFixed(2)+'s', rx+RIGHT_W*0.36, 100);
  ctx.fillStyle = 'rgba(0,212,255,0.55)'; ctx.fillText('MPC: '+sim.mpcBest.toFixed(2)+'s', rx+RIGHT_W*0.68, 100);
  ctx.fillStyle = 'rgba(255,159,28,0.70)'; ctx.fillText('PID: '+sim.pidBest.toFixed(2)+'s',  rx+RIGHT_W,     100);
  ctx.textAlign = 'left';

  // CSV download buttons — three in a row
  const csvY = 112;
  const cw = Math.floor((RIGHT_W - 8) / 3);
  actionBtn('\u2b07 LQR', rx,         csvY, '#0a1a10','rgba(0,255,136,0.4)',  'dlLQR', cw);
  actionBtn('\u2b07 MPC', rx+cw+4,    csvY, '#0a1020','rgba(0,212,255,0.4)',  'dlMPC', cw);
  actionBtn('\u2b07 PID', rx+cw*2+8,  csvY, '#1a0a00','rgba(255,159,28,0.4)','dlPID', cw);

  // Hint text
  ctx.font = '9px JetBrains Mono,monospace';
  ctx.fillStyle = 'rgba(100,140,160,0.5)';
  ctx.fillText('Q=LQR  P=MPC  O=PID  T=TUNE', rx, csvY+38);
}

function modeBtn(label, x, y, active, bw=88) {
  const bh=34;
  const colMap = { LQR: COL.lqr, MPC: COL.mpc, PID: COL.pid };
  const bgMap  = { LQR: 'rgba(0,70,44,0.9)', MPC: 'rgba(0,55,75,0.9)', PID: 'rgba(50,30,0,0.9)' };
  const bc  = active ? (colMap[label]||COL.lqr) : COL.panelBorder;
  const bg  = active ? (bgMap[label]||'rgba(12,16,30,0.85)') : 'rgba(12,16,30,0.85)';
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x,y,bw,bh,6); ctx.fill();
  ctx.strokeStyle = bc; ctx.lineWidth = active ? 2 : 1;
  ctx.beginPath(); ctx.roundRect(x,y,bw,bh,6); ctx.stroke();
  if (active) { ctx.shadowColor = bc; ctx.shadowBlur = 10; }
  ctx.font = 'bold 14px JetBrains Mono,monospace';
  ctx.fillStyle = active ? bc : COL.dim;
  ctx.textAlign = 'center'; ctx.fillText(label, x+bw/2, y+bh/2+5);
  ctx.shadowBlur = 0; ctx.textAlign = 'left';
  BTNS[label] = { x, y, w:bw, h:bh };
}

function actionBtn(label, x, y, bg, border, id, w=90) {
  const bh = 30;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x,y,w,bh,5); ctx.fill();
  ctx.strokeStyle = border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x,y,w,bh,5); ctx.stroke();
  ctx.font = '11px JetBrains Mono,monospace'; ctx.fillStyle = COL.text;
  ctx.textAlign = 'center'; ctx.fillText(label, x+w/2, y+bh/2+4);
  ctx.textAlign = 'left'; BTNS[id] = { x, y, w, h:bh };
}

// ── Controller info ──────────────────────────────────────────
function drawInfoPanel() {
  const rx = RIGHT_X, py = 148, ph = sim.mode==='LQR' ? 128 : sim.mode==='MPC' ? 138 : 128;
  panelBg(rx, py, RIGHT_W, ph, 8);

  ctx.font = 'bold 11px JetBrains Mono,monospace';
  ctx.fillStyle = poleColor();
  const modeLabel = sim.mode==='LQR' ? '▶ LQR CONTROLLER' : sim.mode==='MPC' ? '▶ MPC CONTROLLER' : '▶ PID CONTROLLER';
  ctx.fillText(modeLabel, rx+10, py+18);

  ctx.font = '10px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  if (sim.mode==='LQR') {
    ctx.fillText('Method: Algebraic Riccati Eq.',  rx+10, py+36);
    ctx.fillText('Policy: u = -Kx  (linear)',       rx+10, py+50);
    ctx.fillText('Online cost:  O(1)',               rx+10, py+64);
    if (sim.lqrData) {
      const K = sim.lqrData.K;
      ctx.fillStyle = 'rgba(140,200,160,0.75)';
      ctx.fillText(`K = [${K[0].toFixed(1)}, ${K[1].toFixed(1)},`, rx+10, py+82);
      ctx.fillText(`     ${K[2].toFixed(1)}, ${K[3].toFixed(1)}]`,  rx+10, py+96);
    }
  } else if (sim.mode==='MPC') {
    ctx.fillText('Method: Gradient-descent shoot.', rx+10, py+36);
    ctx.fillText(`Horizon: N=${P.Nh} x dt=${P.dtMpc}s`, rx+10, py+50);
    ctx.fillText(`Iters/frame: ${P.Ni}`,              rx+10, py+64);
    ctx.fillText('Online cost: O(Nh2*Ni)',             rx+10, py+78);
    ctx.fillStyle = 'rgba(0,200,255,0.55)';
    ctx.fillText('Ghost = MPC rollout above',         rx+10, py+92);
    ctx.fillText('Shows predicted trajectory above',  rx+10, py+108);
  } else {
    // PID info
    const g = P.pid;
    ctx.fillText('Method: Parallel PID (angle+pos)', rx+10, py+36);
    ctx.fillText('u = +(Kp*th + Ki*ith + Kd*thd)',   rx+10, py+50);
    ctx.fillText('    -(Kp*x  + Ki*ix  + Kd*xd)',    rx+10, py+62);
    ctx.fillStyle = 'rgba(255,159,28,0.75)';
    ctx.fillText(`Angle: Kp=${g.Kp_th}  Ki=${g.Ki_th}  Kd=${g.Kd_th}`, rx+10, py+78);
    ctx.fillText(`Pos:   Kp=${g.Kp_x}   Ki=${g.Ki_x}   Kd=${g.Kd_x}`,  rx+10, py+92);
    ctx.fillText(`Anti-windup iMax=${g.iMax}`,        rx+10, py+106);
  }
}

// ── Comparison metrics table ──────────────────────────────────
function drawMetricsTable() {
  const rx = RIGHT_X, py = H - 220, ph = 208;

  // TUNE GAINS button — sits just above the metrics table, never overlaps
  actionBtn('⚙  TUNE GAINS', rx, py - 40, '#0a1020', 'rgba(140,160,200,0.45)', 'tune', RIGHT_W);

  panelBg(rx, py, RIGHT_W, ph, 8);

  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim; ctx.fillText('CONTROLLER COMPARISON', rx+8, py+14);

  // Header row  (4-col: METRIC | LQR | MPC | PID)
  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.metricHdr;
  ctx.fillText('METRIC',   rx+8,   py+32);
  ctx.fillStyle = COL.lqr; ctx.fillText('LQR', rx+106, py+32);
  ctx.fillStyle = COL.mpc; ctx.fillText('MPC', rx+152, py+32);
  ctx.fillStyle = COL.pid; ctx.fillText('PID', rx+RIGHT_W-16, py+32);

  // Divider
  ctx.strokeStyle = 'rgba(60,120,100,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx+8, py+38); ctx.lineTo(rx+RIGHT_W-8, py+38); ctx.stroke();

  const rows = [
    ['Bal. t',
      metrics.LQR.balTime.toFixed(2)+'s',
      metrics.MPC.balTime.toFixed(2)+'s',
      metrics.PID.balTime.toFixed(2)+'s'],
    ['Settle',
      metrics.LQR.settleTime != null ? metrics.LQR.settleTime.toFixed(2)+'s' : '--',
      metrics.MPC.settleTime != null ? metrics.MPC.settleTime.toFixed(2)+'s' : '--',
      metrics.PID.settleTime != null ? metrics.PID.settleTime.toFixed(2)+'s' : '--'],
    ['Peak|th|',
      (metrics.LQR.peakAngle*180/Math.PI).toFixed(1)+'°',
      (metrics.MPC.peakAngle*180/Math.PI).toFixed(1)+'°',
      (metrics.PID.peakAngle*180/Math.PI).toFixed(1)+'°'],
    ['int-u2dt',
      metrics.LQR.effort.toFixed(1),
      metrics.MPC.effort.toFixed(1),
      metrics.PID.effort.toFixed(1)],
    ['Best t',
      sim.lqrBest.toFixed(2)+'s',
      sim.mpcBest.toFixed(2)+'s',
      sim.pidBest.toFixed(2)+'s'],
  ];

  rows.forEach(([name, lv, mv, pv], i) => {
    const ey = py + 56 + i * 28;
    ctx.fillStyle = i%2===0 ? 'rgba(20,40,30,0.3)' : 'rgba(0,0,0,0)';
    ctx.fillRect(rx+8, ey-14, RIGHT_W-16, 24);

    ctx.font = '10px JetBrains Mono,monospace';
    ctx.fillStyle = COL.dim;   ctx.textAlign='left';  ctx.fillText(name, rx+12, ey);
    ctx.fillStyle = COL.lqr;   ctx.textAlign='right'; ctx.fillText(lv, rx+134, ey);
    ctx.fillStyle = COL.mpc;                          ctx.fillText(mv, rx+180, ey);
    ctx.fillStyle = COL.pid;                          ctx.fillText(pv, rx+RIGHT_W-4, ey);
    ctx.textAlign = 'left';
  });

  // Live indicator highlight on active column
  const liveXmap = { LQR: rx+92, MPC: rx+138, PID: rx+RIGHT_W-50 };
  const liveCol  = { LQR: COL.lqr, MPC: COL.mpc, PID: COL.pid };
  ctx.strokeStyle = liveCol[sim.mode]||COL.lqr;
  ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(liveXmap[sim.mode]||rx+92, py+23, 44, rows.length*28+20, 3); ctx.stroke();
  ctx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════════
//  BOTTOM PANELS
// ════════════════════════════════════════════════════════════
const BOT_H = 140, BOT_PAD = 12;
let botY;   // set in draw() each frame

// ── θ(t) angle plot ──────────────────────────────────────────
function drawAnglePlot(px, pw) {
  const ph = BOT_H;
  panelBg(px, botY, pw, ph, 8);
  ctx.font = '10px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  ctx.textAlign = 'center'; ctx.fillText('ANGLE  θ(t)', px+pw/2, botY+14); ctx.textAlign='left';

  const L2=px+14, R2=px+pw-14, T2=botY+22, B2=botY+ph-12;
  const zy=(T2+B2)/2, pW=R2-L2, pH=B2-T2;
  const maxA=Math.PI*0.65;

  // Danger zones
  ctx.fillStyle='rgba(255,40,60,0.05)';
  const dz=(0.3/maxA)*(pH/2);
  ctx.fillRect(L2,T2,pW,pH/2-dz); ctx.fillRect(L2,T2+pH/2+dz,pW,pH/2-dz);

  // Zero line
  ctx.strokeStyle='rgba(50,120,70,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(L2,zy); ctx.lineTo(R2,zy); ctx.stroke(); ctx.setLineDash([]);

  // Data
  const hist=sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({th},i) => {
      const hx=L2+(i/P.maxHist)*pW, hy=zy-(th/maxA)*(pH*0.5);
      i===0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
    });
    ctx.strokeStyle=poleColor(); ctx.lineWidth=1.5; ctx.globalAlpha=0.85; ctx.stroke(); ctx.globalAlpha=1;
  }

  // Y labels
  ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='rgba(70,120,90,0.5)';
  ctx.textAlign='right';
  ctx.fillText('+90°',L2-2,T2+8); ctx.fillText('0',L2-2,zy+4); ctx.fillText('-90°',L2-2,B2+2);
  ctx.textAlign='left';
}

// ── u(t) control input plot ──────────────────────────────────
function drawUPlot(px, pw) {
  const ph = BOT_H;
  panelBg(px, botY, pw, ph, 8);
  ctx.font = '10px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  ctx.textAlign='center'; ctx.fillText('CONTROL INPUT  u(t)', px+pw/2, botY+14); ctx.textAlign='left';

  const L2=px+14, R2=px+pw-14, T2=botY+22, B2=botY+ph-12;
  const zy=(T2+B2)/2, pW=R2-L2, pH=B2-T2;
  const maxU=P.Umax;

  // Saturation markers
  ctx.strokeStyle='rgba(200,80,50,0.2)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
  ctx.beginPath(); ctx.moveTo(L2,T2); ctx.lineTo(R2,T2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L2,B2); ctx.lineTo(R2,B2); ctx.stroke();
  ctx.setLineDash([]);

  // Zero line
  ctx.strokeStyle='rgba(50,120,70,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(L2,zy); ctx.lineTo(R2,zy); ctx.stroke(); ctx.setLineDash([]);

  // Data
  const hist=sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({u},i) => {
      const hx=L2+(i/P.maxHist)*pW, hy=zy-(u/maxU)*(pH*0.5);
      i===0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
    });
    ctx.strokeStyle = COL.push; ctx.lineWidth=1.5; ctx.globalAlpha=0.8; ctx.stroke(); ctx.globalAlpha=1;
  }

  // Y labels
  ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='rgba(70,120,90,0.5)';
  ctx.textAlign='right';
  ctx.fillText(`+${maxU}N`,L2-2,T2+8); ctx.fillText('0',L2-2,zy+4); ctx.fillText(`-${maxU}N`,L2-2,B2+2);
  ctx.textAlign='left';
}

// ── Phase portrait  θ vs θ̇ ─────────────────────────────────
function drawPhasePortrait(px, pw) {
  const ph = BOT_H;
  panelBg(px, botY, pw, ph, 8);
  ctx.font = '10px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  ctx.textAlign='center'; ctx.fillText('PHASE  θ vs θ̇', px+pw/2, botY+14); ctx.textAlign='left';

  const ocx=px+pw/2, ocy=botY+ph*0.56;
  const sX=(pw*0.43)/(Math.PI/2), sY=(ph*0.4)/7;

  ctx.strokeStyle='rgba(50,110,70,0.3)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(px+10,ocy); ctx.lineTo(px+pw-10,ocy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ocx,botY+18); ctx.lineTo(ocx,botY+ph-10); ctx.stroke();

  ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='rgba(50,110,70,0.5)';
  ctx.textAlign='center'; ctx.fillText('θ →', px+pw-16, ocy-4);
  ctx.textAlign='right';  ctx.fillText('θ̇',  ocx-4, botY+22);
  ctx.textAlign='left';

  const hist=sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({th, thd}, i) => {
      const hx=ocx+th*sX, hy=ocy-thd*sY;
      i===0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
    });
    ctx.strokeStyle=poleColor(); ctx.lineWidth=1; ctx.globalAlpha=0.45; ctx.stroke(); ctx.globalAlpha=1;
  }

  // Current dot
  const dotX=ocx+sim.s[2]*sX, dotY=ocy-sim.s[3]*sY;
  ctx.shadowColor=poleColor(); ctx.shadowBlur=10;
  ctx.fillStyle=poleColor(); ctx.beginPath(); ctx.arc(dotX,dotY,5,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
}

// ════════════════════════════════════════════════════════════
//  GAME OVER
// ════════════════════════════════════════════════════════════
function drawGameOver() {
  ctx.fillStyle='rgba(0,0,12,0.78)'; ctx.fillRect(0,0,W,H);
  const cx=SX, cy=H/2-20, pw=440, ph=240;
  ctx.fillStyle='rgba(6,10,24,0.97)'; ctx.strokeStyle='rgba(255,60,80,0.55)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.roundRect(cx-pw/2,cy-ph/2,pw,ph,14); ctx.fill(); ctx.stroke();

  ctx.font='bold 46px JetBrains Mono,monospace';
  ctx.textAlign='center'; ctx.shadowColor='#ff3355'; ctx.shadowBlur=22;
  ctx.fillStyle='#ff3355'; ctx.fillText('POLE FELL', cx, cy-ph/2+62);
  ctx.shadowBlur=0;

  ctx.font='18px JetBrains Mono,monospace';
  ctx.fillStyle='rgba(210,230,255,0.85)';
  ctx.fillText(`${sim.mode} held it for ${sim.balTime.toFixed(2)}s`, cx, cy-ph/2+104);

  const best = sim.mode==='LQR' ? sim.lqrBest : sim.mode==='MPC' ? sim.mpcBest : sim.pidBest;
  ctx.font='14px JetBrains Mono,monospace'; ctx.fillStyle='#ffdd44';
  ctx.fillText('Best: '+best.toFixed(2)+'s', cx, cy-ph/2+136);

  ctx.font='13px JetBrains Mono,monospace'; ctx.fillStyle=COL.dim;
  ctx.fillText('SPACE or click anywhere to restart', cx, cy-ph/2+185);
  ctx.textAlign='left';
}

// ════════════════════════════════════════════════════════════
//  MASTER DRAW  —  called once per frame
// ════════════════════════════════════════════════════════════
function draw() {
  RIGHT_X = W - RIGHT_W - 12;
  botY    = H - BOT_H - 10;

  ctx.clearRect(0,0,W,H);
  drawBg();
  drawTrack();
  if (sim.mode==='MPC') drawMPCGhost();
  drawCart(sim.s[0]);
  drawPole(sim.s[0], sim.s[2]);
  drawForce();

  // Top
  drawTopBar();

  // Left sidebar
  drawStatePanel();
  drawLinearMatrices();
  drawEigenvalues();

  // Right sidebar
  drawButtons();
  drawInfoPanel();
  drawMetricsTable();

  // Bottom row
  const bw1 = Math.floor((W - 2*BOT_PAD) * 0.35);
  const bw2 = Math.floor((W - 2*BOT_PAD) * 0.35);
  const bw3 = W - 2*BOT_PAD - bw1 - bw2 - 2*BOT_PAD;
  drawAnglePlot(BOT_PAD, bw1);
  drawUPlot(BOT_PAD + bw1 + BOT_PAD, bw2);
  drawPhasePortrait(BOT_PAD + bw1 + BOT_PAD + bw2 + BOT_PAD, bw3);

  if (!sim.alive) drawGameOver();
}
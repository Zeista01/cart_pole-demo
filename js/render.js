'use strict';

// ════════════════════════════════════════════════════════════
//  CANVAS SETUP
// ════════════════════════════════════════════════════════════
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
let W, H, SX, SY, SC;

// Mobile layout computed values
let _simTop, _simBot, _botPanelTop, _botPanelBot, _actionBarTop;

function isMobile() {
  // Only true phones/small tablets in portrait — never triggers on laptops/desktops
  return W <= 600 || (W <= 768 && H > W * 1.2);
}

function onResize() {
  W = cvs.width  = window.innerWidth;
  H = cvs.height = window.innerHeight;

  if (isMobile()) {
    const topBarH  = 52;
    const modeBtnH = 50;
    const actionH  = 50;
    const remaining = H - topBarH - modeBtnH - actionH;
    _simTop        = topBarH + modeBtnH;
    _simBot        = topBarH + modeBtnH + Math.round(remaining * 0.58);
    _botPanelTop   = _simBot;
    _actionBarTop  = H - actionH;
    _botPanelBot   = _actionBarTop;

    SX = W * 0.5;
    const simH = _simBot - _simTop;
    SY = _simTop + simH * 0.54;
    SC = Math.min(W / 5.6, simH / 5.2);
  } else {
    SX = W * 0.5;
    SY = H * 0.54;
    SC = Math.min(W / 8.5, H / 6);
  }
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

// Mobile tab state
let mobileTab = 'plot'; // 'plot' | 'state' | 'info'
let mobilePlotTab = 'angle'; // 'angle' | 'control' | 'phase'

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

  const gs = SC * 0.5;
  ctx.strokeStyle = 'rgba(20,60,40,0.07)'; ctx.lineWidth = 1;
  for (let x = SX % gs; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = SY % gs; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

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
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(lx, ty+th+3, rx-lx, 8);
  const tg = ctx.createLinearGradient(0, ty-3, 0, ty+th+4);
  tg.addColorStop(0, COL.railTop); tg.addColorStop(0.3, '#6a8090'); tg.addColorStop(1, COL.railBot);
  ctx.fillStyle = tg; ctx.fillRect(lx, ty-3, rx-lx, th+6);
  ctx.fillStyle = 'rgba(200,230,255,0.1)'; ctx.fillRect(lx, ty-3, rx-lx, 2);
  ctx.strokeStyle = 'rgba(60,140,90,0.25)'; ctx.lineWidth = 1;
  ctx.setLineDash([5,5]);
  ctx.beginPath(); ctx.moveTo(SX, ty-40); ctx.lineTo(SX, ty+th+30); ctx.stroke();
  ctx.setLineDash([]);
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
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(sx+3, sy+ch+wr+4, cw*0.8, 5, 0, 0, Math.PI*2); ctx.fill();
  const bg = ctx.createLinearGradient(sx-cw, sy-ch, sx+cw, sy+ch);
  bg.addColorStop(0, COL.cartTop); bg.addColorStop(0.5,'#223060'); bg.addColorStop(1, COL.cartBot);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(sx-cw, sy-ch, cw*2, ch*2, 8); ctx.fill();
  ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(sx-cw, sy-ch, cw*2, ch*2, 8); ctx.stroke();
  ctx.fillStyle = 'rgba(100,160,255,0.1)';
  ctx.beginPath(); ctx.roundRect(sx-cw+4, sy-ch+4, cw*2-8, ch*0.55, 3); ctx.fill();
  const pc = poleColor();
  ctx.shadowColor = pc; ctx.shadowBlur = 14;
  ctx.fillStyle = pc;
  ctx.beginPath(); ctx.arc(sx, sy-ch*0.3, 5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1e2e50'; ctx.beginPath(); ctx.arc(sx, sy-ch, 11, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sx, sy-ch, 11, 0, Math.PI*2); ctx.stroke();
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

  for (const [w, a] of [[24,0.04],[12,0.09],[6,0.18],[2.5,1]]) {
    const [r,g,b] = hexToRgb(poleColor());
    const rr = Math.round(r*(1-danger)+255*danger);
    const gg = Math.round(g*(1-danger));
    const bb = Math.round(b*(1-danger));
    ctx.strokeStyle = a < 1 ? `rgba(${rr},${gg},${bb},${a})` : col;
    ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(tx, ty); ctx.stroke();
  }

  const pg = ctx.createRadialGradient(pivX, pivY, 0, pivX, pivY, 10);
  pg.addColorStop(0,'#e0f0ff'); pg.addColorStop(1,'#304878');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pivX, pivY, 9, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = COL.cartEdge; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(pivX, pivY, 9, 0, Math.PI*2); ctx.stroke();

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
//  TOP BAR (desktop)
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
//  MOBILE TOP BAR
// ════════════════════════════════════════════════════════════
function drawMobileTopBar() {
  const h = 52;
  ctx.fillStyle = 'rgba(4,8,20,0.95)';
  ctx.fillRect(0, 0, W, h);
  ctx.strokeStyle = 'rgba(40,80,130,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(W, h); ctx.stroke();

  ctx.font = 'bold 14px JetBrains Mono,monospace';
  ctx.fillStyle = 'rgba(200,230,255,0.92)';
  ctx.textAlign = 'left';
  ctx.fillText('INVERTED PENDULUM', 14, 22);

  ctx.font = '9px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim;
  ctx.fillText('tap canvas to push  ·  use buttons below', 14, 40);

  const pc = poleColor();
  ctx.font = 'bold 13px JetBrains Mono,monospace';
  ctx.fillStyle = pc;
  ctx.textAlign = 'right';
  ctx.fillText(sim.mode, W - 14, 22);

  const danger = Math.abs(sim.s[2]) > 0.3;
  ctx.font = 'bold 15px JetBrains Mono,monospace';
  ctx.fillStyle = danger ? COL.danger : '#ffdd44';
  ctx.fillText(sim.balTime.toFixed(2) + 's', W - 14, 42);
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  MOBILE MODE BUTTONS
// ════════════════════════════════════════════════════════════
function drawMobileModeButtons() {
  const y = 52, h = 50;
  const bw = Math.floor(W / 3);
  const modes = ['PID', 'LQR', 'MPC'];
  const colors = { LQR: COL.lqr, MPC: COL.mpc, PID: COL.pid };
  const bgs    = { LQR: 'rgba(0,60,38,0.9)', MPC: 'rgba(0,45,65,0.9)', PID: 'rgba(50,25,0,0.9)' };

  ctx.fillStyle = 'rgba(3,6,16,0.97)';
  ctx.fillRect(0, y, W, h);

  modes.forEach((mode, i) => {
    const x = i * bw;
    const active = sim.mode === mode;
    const col = colors[mode];

    ctx.fillStyle = active ? bgs[mode] : 'rgba(8,12,26,0.85)';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 3, bw - 4, h - 6, 6); ctx.fill();

    ctx.strokeStyle = active ? col : 'rgba(40,70,100,0.5)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(x + 2, y + 3, bw - 4, h - 6, 6); ctx.stroke();

    if (active) { ctx.shadowColor = col; ctx.shadowBlur = 12; }
    ctx.font = 'bold 16px JetBrains Mono,monospace';
    ctx.fillStyle = active ? col : COL.dim;
    ctx.textAlign = 'center';
    ctx.fillText(mode, x + bw / 2, y + h / 2 + 6);
    ctx.shadowBlur = 0;

    BTNS[mode] = { x: x + 2, y: y + 3, w: bw - 4, h: h - 6 };
  });

  ctx.strokeStyle = 'rgba(30,60,90,0.6)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(i * bw, y + 6); ctx.lineTo(i * bw, y + h - 6); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40,80,130,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y + h); ctx.lineTo(W, y + h); ctx.stroke();
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  MOBILE STATE OVERLAY
// ════════════════════════════════════════════════════════════
function drawMobileStateOverlay() {
  const px = 8, py = _simTop + 8;
  const pw = 110, ph = 72;
  const angle = sim.s[2];
  const angleWarn = Math.abs(angle) > 0.3;

  ctx.fillStyle = 'rgba(2,4,14,0.78)';
  ctx.strokeStyle = 'rgba(40,80,130,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 6); ctx.fill(); ctx.stroke();

  ctx.font = '11px JetBrains Mono,monospace';
  const rows = [
    ['θ',  (angle * 180/Math.PI).toFixed(1) + '°',  angleWarn ? '#ff9966' : '#88ffcc'],
    ['x',  sim.s[0].toFixed(2) + ' m',               Math.abs(sim.s[0])>2 ? '#ff9966' : '#e0eeff'],
    ['u',  sim.u.toFixed(1) + ' N',                   sim.u>0 ? '#ffcc88' : '#88ccff'],
    ['ẋ', sim.s[1].toFixed(2),                       '#c0d8f0'],
  ];
  rows.forEach(([lbl, val, col], i) => {
    const ry = py + 16 + i * 14;
    ctx.fillStyle = COL.dim;    ctx.textAlign = 'left';  ctx.fillText(lbl + ':', px + 6, ry);
    ctx.fillStyle = col;        ctx.textAlign = 'right'; ctx.fillText(val, px + pw - 5, ry);
  });
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  MOBILE BOTTOM PANEL
// ════════════════════════════════════════════════════════════
function drawMobileBottomPanel() {
  const tabH = 34;
  const contentY = _botPanelTop + tabH;
  const contentH = _botPanelBot - contentY;
  const panelY   = _botPanelTop;
  const panelH   = _botPanelBot - _botPanelTop;

  ctx.fillStyle = 'rgba(3,6,16,0.97)';
  ctx.fillRect(0, panelY, W, panelH);
  ctx.strokeStyle = 'rgba(40,80,130,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, panelY); ctx.lineTo(W, panelY); ctx.stroke();

  const tabs = [
    { id: 'plot',  label: '📈 ANGLE' },
    { id: 'state', label: '📋 STATE' },
    { id: 'info',  label: '⚙ INFO' },
  ];
  const tw = Math.floor(W / tabs.length);

  tabs.forEach(({ id, label }, i) => {
    const tx = i * tw;
    const active = mobileTab === id;

    ctx.fillStyle = active ? 'rgba(15,28,55,0.95)' : 'rgba(5,10,22,0.6)';
    ctx.fillRect(tx, panelY, tw, tabH);

    ctx.font = 'bold 10px JetBrains Mono,monospace';
    ctx.fillStyle = active ? COL.text : 'rgba(80,120,150,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(label, tx + tw / 2, panelY + 22);

    if (active) {
      ctx.fillStyle = poleColor();
      ctx.fillRect(tx + 8, panelY + tabH - 3, tw - 16, 3);
    }

    if (i > 0) {
      ctx.strokeStyle = 'rgba(30,60,90,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, panelY + 4); ctx.lineTo(tx, panelY + tabH - 4); ctx.stroke();
    }

    BTNS['tab_' + id] = { x: tx, y: panelY, w: tw, h: tabH };
  });

  ctx.strokeStyle = 'rgba(40,80,130,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, panelY + tabH); ctx.lineTo(W, panelY + tabH); ctx.stroke();
  ctx.textAlign = 'left';

  if (mobileTab === 'plot') {
    drawMobilePlotPanel(0, contentY, W, contentH);
  } else if (mobileTab === 'state') {
    drawMobileStateTab(0, contentY, W, contentH);
  } else if (mobileTab === 'info') {
    drawMobileInfoTab(0, contentY, W, contentH);
  }
}

// ─── Mobile plot panel: sub-tabs for angle / control / phase ──
function drawMobilePlotPanel(px, py, pw, ph) {
  const subTabH = 28;
  const plotY = py + subTabH;
  const plotH = ph - subTabH;

  // Sub-tab bar
  const subTabs = [
    { id: 'angle',   label: 'θ(t) ANGLE' },
    { id: 'control', label: 'u(t) FORCE' },
    { id: 'phase',   label: 'PHASE θ/θ̇' },
  ];
  const stw = Math.floor(pw / subTabs.length);

  subTabs.forEach(({ id, label }, i) => {
    const tx = px + i * stw;
    const active = mobilePlotTab === id;
    ctx.fillStyle = active ? 'rgba(20,35,60,0.9)' : 'rgba(5,10,22,0.5)';
    ctx.fillRect(tx, py, stw, subTabH);
    ctx.font = 'bold 9px JetBrains Mono,monospace';
    ctx.fillStyle = active ? poleColor() : 'rgba(70,110,140,0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(label, tx + stw / 2, py + 17);
    if (active) {
      ctx.fillStyle = poleColor();
      ctx.fillRect(tx + 4, py + subTabH - 2, stw - 8, 2);
    }
    if (i > 0) {
      ctx.strokeStyle = 'rgba(30,60,90,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, py + 3); ctx.lineTo(tx, py + subTabH - 3); ctx.stroke();
    }
    BTNS['subPlot_' + id] = { x: tx, y: py, w: stw, h: subTabH };
  });

  // Sub-tab bottom border
  ctx.strokeStyle = 'rgba(40,80,130,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, py + subTabH); ctx.lineTo(px + pw, py + subTabH); ctx.stroke();
  ctx.textAlign = 'left';

  // Plot content
  if (mobilePlotTab === 'angle')   drawMobileAnglePlot(px, plotY, pw, plotH);
  else if (mobilePlotTab === 'control') drawMobileControlPlot(px, plotY, pw, plotH);
  else if (mobilePlotTab === 'phase')   drawMobilePhasePortrait(px, plotY, pw, plotH);
}

function drawMobileAnglePlot(px, py, pw, ph) {
  const pc = poleColor();
  const L = px + 36, R = px + pw - 10, T = py + 8, B = py + ph - 8;
  const zy = (T + B) / 2, pW = R - L, pH = B - T;
  const maxA = Math.PI * 0.65;

  ctx.fillStyle = 'rgba(255,40,60,0.05)';
  const dz = (0.3 / maxA) * (pH / 2);
  ctx.fillRect(L, T, pW, pH/2 - dz);
  ctx.fillRect(L, T + pH/2 + dz, pW, pH/2 - dz);

  ctx.strokeStyle = 'rgba(50,120,70,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(L, zy); ctx.lineTo(R, zy); ctx.stroke(); ctx.setLineDash([]);

  const hist = sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({ th }, i) => {
      const hx = L + (i / P.maxHist) * pW;
      const hy = zy - (th / maxA) * (pH * 0.5);
      i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
    });
    ctx.strokeStyle = pc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
  }

  ctx.font = '9px JetBrains Mono,monospace'; ctx.fillStyle = 'rgba(70,130,100,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText('+90°', L - 2, T + 8);
  ctx.fillText('0', L - 2, zy + 4);
  ctx.fillText('-90°', L - 2, B + 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = COL.dim;
  ctx.font = '9px JetBrains Mono,monospace';
  ctx.fillText('ANGLE  θ(t)', px + pw / 2, T - 1);
  ctx.textAlign = 'left';
}

// ─── Mobile control input plot ────────────────────────────────
function drawMobileControlPlot(px, py, pw, ph) {
  const pc = COL.push;
  const L = px + 36, R = px + pw - 10, T = py + 8, B = py + ph - 8;
  const zy = (T + B) / 2, pW = R - L, pH = B - T;
  const maxU = P.Umax;

  // Saturation lines
  ctx.strokeStyle = 'rgba(200,80,50,0.2)'; ctx.lineWidth = 1; ctx.setLineDash([2,3]);
  ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(R, T); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L, B); ctx.lineTo(R, B); ctx.stroke();
  ctx.setLineDash([]);

  // Zero line
  ctx.strokeStyle = 'rgba(50,120,70,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(L, zy); ctx.lineTo(R, zy); ctx.stroke(); ctx.setLineDash([]);

  const hist = sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({ u }, i) => {
      const hx = L + (i / P.maxHist) * pW;
      const hy = zy - (u / maxU) * (pH * 0.5);
      i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
    });
    ctx.strokeStyle = pc; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
  }

  ctx.font = '9px JetBrains Mono,monospace'; ctx.fillStyle = 'rgba(70,130,100,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText('+' + maxU + 'N', L - 2, T + 8);
  ctx.fillText('0', L - 2, zy + 4);
  ctx.fillText('-' + maxU + 'N', L - 2, B + 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = COL.dim;
  ctx.fillText('CONTROL INPUT  u(t)', px + pw / 2, T - 1);
  ctx.textAlign = 'left';
}

// ─── Mobile phase portrait ────────────────────────────────────
function drawMobilePhasePortrait(px, py, pw, ph) {
  const pc = poleColor();
  const ocx = px + pw / 2, ocy = py + ph * 0.52;
  const sX = (pw * 0.42) / (Math.PI / 2), sY = (ph * 0.42) / 7;

  ctx.strokeStyle = 'rgba(50,110,70,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 10, ocy); ctx.lineTo(px + pw - 10, ocy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ocx, py + 10); ctx.lineTo(ocx, py + ph - 8); ctx.stroke();

  ctx.font = '9px JetBrains Mono,monospace'; ctx.fillStyle = 'rgba(50,110,70,0.5)';
  ctx.textAlign = 'center'; ctx.fillText('θ →', px + pw - 18, ocy - 4);
  ctx.textAlign = 'right';  ctx.fillText('θ̇', ocx - 4, py + 18);
  ctx.textAlign = 'left';

  const hist = sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({ th, thd }, i) => {
      const hx = ocx + th * sX, hy = ocy - thd * sY;
      i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
    });
    ctx.strokeStyle = pc; ctx.lineWidth = 1; ctx.globalAlpha = 0.45; ctx.stroke(); ctx.globalAlpha = 1;
  }

  // Current dot
  const dotX = ocx + sim.s[2] * sX, dotY = ocy - sim.s[3] * sY;
  ctx.shadowColor = pc; ctx.shadowBlur = 10;
  ctx.fillStyle = pc; ctx.beginPath(); ctx.arc(dotX, dotY, 5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = '9px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim; ctx.textAlign = 'center';
  ctx.fillText('PHASE  θ vs θ̇', px + pw / 2, py + 8);
  ctx.textAlign = 'left';
}

function drawMobileStateTab(px, py, pw, ph) {
  const rowH = Math.min(22, Math.floor((ph - 8) / 6));

  const rows = [
    ['θ (angle)',    (sim.s[2]*180/Math.PI).toFixed(2)+'°',  Math.abs(sim.s[2])>0.3?'#ff9966':'#88ffcc'],
    ['θ̇ (ang vel)', sim.s[3].toFixed(3)+' r/s',             '#e0eeff'],
    ['x (pos)',      sim.s[0].toFixed(3)+' m',               Math.abs(sim.s[0])>2?'#ff9966':'#e0eeff'],
    ['ẋ (vel)',     sim.s[1].toFixed(3)+' m/s',             '#e0eeff'],
    ['u (force)',    sim.u.toFixed(2)+' N',                  sim.u>0?'#ffcc88':'#88ccff'],
    ['t (time)',     sim.balTime.toFixed(2)+' s',            '#ffdd44'],
  ];

  ctx.font = '10px JetBrains Mono,monospace';
  rows.forEach(([lbl, val, vc], i) => {
    const ry = py + 12 + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(10,20,40,0.3)';
      ctx.fillRect(px + 6, ry - 11, pw - 12, rowH);
    }
    ctx.fillStyle = COL.dim;   ctx.textAlign = 'left';  ctx.fillText(lbl, px + 12, ry);
    ctx.fillStyle = vc;        ctx.textAlign = 'right'; ctx.fillText(val, px + pw - 10, ry);
  });
  ctx.textAlign = 'left';
}

function drawMobileInfoTab(px, py, pw, ph) {
  const pc = poleColor();
  const mode = sim.mode;
  const g = P.pid;

  ctx.font = 'bold 11px JetBrains Mono,monospace';
  ctx.fillStyle = pc;
  ctx.textAlign = 'left';
  ctx.fillText('▶ ' + mode + ' CONTROLLER', px + 10, py + 14);

  ctx.font = '9px JetBrains Mono,monospace';

  let lines = [];
  if (mode === 'LQR') {
    lines = ['Method: Algebraic Riccati Eq.', 'Policy: u = -Kx  (linear)', 'Online cost: O(1)'];
    if (sim.lqrData) {
      const K = sim.lqrData.K;
      lines.push(`K=[${K[0].toFixed(1)}, ${K[1].toFixed(1)}, ${K[2].toFixed(1)}, ${K[3].toFixed(1)}]`);
    }
  } else if (mode === 'MPC') {
    lines = [
      `Method: Gradient-descent shooting`,
      `Horizon N=${P.Nh}, dt=${P.dtMpc}s, Iters=${P.Ni}`,
      'Online cost: O(Nh²·Ni)',
    ];
  } else {
    lines = [
      `Kp θ=${g.Kp_th}  Ki θ=${g.Ki_th}  Kd θ=${g.Kd_th}`,
      `Kp x=${g.Kp_x}   Ki x=${g.Ki_x}   Kd x=${g.Kd_x}`,
      `Anti-windup iMax=${g.iMax}`,
    ];
  }

  const lineH = Math.min(14, Math.floor((ph - 28) / lines.length));
  lines.forEach((line, i) => {
    ctx.fillStyle = COL.dim;
    ctx.fillText(line, px + 10, py + 28 + i * lineH);
  });

  ctx.textAlign = 'right';
  ctx.font = '9px JetBrains Mono,monospace';
  ctx.fillStyle = 'rgba(0,255,136,0.65)'; ctx.fillText('LQR best: ' + sim.lqrBest.toFixed(2) + 's', px + pw - 8, py + 14);
  ctx.fillStyle = 'rgba(0,212,255,0.65)'; ctx.fillText('MPC best: ' + sim.mpcBest.toFixed(2) + 's', px + pw - 8, py + 26);
  ctx.fillStyle = 'rgba(255,159,28,0.80)'; ctx.fillText('PID best: ' + sim.pidBest.toFixed(2) + 's', px + pw - 8, py + 38);
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  MOBILE ACTION BAR
// ════════════════════════════════════════════════════════════
function drawMobileActionBar() {
  const y = _actionBarTop;
  const h = H - y;

  ctx.fillStyle = 'rgba(2,5,14,0.97)';
  ctx.fillRect(0, y, W, h);
  ctx.strokeStyle = 'rgba(40,80,130,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

  const btnCount = 4;
  const btnW = Math.floor((W - 10) / btnCount);
  const btnH = h - 8;
  const btnY = y + 4;
  const btns = [
    { id: 'restart',   label: '↺ RESET',   bg: 'rgba(10,20,40,0.9)',  border: 'rgba(60,100,160,0.6)',   col: COL.dim },
    { id: 'pushLeft',  label: '◀ PUSH',    bg: 'rgba(8,14,28,0.9)',   border: 'rgba(60,90,140,0.5)',    col: 'rgba(200,220,255,0.75)' },
    { id: 'pushRight', label: 'PUSH ▶',    bg: 'rgba(8,14,28,0.9)',   border: 'rgba(60,90,140,0.5)',    col: 'rgba(200,220,255,0.75)' },
    { id: 'tune',      label: '⚙ TUNE',    bg: 'rgba(8,14,30,0.9)',   border: 'rgba(100,130,180,0.45)', col: COL.text },
  ];

  btns.forEach(({ id, label, bg, border, col }, i) => {
    const bx = 5 + i * (btnW + 2);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(bx, btnY, btnW, btnH, 5); ctx.fill();
    ctx.strokeStyle = border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, btnY, btnW, btnH, 5); ctx.stroke();
    ctx.font = 'bold 10px JetBrains Mono,monospace';
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.fillText(label, bx + btnW / 2, btnY + btnH / 2 + 4);
    BTNS[id] = { x: bx, y: btnY, w: btnW, h: btnH };
  });

  if (sim.challenge) {
    ctx.font = '8px JetBrains Mono,monospace';
    ctx.fillStyle = '#88cc44';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ CHALLENGE ON', W / 2, y - 4);
  }
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  LEFT SIDEBAR (desktop)
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

function drawLinearMatrices() {
  if (!sim.lqrData) return;
  const { A, Bv } = sim.lqrData;
  const py = 226, ph = 182;
  panelBg(LEFT_X, py, LEFT_W, ph, 8);
  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim; ctx.fillText('LINEARISED  ẋ = Ax + Bu', LEFT_X+8, py+14);
  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.matA; ctx.fillText('A =', LEFT_X+8, py+32);
  const cellW = 50, cellH = 17, mx0 = LEFT_X+30, my0 = py+38;
  A.forEach((row, i) => {
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
//  RIGHT SIDEBAR (desktop)
// ════════════════════════════════════════════════════════════
const RIGHT_W = 228;
let RIGHT_X;

function drawButtons() {
  const rx = RIGHT_X;
  const mbw = Math.floor((RIGHT_W - 8) / 3);
  modeBtn('PID', rx,           15, sim.mode==='PID', mbw);
  modeBtn('LQR', rx+mbw+4,     15, sim.mode==='LQR', mbw);
  modeBtn('MPC', rx+mbw*2+8,   15, sim.mode==='MPC', mbw);
  actionBtn('\u21ba RESET', rx, 55, '#1a2a3a','#3060a0','restart', 90);
  actionBtn(sim.challenge ? '\u26a1 ON' : '\u26a1 CHALLENGE',
            rx+98, 55, sim.challenge?'#1a3008':'#0e1810', sim.challenge?'#88cc44':'#2a4020',
            'challenge', sim.challenge?88:RIGHT_W-98);
  ctx.font = '10px JetBrains Mono,monospace'; ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,255,136,0.55)'; ctx.fillText('LQR: '+sim.lqrBest.toFixed(2)+'s', rx+RIGHT_W*0.36, 100);
  ctx.fillStyle = 'rgba(0,212,255,0.55)'; ctx.fillText('MPC: '+sim.mpcBest.toFixed(2)+'s', rx+RIGHT_W*0.68, 100);
  ctx.fillStyle = 'rgba(255,159,28,0.70)'; ctx.fillText('PID: '+sim.pidBest.toFixed(2)+'s',  rx+RIGHT_W, 100);
  ctx.textAlign = 'left';
  const csvY = 112;
  const cw = Math.floor((RIGHT_W - 8) / 3);
  actionBtn('\u2b07 LQR', rx,         csvY, '#0a1a10','rgba(0,255,136,0.4)',  'dlLQR', cw);
  actionBtn('\u2b07 MPC', rx+cw+4,    csvY, '#0a1020','rgba(0,212,255,0.4)',  'dlMPC', cw);
  actionBtn('\u2b07 PID', rx+cw*2+8,  csvY, '#1a0a00','rgba(255,159,28,0.4)','dlPID', cw);
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

function drawMetricsTable() {
  const rx = RIGHT_X, py = H - 220, ph = 208;
  actionBtn('⚙  TUNE GAINS', rx, py - 40, '#0a1020', 'rgba(140,160,200,0.45)', 'tune', RIGHT_W);
  panelBg(rx, py, RIGHT_W, ph, 8);
  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim; ctx.fillText('CONTROLLER COMPARISON', rx+8, py+14);
  ctx.font = 'bold 10px JetBrains Mono,monospace';
  ctx.fillStyle = COL.metricHdr; ctx.fillText('METRIC', rx+8, py+32);
  ctx.fillStyle = COL.lqr; ctx.fillText('LQR', rx+106, py+32);
  ctx.fillStyle = COL.mpc; ctx.fillText('MPC', rx+152, py+32);
  ctx.fillStyle = COL.pid; ctx.fillText('PID', rx+RIGHT_W-16, py+32);
  ctx.strokeStyle = 'rgba(60,120,100,0.4)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx+8, py+38); ctx.lineTo(rx+RIGHT_W-8, py+38); ctx.stroke();
  const rows = [
    ['Bal. t',    metrics.LQR.balTime.toFixed(2)+'s', metrics.MPC.balTime.toFixed(2)+'s', metrics.PID.balTime.toFixed(2)+'s'],
    ['Settle',    metrics.LQR.settleTime != null ? metrics.LQR.settleTime.toFixed(2)+'s' : '--', metrics.MPC.settleTime != null ? metrics.MPC.settleTime.toFixed(2)+'s' : '--', metrics.PID.settleTime != null ? metrics.PID.settleTime.toFixed(2)+'s' : '--'],
    ['Peak|th|',  (metrics.LQR.peakAngle*180/Math.PI).toFixed(1)+'°', (metrics.MPC.peakAngle*180/Math.PI).toFixed(1)+'°', (metrics.PID.peakAngle*180/Math.PI).toFixed(1)+'°'],
    ['int-u2dt',  metrics.LQR.effort.toFixed(1), metrics.MPC.effort.toFixed(1), metrics.PID.effort.toFixed(1)],
    ['Best t',    sim.lqrBest.toFixed(2)+'s', sim.mpcBest.toFixed(2)+'s', sim.pidBest.toFixed(2)+'s'],
  ];
  rows.forEach(([name, lv, mv, pv], i) => {
    const ey = py + 56 + i * 28;
    ctx.fillStyle = i%2===0 ? 'rgba(20,40,30,0.3)' : 'rgba(0,0,0,0)';
    ctx.fillRect(rx+8, ey-14, RIGHT_W-16, 24);
    ctx.font = '10px JetBrains Mono,monospace';
    ctx.fillStyle = COL.dim; ctx.textAlign='left'; ctx.fillText(name, rx+12, ey);
    ctx.fillStyle = COL.lqr; ctx.textAlign='right'; ctx.fillText(lv, rx+134, ey);
    ctx.fillStyle = COL.mpc; ctx.fillText(mv, rx+180, ey);
    ctx.fillStyle = COL.pid; ctx.fillText(pv, rx+RIGHT_W-4, ey);
    ctx.textAlign = 'left';
  });
  const liveXmap = { LQR: rx+92, MPC: rx+138, PID: rx+RIGHT_W-50 };
  const liveCol  = { LQR: COL.lqr, MPC: COL.mpc, PID: COL.pid };
  ctx.strokeStyle = liveCol[sim.mode]||COL.lqr;
  ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(liveXmap[sim.mode]||rx+92, py+23, 44, rows.length*28+20, 3); ctx.stroke();
  ctx.globalAlpha = 1;
}

// ════════════════════════════════════════════════════════════
//  BOTTOM PANELS (desktop)
// ════════════════════════════════════════════════════════════
const BOT_H = 140, BOT_PAD = 12;
let botY;

function drawAnglePlot(px, pw) {
  const ph = BOT_H;
  panelBg(px, botY, pw, ph, 8);
  ctx.font = '10px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  ctx.textAlign = 'center'; ctx.fillText('ANGLE  θ(t)', px+pw/2, botY+14); ctx.textAlign='left';
  const L2=px+14, R2=px+pw-14, T2=botY+22, B2=botY+ph-12;
  const zy=(T2+B2)/2, pW=R2-L2, pH=B2-T2;
  const maxA=Math.PI*0.65;
  ctx.fillStyle='rgba(255,40,60,0.05)';
  const dz=(0.3/maxA)*(pH/2);
  ctx.fillRect(L2,T2,pW,pH/2-dz); ctx.fillRect(L2,T2+pH/2+dz,pW,pH/2-dz);
  ctx.strokeStyle='rgba(50,120,70,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(L2,zy); ctx.lineTo(R2,zy); ctx.stroke(); ctx.setLineDash([]);
  const hist=sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({th},i) => {
      const hx=L2+(i/P.maxHist)*pW, hy=zy-(th/maxA)*(pH*0.5);
      i===0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
    });
    ctx.strokeStyle=poleColor(); ctx.lineWidth=1.5; ctx.globalAlpha=0.85; ctx.stroke(); ctx.globalAlpha=1;
  }
  ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='rgba(70,120,90,0.5)';
  ctx.textAlign='right';
  ctx.fillText('+90°',L2-2,T2+8); ctx.fillText('0',L2-2,zy+4); ctx.fillText('-90°',L2-2,B2+2);
  ctx.textAlign='left';
}

function drawUPlot(px, pw) {
  const ph = BOT_H;
  panelBg(px, botY, pw, ph, 8);
  ctx.font = '10px JetBrains Mono,monospace'; ctx.fillStyle = COL.dim;
  ctx.textAlign='center'; ctx.fillText('CONTROL INPUT  u(t)', px+pw/2, botY+14); ctx.textAlign='left';
  const L2=px+14, R2=px+pw-14, T2=botY+22, B2=botY+ph-12;
  const zy=(T2+B2)/2, pW=R2-L2, pH=B2-T2;
  const maxU=P.Umax;
  ctx.strokeStyle='rgba(200,80,50,0.2)'; ctx.lineWidth=1; ctx.setLineDash([2,3]);
  ctx.beginPath(); ctx.moveTo(L2,T2); ctx.lineTo(R2,T2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L2,B2); ctx.lineTo(R2,B2); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle='rgba(50,120,70,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,4]);
  ctx.beginPath(); ctx.moveTo(L2,zy); ctx.lineTo(R2,zy); ctx.stroke(); ctx.setLineDash([]);
  const hist=sim.history;
  if (hist.length > 2) {
    ctx.beginPath();
    hist.forEach(({u},i) => {
      const hx=L2+(i/P.maxHist)*pW, hy=zy-(u/maxU)*(pH*0.5);
      i===0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
    });
    ctx.strokeStyle = COL.push; ctx.lineWidth=1.5; ctx.globalAlpha=0.8; ctx.stroke(); ctx.globalAlpha=1;
  }
  ctx.font='9px JetBrains Mono,monospace'; ctx.fillStyle='rgba(70,120,90,0.5)';
  ctx.textAlign='right';
  ctx.fillText(`+${maxU}N`,L2-2,T2+8); ctx.fillText('0',L2-2,zy+4); ctx.fillText(`-${maxU}N`,L2-2,B2+2);
  ctx.textAlign='left';
}

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
  const dotX=ocx+sim.s[2]*sX, dotY=ocy-sim.s[3]*sY;
  ctx.shadowColor=poleColor(); ctx.shadowBlur=10;
  ctx.fillStyle=poleColor(); ctx.beginPath(); ctx.arc(dotX,dotY,5,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
}

// ════════════════════════════════════════════════════════════
//  GAME OVER
// ════════════════════════════════════════════════════════════
function drawGameOver() {
  if (isMobile()) { drawMobileGameOver(); return; }
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

function drawMobileGameOver() {
  ctx.fillStyle = 'rgba(0,0,12,0.85)'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2;
  const pw = Math.min(W - 32, 320), ph = 190;
  ctx.fillStyle = 'rgba(6,10,24,0.97)';
  ctx.strokeStyle = 'rgba(255,60,80,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(cx - pw/2, cy - ph/2, pw, ph, 12); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px JetBrains Mono,monospace';
  ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 18;
  ctx.fillStyle = '#ff3355';
  ctx.fillText('POLE FELL', cx, cy - ph/2 + 46);
  ctx.shadowBlur = 0;
  ctx.font = '13px JetBrains Mono,monospace';
  ctx.fillStyle = 'rgba(210,230,255,0.85)';
  ctx.fillText(`${sim.mode} held it for ${sim.balTime.toFixed(2)}s`, cx, cy - ph/2 + 75);
  const best = sim.mode==='LQR' ? sim.lqrBest : sim.mode==='MPC' ? sim.mpcBest : sim.pidBest;
  ctx.font = 'bold 13px JetBrains Mono,monospace';
  ctx.fillStyle = '#ffdd44';
  ctx.fillText('Best: ' + best.toFixed(2) + 's', cx, cy - ph/2 + 98);
  ctx.font = '11px JetBrains Mono,monospace';
  ctx.fillStyle = COL.dim;
  ctx.fillText('Tap anywhere to restart', cx, cy - ph/2 + 122);
  const btnW = 150, btnH = 38, btnY = cy - ph/2 + 135;
  ctx.fillStyle = 'rgba(20,40,100,0.9)';
  ctx.strokeStyle = 'rgba(80,140,255,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(cx - btnW/2, btnY, btnW, btnH, 8); ctx.fill(); ctx.stroke();
  ctx.font = 'bold 12px JetBrains Mono,monospace';
  ctx.fillStyle = COL.text;
  ctx.fillText('↺ RESTART', cx, btnY + btnH/2 + 5);
  BTNS['restart'] = { x: cx - btnW/2, y: btnY, w: btnW, h: btnH };
  ctx.textAlign = 'left';
}

// ════════════════════════════════════════════════════════════
//  MASTER DRAW  —  called once per frame
// ════════════════════════════════════════════════════════════
function draw() {
  ctx.clearRect(0,0,W,H);
  drawBg();

  if (isMobile()) {
    drawMobileTopBar();
    drawMobileModeButtons();

    // Clip to simulation zone
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, _simTop, W, _simBot - _simTop);
    ctx.clip();
    drawTrack();
    if (sim.mode === 'MPC') drawMPCGhost();
    drawCart(sim.s[0]);
    drawPole(sim.s[0], sim.s[2]);
    drawForce();
    ctx.restore();

    drawMobileStateOverlay();
    drawMobileBottomPanel();
    drawMobileActionBar();
  } else {
    RIGHT_X = W - RIGHT_W - 12;
    botY    = H - BOT_H - 10;
    drawTrack();
    if (sim.mode==='MPC') drawMPCGhost();
    drawCart(sim.s[0]);
    drawPole(sim.s[0], sim.s[2]);
    drawForce();
    drawTopBar();
    drawStatePanel();
    drawLinearMatrices();
    drawEigenvalues();
    drawButtons();
    drawInfoPanel();
    drawMetricsTable();
    const bw1 = Math.floor((W - 2*BOT_PAD) * 0.35);
    const bw2 = Math.floor((W - 2*BOT_PAD) * 0.35);
    const bw3 = W - 2*BOT_PAD - bw1 - bw2 - 2*BOT_PAD;
    drawAnglePlot(BOT_PAD, bw1);
    drawUPlot(BOT_PAD + bw1 + BOT_PAD, bw2);
    drawPhasePortrait(BOT_PAD + bw1 + BOT_PAD + bw2 + BOT_PAD, bw3);
  }

  if (!sim.alive) drawGameOver();
}

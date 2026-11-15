// 펜: 수업 화면(인트로·판서·복습) 위에 마우스·손가락으로 바로 쓰기
//   - 쓴 글씨는 화면별로 남음 (차시를 나가면 지워짐)
//   - 펜이 켜져 있는 동안에는 클릭·다음 버튼·키로 넘어가지 않음
const COLORS = ['#e02424', '#1d4ed8', '#111111', '#16a34a'];
const WIDTHS = [3, 6, 11];

let on = false;
let color = COLORS[0];
let width = WIDTHS[1];
let eraser = false;
let key = '';           // 지금 화면 이름 (차시:단계:쪽)
let allowed = false;    // 지금 단계에서 펜을 쓸 수 있는지
let strokes = {};       // key → [{c, w, p:[[x,y],…]}]  좌표는 화면 크기에 대한 비율
let cur = null;
let canvas, ctx, bar, stageEl, onChange = function () {};

export function isOn() { return on; }

// 차시를 새로 시작하거나 목록으로 나갈 때: 쓴 글씨를 모두 지우고 펜 끄기
export function reset() {
  strokes = {};
  setOn(false);
}

// 수업 화면을 그릴 때마다 부름: 지금 화면 이름과 펜을 쓸 수 있는지 알려 줌
export function sync(k, canUse) {
  key = k;
  allowed = !!canUse;
  if (!allowed && on) setOn(false);
  const btn = document.getElementById('penBtn');
  if (btn) {
    btn.style.display = allowed ? '' : 'none';
    btn.classList.toggle('on', on);
    btn.textContent = on ? '✎ 펜 켬' : '✎ 펜';
  }
  place();
  redraw();
}

export function toggle() { if (allowed || on) setOn(!on); }

function setOn(v) {
  on = !!v;
  if (!on) { eraser = false; cur = null; }
  document.body.classList.toggle('pen-on', on);
  if (bar) { bar.hidden = !on; paintBar(); }
  const btn = document.getElementById('penBtn');
  if (btn) { btn.classList.toggle('on', on); btn.textContent = on ? '✎ 펜 켬' : '✎ 펜'; }
  onChange(on);
}

// ── 그리기 판을 수업 화면(stage) 위에 꼭 맞게 놓기
function place() {
  if (!canvas || !stageEl) return;
  const r = stageEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.style.left = r.left + 'px';
  canvas.style.top = r.top + 'px';
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function list() { return strokes[key] || (strokes[key] = []); }

function drawStroke(s, W, H) {
  ctx.strokeStyle = s.c;
  ctx.lineWidth = s.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  s.p.forEach(function (pt, i) {
    const x = pt[0] * W, y = pt[1] * H;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  if (s.p.length === 1) ctx.lineTo(s.p[0][0] * W + 0.1, s.p[0][1] * H);
  ctx.stroke();
}

function redraw() {
  if (!canvas) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  if (!allowed) return;
  (strokes[key] || []).forEach(function (s) { drawStroke(s, W, H); });
}

// ── 지우개: 닿은 선을 통째로 지움
function eraseAt(x, y) {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const arr = list();
  const R = 14;
  for (let i = arr.length - 1; i >= 0; i--) {
    const lim = R + arr[i].w / 2;
    const pts = arr[i].p;
    let hit = false;
    for (let j = 0; j < pts.length && !hit; j++) {
      // 점과 점 사이 선분까지의 거리 (곧게 그은 긴 선도 가운데를 지우면 지워지게)
      const ax = pts[j][0] * W, ay = pts[j][1] * H;
      const b = pts[j + 1] || pts[j];
      const bx = b[0] * W, by = b[1] * H;
      const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
      const t = L ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L)) : 0;
      const dx = ax + t * vx - x, dy = ay + t * vy - y;
      hit = dx * dx + dy * dy <= lim * lim;
    }
    if (hit) arr.splice(i, 1);
  }
  redraw();
}

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

function bindCanvas() {
  canvas.addEventListener('pointerdown', function (e) {
    if (!on) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    if (eraser || e.button === 2 || e.button === 5) { cur = { erase: true }; eraseAt(p[0], p[1]); return; }
    const W = canvas.clientWidth, H = canvas.clientHeight;
    cur = { c: color, w: width, p: [[p[0] / W, p[1] / H]] };
    list().push(cur);
    redraw();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!on || !cur) return;
    const p = pointerPos(e);
    if (cur.erase) { eraseAt(p[0], p[1]); return; }
    const W = canvas.clientWidth, H = canvas.clientHeight;
    cur.p.push([p[0] / W, p[1] / H]);
    // 마지막 한 토막만 이어 그리기
    const n = cur.p.length;
    ctx.strokeStyle = cur.c; ctx.lineWidth = cur.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cur.p[n - 2][0] * W, cur.p[n - 2][1] * H);
    ctx.lineTo(cur.p[n - 1][0] * W, cur.p[n - 1][1] * H);
    ctx.stroke();
  });
  const end = function () { cur = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

// ── 도구 막대
function paintBar() {
  if (!bar) return;
  bar.querySelectorAll('[data-c]').forEach(function (b) { b.classList.toggle('sel', !eraser && b.getAttribute('data-c') === color); });
  bar.querySelectorAll('[data-w]').forEach(function (b) { b.classList.toggle('sel', +b.getAttribute('data-w') === width); });
  const er = bar.querySelector('[data-act="eraser"]');
  if (er) er.classList.toggle('sel', eraser);
}

function buildBar() {
  bar = document.createElement('div');
  bar.className = 'pen-bar';
  bar.hidden = true;
  bar.innerHTML =
    COLORS.map(function (c) { return '<button class="pc" data-c="' + c + '" style="background:' + c + '" aria-label="색"></button>'; }).join('') +
    '<span class="psep"></span>' +
    WIDTHS.map(function (w) { return '<button class="pw" data-w="' + w + '" aria-label="굵기"><i style="height:' + w + 'px"></i></button>'; }).join('') +
    '<span class="psep"></span>' +
    '<button class="pt" data-act="eraser">지우개</button>' +
    '<button class="pt" data-act="clear">모두 지우기</button>' +
    '<button class="pt off" data-act="off">펜 끄기</button>';
  bar.addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-c')) { color = b.getAttribute('data-c'); eraser = false; }
    else if (b.hasAttribute('data-w')) { width = +b.getAttribute('data-w'); eraser = false; }
    else if (b.getAttribute('data-act') === 'eraser') eraser = !eraser;
    else if (b.getAttribute('data-act') === 'clear') { strokes[key] = []; redraw(); }
    else if (b.getAttribute('data-act') === 'off') { setOn(false); return; }
    paintBar();
  });
  document.getElementById('run').appendChild(bar);
}

// change(on): 펜을 켜고 끌 때 수업 화면을 다시 그리도록 알려 줌
export function initPen(change) {
  if (change) onChange = change;
  stageEl = document.getElementById('stage');
  canvas = document.createElement('canvas');
  canvas.className = 'pen-canvas';
  document.getElementById('run').appendChild(canvas);
  ctx = canvas.getContext('2d');
  bindCanvas();
  buildBar();
  paintBar();
  window.addEventListener('resize', function () { place(); redraw(); });
}

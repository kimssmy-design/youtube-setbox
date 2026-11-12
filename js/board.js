// 판서: 글을 줄 단위로 읽어 한 단계씩 보여 줍니다.
//
// 줄 쓰는 법
//   # 학습 1. 제목 (109쪽)   큰 제목. 항상 새 화면에서 시작. 끝의 (109쪽)은 쪽수 배지
//   1.  (1)  ①              번호 모양으로 단계를 판단. 아래에 더 깊은 번호가 딸려 있으면 소제목, 없으면 내용
//   *글자*                   핵심어(빨간 글씨). "빈칸"을 켜면 빈칸으로 먼저 나오고 한 번 더 누르면 채워짐
//   ※ 보충                   빨간 보충 줄        - 보충   회색 작은 글씨
//   왼쪽 | 오른쪽             두 칸 비교(이어지는 줄끼리 표처럼 묶임, 첫 줄은 칸 제목)
//   [사진] 설명  [영상] 제목  [기사] 제목   줄 아래에 작은 카드로 붙음(누르면 크게)
//   ---                      여기서 화면 넘김
import { videosOf } from './state.js';
import * as store from './store.js';
import { esc, safeUrl } from './ui.js';

const MEDIA = /^\[(사진|영상|기사)\]\s*(.+)$/;
const PAGE = /\s*\(\s*(?:p\.?\s*(\d+(?:\s*[~\-–]\s*\d+)?)|(\d+(?:\s*[~\-–]\s*\d+)?)\s*(?:쪽|페이지))\s*\)\s*$/i;
const CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

function findIndex(list, name, getKey) {
  const n = name.trim();
  let idx = list.findIndex(function (x) { return String(getKey(x) || '').trim() === n; });
  if (idx === -1) idx = list.findIndex(function (x) { return String(getKey(x) || '').trim().indexOf(n) === 0; });
  return idx;
}

// 빈 줄을 뺀 줄 목록
export function parseText(text) {
  return String(text || '').split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
}

function countBlanks(t) { return (t.match(/\*[^*]+\*/g) || []).length; }

// 한 차시의 판서를 읽어 { rows, items, missing } 으로 돌려줌
//   items: 한 번 누를 때마다 나타나는 것(글 줄, 비교 칸, 자료 카드)
//   rows : 화면에 쌓이는 가로줄(글 줄 / 자료 줄 / 비교 줄 / 화면 넘김)
export function parse(lesson) {
  const rows = [], items = [], missing = [];
  const photos = lesson.photos || [];
  const links = lesson.links || [];
  const vids = videosOf(lesson.gi, lesson.mi, lesson.si);
  let nBlank = 0, pendingBreak = false;

  function media(kind, name, raw) {
    let idx;
    if (kind === '사진') {
      idx = findIndex(photos, name, function (p) { return p.caption; });
      if (idx !== -1) return { k: 'photo', i: idx, p: photos[idx] };
    } else if (kind === '영상') {
      idx = findIndex(vids, name, function (v) { return v.title; });
      if (idx !== -1) return { k: 'video', v: vids[idx] };
    } else {
      idx = findIndex(links, name, function (l) { return l.title || l.url; });
      if (idx !== -1) return { k: 'link', l: links[idx] };
    }
    missing.push(raw);
    return null;
  }
  function add(item, row) {
    item.row = rows.indexOf(row);
    if (item.k === 'text') { item.b0 = nBlank; item.blanks = countBlanks(item.t); nBlank += item.blanks; }
    items.push(item);
    row.cells.push(items.length - 1);
  }
  function textItem(t) {
    const it = { k: 'text', t: t, sub: 'lv', lv: 0, pg: '' };
    const pm = PAGE.exec(it.t);
    if (pm) { it.pg = (pm[1] || pm[2]).replace(/\s/g, ''); it.t = it.t.slice(0, pm.index); }
    let m;
    if (it.t.charAt(0) === '#' || /^학습\s*\d+\s*[.:]/.test(it.t)) {
      it.sub = 'big';
      it.t = it.t.replace(/^#+\s*/, '');
      m = /^(학습\s*\d+)\s*[.:]?\s*(.*)$/.exec(it.t);
      if (m) { it.label = m[1].replace(/\s+/g, ' ').replace(/(학습)(\d)/, '$1 $2'); it.t = m[2]; }
    } else if (it.t.charAt(0) === '※' || (it.t.charAt(0) === '*' && (it.t.match(/\*/g) || []).length % 2 === 1)) {
      it.sub = 'note';
      it.t = '※ ' + it.t.replace(/^[※*]\s*/, '');
    } else if (/^[-·•]\s*/.test(it.t)) {
      it.sub = 'sub';
      it.t = '· ' + it.t.replace(/^[-·•]\s*/, '');
    } else if (/^\d+\.\s/.test(it.t)) it.lv = 1;
    else if (/^\(\d+\)/.test(it.t)) it.lv = 2;
    else if (CIRC.indexOf(it.t.charAt(0)) !== -1) it.lv = 3;
    return it;
  }

  parseText(lesson.text).forEach(function (t) {
    const last = rows[rows.length - 1];
    if (/^-{3,}$/.test(t)) { rows.push({ type: 'break', cells: [] }); pendingBreak = true; return; }
    if (t.indexOf('|') !== -1) {
      const cells = t.split('|').map(function (c) { return c.trim(); });
      const row = { type: 'cmp', cells: [], cols: cells.length, slots: [], head: !(last && last.type === 'cmp') };
      rows.push(row);
      cells.forEach(function (c) {
        if (!c) { row.slots.push(-1); return; }
        const mm = MEDIA.exec(c);
        const it = mm ? media(mm[1], mm[2], c) : { k: 'text', t: c, sub: 'cell', lv: 0, pg: '' };
        if (!it) { row.slots.push(-1); return; }
        it.cell = true;
        add(it, row);
        row.slots.push(items.length - 1);
      });
      if (!row.cells.length) rows.pop();
      return;
    }
    const m = MEDIA.exec(t);
    if (m) {
      const it = media(m[1], m[2], t);
      if (!it) return;
      let row = last;
      if (!row || row.type !== 'media') { row = { type: 'media', cells: [] }; rows.push(row); }
      add(it, row);
      return;
    }
    const row = { type: 'line', cells: [] };
    rows.push(row);
    const ti = textItem(t);
    ti.brk = pendingBreak; pendingBreak = false;
    add(ti, row);
  });

  // 번호 모양으로 깊이와 소제목 여부 정하기 (큰 제목·화면 넘김마다 새로 계산)
  const lines = items.filter(function (it) { return it.k === 'text' && !it.cell; });
  let sec = [], lastLv = 0;
  function closeSec() {
    const lvs = sec.filter(function (it) { return it.sub === 'lv'; });
    const min = lvs.reduce(function (a, it) { return Math.min(a, it.lv); }, 9);
    let depth = 0;
    sec.forEach(function (it) {
      if (it.sub === 'lv') {
        depth = it.lv - min;
        it.depth = depth;
        const nx = lvs[lvs.indexOf(it) + 1];
        it.head = !!(nx && nx.lv > it.lv);
      } else it.depth = lvs.length ? depth + 1 : 0;
    });
    sec = []; lastLv = 0;
  }
  lines.forEach(function (it) {
    if (it.sub === 'big') { closeSec(); it.depth = 0; return; }
    if (it.brk) closeSec(); // 화면 넘김 뒤는 들여쓰기를 새로 계산
    if (it.sub === 'lv') { if (it.lv) lastLv = it.lv; else it.lv = Math.min(4, lastLv + 1); }
    sec.push(it);
  });
  closeSec();
  // 자료 줄은 바로 앞 글 줄보다 한 칸 들여쓰기
  let d = 0;
  rows.forEach(function (r) {
    if (r.type === 'line') { const it = items[r.cells[0]]; d = it.sub === 'big' ? 0 : (it.depth || 0) + 1; }
    else if (r.type === 'media') r.depth = d;
  });
  return { rows: rows, items: items, missing: missing, blanks: nBlank };
}

export function unmatched(lesson) { return parse(lesson).missing; }
export function blankCount(lesson) { return parse(lesson).blanks; }
export function itemCount(lesson) { return parse(lesson).items.length; }

// 판서 중간에 쓰인 영상 id
export function boardVideoIds(lesson) {
  return parse(lesson).items.filter(function (x) { return x.k === 'video'; }).map(function (x) { return x.v.id; });
}

// 누르는 단계: 빈칸을 켜면 핵심어가 있는 줄은 두 번(빈칸 → 채움)
function steps(items, blankOn) {
  const out = [];
  items.forEach(function (it, i) {
    if (blankOn && it.k === 'text' && it.blanks) out.push({ it: i, fill: false });
    out.push({ it: i, fill: true });
  });
  return out;
}
export function stepCount(lesson, blankOn) { return steps(parse(lesson).items, blankOn).length; }

// 빈칸을 켜고 끌 때, 지금까지 보여 준 줄을 그대로 유지하는 새 위치
export function convertPos(lesson, n, fromBlank, toBlank) {
  const items = parse(lesson).items;
  const a = steps(items, fromBlank);
  const shown = n > 0 ? a[n - 1].it + 1 : 0;
  const b = steps(items, toBlank);
  let k = 0;
  while (k < b.length && b[k].it < shown) k++;
  return k;
}

// *글자* → 핵심어. hid(j)가 참이면 빈칸으로 가림
export function rich(t, hid) {
  let j = 0;
  return esc(t).replace(/\*([^*]+)\*/g, function (_, w) {
    const h = hid ? hid(j) : false;
    j++;
    return '<span class="bl' + (h ? ' hid' : '') + '">' + w + '</span>';
  });
}

// 영상 카드 (판서·인트로·마무리 영상에서 함께 씀)
export function videoCard(v, cls) {
  const label = esc(v.title) + (v.duration ? ' <em class="dur-t">' + esc(v.duration) + '</em>' : '');
  const badge = v.duration ? '<b class="dur-b">⏱ ' + esc(v.duration) + '</b>' : '';
  if (v.videoId) {
    return '<button class="' + cls + '" data-act="play" data-id="' + esc(v.videoId) + '" data-title="' + esc(v.title) + '">' +
      '<div class="mthumb"><img src="https://img.youtube.com/vi/' + esc(v.videoId) + '/mqdefault.jpg" alt=""><i>▶</i>' + badge + '</div>' +
      '<span>' + label + '</span></button>';
  }
  return '<a class="' + cls + '" href="' + esc(safeUrl(v.url)) + '" target="_blank" rel="noopener">' +
    '<div class="mthumb ebs"><b>지식채널e</b><i>↗</i>' + badge + '</div><span>' + label + '</span></a>';
}

// 화면에 나온 사진을 작은 그림에서 큰 그림으로 바꿔 줌
export function upgradePhotos(el) {
  el.querySelectorAll('img[data-pid]').forEach(function (img) {
    const id = img.getAttribute('data-pid');
    if (store.cachedPhoto(id)) { img.src = store.cachedPhoto(id); return; }
    store.getPhoto(id).then(function (full) {
      if (full && img.isConnected) img.src = full;
    }).catch(function (e) { console.warn('큰 사진 불러오기 실패', e); });
  });
}

// ── 그리기
// st(i) → { show, hid(j) }  : i번째 item을 보여 줄지, j번째 핵심어를 가릴지
function itemInner(it, st) {
  if (it.k === 'photo') {
    if (it.cell) {
      return '<button class="mcard cellph" data-act="view-photo" data-i="' + it.i + '">' +
        '<img' + (st.show ? ' data-pid="' + esc(it.p.id) + '"' : '') + ' src="' + esc(store.cachedPhoto(it.p.id) || it.p.thumb || '') + '" alt="">' +
        '<span>' + esc(it.p.caption || '') + '</span></button>';
    }
    return '<button class="mcard small" data-act="view-photo" data-i="' + it.i + '">' +
      '<div class="mthumb ph"><img src="' + esc(it.p.thumb || '') + '" alt=""></div><span>' + esc(it.p.caption || '') + '</span></button>';
  }
  if (it.k === 'video') return videoCard(it.v, 'mcard small');
  if (it.k === 'link') {
    return '<a class="mcard text" href="' + esc(safeUrl(it.l.url)) + '" target="_blank" rel="noopener">' +
      '<span>기사 · ' + esc(it.l.title || it.l.url) + ' ↗</span></a>';
  }
  const pg = it.pg ? '<span class="pg">' + esc(it.pg) + '쪽</span>' : '';
  if (it.sub === 'big') return (it.label ? '<i>' + esc(it.label) + '</i>' : '') + '<span>' + rich(it.t, st.hid) + '</span>' + pg;
  return rich(it.t, st.hid) + pg;
}
function textCls(it) {
  if (it.sub === 'big') return 'big';
  if (it.sub === 'note') return 'note';
  if (it.sub === 'sub') return 's';
  if (it.sub === 'cell') return 'c';
  return it.head ? (it.depth === 0 ? 'h' : 'hh') : 'i';
}
function cellHtml(items, i, stOf, extra) {
  const it = items[i], st = stOf(i);
  const cls = it.k === 'text' ? textCls(it) : 'm';
  return '<div class="ln ' + cls + (it.cell && it.k !== 'text' ? ' c' : '') + (st.show ? ' show' : '') + (st.isNew ? ' new' : '') + (extra || '') +
    '" style="--d:' + (it.depth || 0) + '">' + itemInner(it, st) + '</div>';
}
function rowHtml(model, r, stOf, extra) {
  const row = model.rows[r], items = model.items;
  if (row.type === 'line') return '<div class="lw">' + cellHtml(items, row.cells[0], stOf, extra) + '</div>';
  if (row.type === 'media') {
    return '<div class="lw"><div class="mrow" style="--d:' + (row.depth || 0) + '">' +
      row.cells.map(function (i) { return cellHtml(items, i, stOf); }).join('') + '</div></div>';
  }
  return '<div class="lw"><div class="cmp' + (row.head ? ' head' : '') + '" style="grid-template-columns:repeat(' + row.cols + ',1fr)">' +
    row.slots.map(function (i) { return i === -1 ? '<div></div>' : cellHtml(items, i, stOf); }).join('') + '</div></div>';
}

function isHeadRow(model, r) {
  const row = model.rows[r];
  if (!row || row.type !== 'line') return false;
  const it = model.items[row.cells[0]];
  return it.sub === 'big' || (it.sub === 'lv' && it.head);
}
function isTopHead(model, r) {
  if (!isHeadRow(model, r)) return false;
  const it = model.items[model.rows[r].cells[0]];
  return it.sub === 'big' || it.depth === 0;
}

// 화면 높이에 맞춰 여러 쪽으로 나눔
//   큰 제목과 '---' 에서는 반드시 넘기고, 이어지는 쪽에는 앞의 소제목을 흐리게 다시 보여 줌
function paginate(el, model) {
  const idx = [];   // 화면에 그리는 줄 번호들
  model.rows.forEach(function (r, i) { if (r.type !== 'break') idx.push(i); });
  const all = function () { return { show: true, hid: null }; };
  el.innerHTML = '<div class="board measure">' + idx.map(function (r) { return rowHtml(model, r, all); }).join('') + '</div>';
  const box = el.firstChild;
  const cs = getComputedStyle(el);
  const H = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 12;
  const ws = box.querySelectorAll('.lw');
  const top = function (node) { return node.getBoundingClientRect().top; };
  const end = box.getBoundingClientRect().bottom;
  const h = {};
  idx.forEach(function (r, k) { h[r] = (k + 1 < idx.length ? top(ws[k + 1]) : end) - top(ws[k]); });
  const forced = function (k) {
    const r = idx[k];
    const it = model.rows[r].type === 'line' ? model.items[model.rows[r].cells[0]] : null;
    return (it && it.sub === 'big') || (r > 0 && model.rows[r - 1].type === 'break');
  };
  const headBefore = function (k) { for (let j = k - 1; j >= 0; j--) if (isTopHead(model, idx[j])) return idx[j]; return -1; };

  const pages = [];
  let k = 0;
  while (k < idx.length) {
    const start = k;
    const head = (pages.length && !isTopHead(model, idx[k])) ? headBefore(k) : -1;
    const avail = H - (head !== -1 ? h[head] : 0);
    let used = 0;
    while (k < idx.length && (k === start || (!forced(k) && used + h[idx[k]] <= avail))) { used += h[idx[k]]; k++; }
    // 소제목만 쪽 끝에 홀로 남지 않게 다음 쪽으로 넘김
    while (k < idx.length && k - start > 1 && isHeadRow(model, idx[k - 1]) && !forced(k)) k--;
    pages.push({ rows: idx.slice(start, k), head: head });
  }
  return pages.length ? pages : [{ rows: [], head: -1 }];
}

// 판서 한 화면 그리기. n = 지금까지 누른 횟수
// 반환값: { page: 지금 쪽(1부터), pages: 전체 쪽 수 }
export function renderBoard(el, lesson, n, blankOn) {
  const model = parse(lesson);
  const sts = steps(model.items, blankOn);
  const phase = {};   // item → 1(빈칸 상태로 보임) / 2(채워짐)
  for (let i = 0; i < n && i < sts.length; i++) phase[sts[i].it] = sts[i].fill ? 2 : 1;
  const lastIt = n > 0 && sts.length ? sts[Math.min(n, sts.length) - 1].it : -1;
  const pages = paginate(el, model);
  let k = 0;
  if (lastIt !== -1) {
    const r = model.items[lastIt].row;
    k = pages.findIndex(function (p) { return p.rows.indexOf(r) !== -1; });
    if (k === -1) k = 0;
  }
  const pg = pages[k];
  const stOf = function (i) {
    const ph = phase[i] || 0;
    return { show: ph > 0, isNew: i === lastIt, hid: function () { return ph === 1; } };
  };
  let html = '<div class="board">';
  if (n === 0) html += '<div class="hint first">화면을 누르면 한 줄씩 나타납니다.</div>';
  if (pg.head !== -1) html += rowHtml(model, pg.head, function () { return { show: true, hid: null }; }, ' rep');
  pg.rows.forEach(function (r) { html += rowHtml(model, r, stOf); });
  el.innerHTML = html + '</div>';
  upgradePhotos(el);
  el.scrollTop = 0;
  return { page: k + 1, pages: pages.length };
}

// 빈칸 복습: 판서 전체를 빈칸 상태로 띄우고 누를 때마다 하나씩 채움
export function renderReview(el, lesson, n) {
  const model = parse(lesson);
  const stOf = function (i) {
    const it = model.items[i];
    return { show: true, hid: function (j) { return it.b0 + j >= n; } };
  };
  let html = '<div class="board review"><div class="rv-title">빈칸 복습 <small>화면을 누르면 하나씩 채워집니다</small></div>';
  model.rows.forEach(function (row, r) {
    if (row.type === 'line' || row.type === 'cmp') {
      if (row.type === 'cmp' && !row.cells.some(function (i) { return model.items[i].k === 'text'; })) return;
      html += rowHtml(model, r, stOf);
    }
  });
  el.innerHTML = html + '</div>';
  el.querySelectorAll('.cmp .ln.m').forEach(function (m) { m.innerHTML = ''; });
  const hidden = el.querySelectorAll('.bl.hid');
  const shown = el.querySelectorAll('.bl:not(.hid)');
  const target = hidden[0] || shown[shown.length - 1];
  if (shown.length) shown[shown.length - 1].classList.add('just');
  if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center' });
}

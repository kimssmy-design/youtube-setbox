// 판서: 글을 줄 단위로 나누고, 누를 때마다 한 줄씩 보여 줍니다.
// 판서 중간에 사진·영상·기사를 끼워 넣을 수 있습니다.
import { videosOf } from './state.js';
import * as store from './store.js';
import { esc, safeUrl } from './ui.js';

// 줄 종류
//   소제목(h): '#'으로 시작하거나 '(1)', '1.' 처럼 시작하는 줄
//   덧붙임(s): '-' 또는 '·'으로 시작하는 줄
//   자료     : '[사진] 사진 설명', '[영상] 영상 제목', '[기사] 기사 제목'
//   내용(i)  : 나머지
//   *글자*   : 빨간색 강조
const MEDIA = /^\[(사진|영상|기사)\]\s*(.+)$/;

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

// 판서 한 줄씩: 찾지 못한 자료 줄은 missing 으로 따로 모음
function parse(lesson) {
  const out = [], missing = [];
  const photos = lesson.photos || [];
  const links = lesson.links || [];
  const vids = videosOf(lesson.gi, lesson.mi, lesson.si);
  parseText(lesson.text).forEach(function (t) {
    const m = MEDIA.exec(t);
    if (m) {
      let idx;
      if (m[1] === '사진') {
        idx = findIndex(photos, m[2], function (p) { return p.caption; });
        if (idx !== -1) { out.push({ k: 'photo', i: idx, p: photos[idx] }); return; }
      } else if (m[1] === '영상') {
        idx = findIndex(vids, m[2], function (v) { return v.title; });
        if (idx !== -1) { out.push({ k: 'video', v: vids[idx] }); return; }
      } else {
        idx = findIndex(links, m[2], function (l) { return l.title || l.url; });
        if (idx !== -1) { out.push({ k: 'link', l: links[idx] }); return; }
      }
      missing.push(t);
      return;
    }
    if (t.charAt(0) === '#') out.push({ k: 'h', t: t.replace(/^#+\s*/, '') });
    else if (/^\(\d+\)/.test(t) || /^\d+\.\s/.test(t)) out.push({ k: 'h', t: t });
    else if (/^[-·•]\s*/.test(t)) out.push({ k: 's', t: '· ' + t.replace(/^[-·•]\s*/, '') });
    else out.push({ k: 'i', t: t });
  });
  return { lines: out, missing: missing };
}

export function parseBoard(lesson) { return parse(lesson).lines; }
export function unmatched(lesson) { return parse(lesson).missing; }
export function lineCount(lesson) { return parseBoard(lesson).length; }

// 판서 중간에 쓰인 영상 id
export function boardVideoIds(lesson) {
  return parseBoard(lesson).filter(function (x) { return x.k === 'video'; }).map(function (x) { return x.v.id; });
}

// *글자* → 빨간 강조
export function rich(t) {
  return esc(t).replace(/\*([^*]+)\*/g, '<span class="red">$1</span>');
}

function stepHtml(x) {
  if (x.k === 'photo') {
    const src = store.cachedPhoto(x.p.id) || x.p.thumb || '';
    return '<button class="mcard" data-act="view-photo" data-i="' + x.i + '">' +
      '<img data-pid="' + esc(x.p.id) + '" src="' + esc(src) + '" alt="">' +
      '<span>' + esc(x.p.caption || '') + '</span></button>';
  }
  if (x.k === 'video') return videoCard(x.v, 'mcard');
  if (x.k === 'link') {
    return '<a class="mcard text" href="' + esc(safeUrl(x.l.url)) + '" target="_blank" rel="noopener">' +
      '<span>기사 · ' + esc(x.l.title || x.l.url) + ' ↗</span></a>';
  }
  return rich(x.t);
}

// 영상 카드 (판서 중간·화두·마무리 영상에서 함께 씀)
export function videoCard(v, cls) {
  const label = esc(v.title) + (v.duration ? ' <small>' + esc(v.duration) + '</small>' : '');
  if (v.videoId) {
    return '<button class="' + cls + '" data-act="play" data-id="' + esc(v.videoId) + '" data-title="' + esc(v.title) + '">' +
      '<div class="mthumb"><img src="https://img.youtube.com/vi/' + esc(v.videoId) + '/mqdefault.jpg" alt=""><i>▶</i></div>' +
      '<span>' + label + '</span></button>';
  }
  return '<a class="' + cls + '" href="' + esc(safeUrl(v.url)) + '" target="_blank" rel="noopener">' +
    '<div class="mthumb ebs"><b>지식채널e</b><i>↗</i></div><span>' + label + '</span></a>';
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

function lineHtml(x, cls) {
  const media = (x.k === 'photo' || x.k === 'video' || x.k === 'link') ? ' m' : '';
  return '<div class="lw"><div class="ln ' + x.k + media + cls + '">' + stepHtml(x) + '</div></div>';
}
function titleHtml(lesson) {
  return '<div class="b-title">' + (lesson.no ? '<span>' + esc(lesson.no) + '</span>' : '') + esc(lesson.title) + '</div>';
}

// 화면 높이에 맞춰 판서를 여러 쪽으로 나눕니다.
//   첫 쪽에만 차시 제목, 둘째 쪽부터는 이어지는 소제목을 흐리게 다시 보여 줍니다.
function paginate(el, lesson, lines) {
  el.innerHTML = '<div class="board measure">' + titleHtml(lesson) +
    lines.map(function (x) { return lineHtml(x, ' show'); }).join('') + '</div>';
  const box = el.firstChild;
  const cs = getComputedStyle(el);
  const H = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 12;
  const ws = box.querySelectorAll('.lw');
  const top = function (node) { return node.getBoundingClientRect().top; };
  const end = box.getBoundingClientRect().bottom;
  const h = Array.prototype.map.call(ws, function (w, i) {
    return (i + 1 < ws.length ? top(ws[i + 1]) : end) - top(w);
  });
  const titleH = ws.length ? top(ws[0]) - top(box.firstChild) : 0;
  const headOf = function (i) { for (let k = i; k >= 0; k--) if (lines[k].k === 'h') return k; return -1; };

  const pages = [];
  let i = 0;
  while (i < lines.length) {
    const first = !pages.length;
    const start = i;
    const head = (!first && lines[i].k !== 'h') ? headOf(i - 1) : -1;
    const avail = H - (first ? titleH : 0) - (head !== -1 ? h[head] : 0);
    let used = 0;
    while (i < lines.length && (i === start || used + h[i] <= avail)) { used += h[i]; i++; }
    // 소제목만 쪽 끝에 홀로 남지 않게 다음 쪽으로 넘김
    if (i < lines.length && i - start > 1 && lines[i - 1].k === 'h') i--;
    pages.push({ start: start, end: i, head: head });
  }
  return pages.length ? pages : [{ start: 0, end: 0, head: -1 }];
}

// 반환값: { page: 지금 쪽(1부터), pages: 전체 쪽 수 }
export function renderBoard(el, lesson, shown) {
  const lines = parseBoard(lesson);
  const pages = paginate(el, lesson, lines);
  let k = 0;
  if (shown > 0) while (k < pages.length - 1 && shown - 1 >= pages[k].end) k++;
  const pg = pages[k];
  let html = '<div class="board">' + (k === 0 ? titleHtml(lesson) : '');
  if (shown === 0) html += '<div class="hint first">화면을 누르면 한 줄씩 나타납니다.</div>';
  if (pg.head !== -1) html += lineHtml(lines[pg.head], ' show rep');
  for (let i = pg.start; i < pg.end; i++) {
    html += lineHtml(lines[i], (i < shown ? ' show' : '') + (i === shown - 1 ? ' new' : ''));
  }
  el.innerHTML = html + '</div>';
  el.querySelectorAll('.ln:not(.show) img[data-pid]').forEach(function (img) { img.removeAttribute('data-pid'); });
  upgradePhotos(el);
  el.scrollTop = 0;
  return { page: k + 1, pages: pages.length };
}

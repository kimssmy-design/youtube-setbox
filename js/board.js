// 판서: 글을 줄 단위로 나누고, 누를 때마다 한 단계씩 보여 줍니다.
// 판서 중간에 사진·영상·기사를 끼워 넣을 수 있습니다.
import { state, videosOf, lessonsOf } from './state.js';
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

// 빈 줄을 뺀 줄 목록 (여러 차시 한 번에 넣기의 줄 수 세기에 사용)
export function parseText(text) {
  return String(text || '').split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
}

export function parseBoard(lesson) {
  const out = [];
  const photos = lesson.photos || [];
  const links = lesson.links || [];
  const vids = videosOf(lesson.gi, lesson.mi, lesson.si);
  String(lesson.text || '').split('\n').forEach(function (raw) {
    const t = raw.trim();
    if (!t) return;
    const m = MEDIA.exec(t);
    if (m) {
      let idx = -1;
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
      // 찾지 못한 자료는 편집 중에만 알려 주고, 수업 화면에서는 건너뜀
      if (state.edit) out.push({ k: 'miss', t: m[1] + ' 자료를 찾을 수 없어요: ' + m[2] });
      return;
    }
    if (t.charAt(0) === '#') out.push({ k: 'h', t: t.replace(/^#+\s*/, '') });
    else if (/^\(\d+\)/.test(t) || /^\d+\.\s/.test(t)) out.push({ k: 'h', t: t });
    else if (/^[-·•]\s*/.test(t)) out.push({ k: 's', t: '· ' + t.replace(/^[-·•]\s*/, '') });
    else out.push({ k: 'i', t: t });
  });
  return out;
}

// *글자* → 빨간 강조
function rich(t) {
  return esc(t).replace(/\*([^*]+)\*/g, '<span class="red">$1</span>');
}

export function lineCount(lesson) { return parseBoard(lesson).length; }
export function shownOf(lesson) { return Math.min(state.shown[lesson.id] || 0, lineCount(lesson)); }
export function step(lesson, n) {
  state.shown[lesson.id] = Math.max(0, Math.min(lineCount(lesson), shownOf(lesson) + n));
}
export function showAll(lesson) { state.shown[lesson.id] = lineCount(lesson); }
export function reset(lesson) { state.shown[lesson.id] = 0; }

// 같은 단원의 다음 차시
export function nextLesson(lesson) {
  const list = lessonsOf(lesson.gi, lesson.mi, lesson.si);
  const i = list.findIndex(function (l) { return l.id === lesson.id; });
  return (i !== -1 && i + 1 < list.length) ? list[i + 1] : null;
}

function stepHtml(x) {
  if (x.k === 'photo') {
    const src = store.cachedPhoto(x.p.id) || x.p.thumb || '';
    return '<button class="mcard" data-act="view-photo" data-i="' + x.i + '">' +
      '<img data-pid="' + esc(x.p.id) + '" src="' + esc(src) + '" alt="">' +
      '<span>' + esc(x.p.caption || '') + '</span></button>';
  }
  if (x.k === 'video') {
    const v = x.v;
    const label = '영상 · ' + esc(v.title) + (v.duration ? ' (' + esc(v.duration) + ')' : '');
    if (v.videoId) {
      return '<button class="mcard" data-act="play" data-id="' + esc(v.videoId) + '" data-title="' + esc(v.title) + '">' +
        '<div class="mthumb"><img src="https://img.youtube.com/vi/' + esc(v.videoId) + '/mqdefault.jpg" alt=""><i>▶</i></div>' +
        '<span>' + label + '</span></button>';
    }
    return '<a class="mcard text" href="' + esc(safeUrl(v.url)) + '" target="_blank" rel="noopener"><span>' + label + ' ↗</span></a>';
  }
  if (x.k === 'link') {
    return '<a class="mcard text" href="' + esc(safeUrl(x.l.url)) + '" target="_blank" rel="noopener">' +
      '<span>기사 · ' + esc(x.l.title || x.l.url) + ' ↗</span></a>';
  }
  return rich(x.t);
}

export function renderBoard(el, lesson) {
  const lines = parseBoard(lesson);
  const shown = shownOf(lesson);
  let html = '<div class="board" id="board"><div class="b-head"><div><div class="b-title">' +
    (lesson.no ? '<span>' + esc(lesson.no) + '</span>' : '') + esc(lesson.title) + '</div>' +
    (lesson.page ? '<div class="b-page">교과서 ' + esc(lesson.page) + '쪽</div>' : '') + '</div>' +
    (state.edit ? '<button class="mini b-edit" data-act="edit-lesson">판서 고치기</button>' : '') +
    '</div>';
  if (!lines.length) {
    html += '<div class="hint">' + (state.edit
      ? '아직 판서 내용이 없어요. 오른쪽 위 "판서 고치기"를 눌러 넣어 주세요.'
      : '아직 판서 내용이 없어요.') + '</div>';
  }
  if (lines.length && shown === 0) {
    html += '<div class="hint first">화면 아무 곳이나 누르면 한 줄씩 나타납니다.</div>';
  }
  lines.forEach(function (x, i) {
    const media = (x.k === 'photo' || x.k === 'video' || x.k === 'link') ? ' m' : '';
    const cls = 'ln ' + x.k + media + (i < shown ? ' show' : '') + (i === shown - 1 ? ' new' : '');
    html += '<div><div class="' + cls + '">' + stepHtml(x) + '</div></div>';
  });
  const next = nextLesson(lesson);
  if (next && shown === lines.length) {
    html += '<button class="btn next-lesson" data-act="next-lesson">다음 차시: ' +
      esc((next.no ? next.no + ' ' : '') + next.title) + ' ▶</button>';
  }
  html += '</div>';
  el.innerHTML = html;

  // 화면에 나온 사진은 작은 그림에서 큰 그림으로 바꿔 줌
  el.querySelectorAll('.ln.show img[data-pid]').forEach(function (img) {
    const id = img.getAttribute('data-pid');
    if (store.cachedPhoto(id)) return;
    store.getPhoto(id).then(function (full) {
      if (full && img.isConnected) img.src = full;
    }).catch(function (e) { console.warn('큰 사진 불러오기 실패', e); });
  });

  const last = el.querySelector('.ln.new') || el.querySelector('.next-lesson');
  const tail = el.querySelector('.next-lesson') || last;
  if (tail && tail.scrollIntoView) tail.scrollIntoView({ block: 'nearest' });
}

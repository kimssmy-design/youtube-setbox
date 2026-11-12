// 수업 화면: 표지 → ① 인트로 → ② 판서 → ③ 복습 → ④ 영상 을 "다음" 하나로 차례로 진행합니다.
// 위쪽 단계 이름을 누르면 그때그때 원하는 단계로 건너뛸 수 있습니다.
import { state, lessonById, videosOf, minorName, nextLesson } from './state.js';
import * as board from './board.js';
import { esc, safeUrl } from './ui.js';

// 위쪽에 보이는 단계
export const SECS = [
  { k: 'topic', n: '인트로' },
  { k: 'board', n: '판서' },
  { k: 'review', n: '복습' },
  { k: 'video', n: '영상' }
];
const NUM = ['①', '②', '③', '④'];
const ORDER = ['cover', 'topic', 'board', 'review', 'video'];
function order(k) { return ORDER.indexOf(k); }

// ── 차시 내용 읽기
export function topicOf(l) {
  const t = (l && l.topic) || {};
  return {
    q: t.q || '', memo: t.memo || '', goals: t.goals || '', page: t.page || '',
    photos: t.photos || [], links: t.links || [], videoIds: t.videoIds || []
  };
}
function goalLines(t) { return String(t.goals || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
function videoById(id) { return state.videos.find(function (v) { return v.id === id; }) || null; }
export function topicVideos(l) {
  return topicOf(l).videoIds.map(videoById).filter(Boolean);
}

// 마무리 영상
//   준비 화면에서 뺀 영상(endHideIds)만 빼고 이 단원 영상을 모두 보여 줌
//   → 나중에 영상 모음에 추가한 영상도 자동으로 나옴
//   준비한 적이 없으면 인트로·판서에 쓰지 않은 이 단원 영상 전부
export function endVideos(l) {
  const unit = videosOf(l.gi, l.mi, l.si);
  if (l.virtual) return unit;
  if (Array.isArray(l.endHideIds)) {
    return unit.filter(function (v) { return l.endHideIds.indexOf(v.id) === -1; });
  }
  if (Array.isArray(l.endVideoIds) && l.endVideoIds.length) { // 예전 버전에서 저장한 차시
    return unit.filter(function (v) { return l.endVideoIds.indexOf(v.id) !== -1; });
  }
  const used = board.boardVideoIds(l).concat(topicOf(l).videoIds);
  return unit.filter(function (v) { return used.indexOf(v.id) === -1; });
}

export function hasSec(l, k) {
  if (l.virtual) return k === 'video';
  if (k === 'cover') return true;
  if (k === 'topic') { const t = topicOf(l); return !!(t.q || t.memo || t.goals || t.photos.length || t.links.length || t.videoIds.length); }
  if (k === 'board') return board.itemCount(l) > 0;
  if (k === 'review') return board.blankCount(l) > 0;
  return endVideos(l).length > 0;
}
export function avail(l) {
  return ORDER.filter(function (k) { return hasSec(l, k); });
}

// ── 진행 위치
// 인트로: 질문은 처음부터 보이고, 예시 → 학습목표 → 둘째 사진부터 차례로
function topicText(l) { const t = topicOf(l); return (t.memo ? 1 : 0) + (t.goals ? 1 : 0); }
function maxIdx(l, k) {
  if (k === 'topic') return topicText(l) + Math.max(0, topicOf(l).photos.length - 1);
  if (k === 'board') return board.stepCount(l, state.blank);
  if (k === 'review') return board.blankCount(l);
  return 0;
}
function getIdx(p, k) { return k === 'topic' || k === 'board' || k === 'review' ? p[k] : 0; }
function setIdx(p, k, v) { if (k === 'topic' || k === 'board' || k === 'review') p[k] = v; }

function pos(l) {
  let p = state.pos[l.id];
  if (!p) { const a = avail(l); p = state.pos[l.id] = { sec: a[0] || 'board', topic: 0, board: 0, review: 0 }; }
  // 내용을 고친 뒤에도 범위를 벗어나지 않게
  ['topic', 'board', 'review'].forEach(function (k) { p[k] = Math.min(p[k] || 0, maxIdx(l, k)); });
  const a = avail(l);
  // 영상 단계는 내용이 없어도 눌러서 들어갈 수 있으므로 그대로 둠
  if (a.length && a.indexOf(p.sec) === -1 && p.sec !== 'video') p.sec = a[0];
  return p;
}
export function resetPos(id) { delete state.pos[id]; }

export function next(l) {
  const a = avail(l), p = pos(l);
  if (!a.length) return false;
  const i = getIdx(p, p.sec);
  if (i < maxIdx(l, p.sec)) { setIdx(p, p.sec, i + 1); return true; }
  const after = a.filter(function (k) { return order(k) > order(p.sec); });
  if (after.length) {
    p.sec = after[0];
    if (p.sec === 'topic') p.topic = 0;
    if (p.sec === 'review') p.review = 0;
    return true;
  }
  return false;
}
export function prev(l) {
  const a = avail(l), p = pos(l);
  if (!a.length) return false;
  const i = getIdx(p, p.sec);
  if (i > 0) { setIdx(p, p.sec, i - 1); return true; }
  const before = a.filter(function (k) { return order(k) < order(p.sec); });
  if (before.length) { p.sec = before[before.length - 1]; setIdx(p, p.sec, maxIdx(l, p.sec)); return true; }
  return false;
}
export function jump(l, k) {
  if (!hasSec(l, k) && !(k === 'video' && !l.virtual)) return false;
  const p = pos(l);
  p.sec = k;
  if (k === 'review') p.review = 0;
  return true;
}
export function atEnd(l) {
  const a = avail(l), p = pos(l);
  const later = a.filter(function (k) { return order(k) > order(p.sec); });
  return !later.length && (a.indexOf(p.sec) === -1 || getIdx(p, p.sec) >= maxIdx(l, p.sec));
}

// 빈칸 켜고 끄기: 지금까지 보여 준 줄은 그대로 유지
export function toggleBlank(l) {
  const was = !!state.blank;
  if (l && !l.virtual) { const p = pos(l); p.board = board.convertPos(l, p.board, was, !was); }
  state.blank = !was;
  try { localStorage.setItem('lessonBlank', state.blank ? '1' : '0'); } catch (e) { /* 무시 */ }
}

// 지금 수업 중인 차시 (단원 영상만 볼 때는 가상의 차시)
export function runLesson() {
  const id = state.runId || '';
  if (id.indexOf('unit:') === 0) {
    const n = id.split(':');
    const gi = +n[1], mi = +n[2], si = +n[3];
    return { id: id, virtual: true, gi: gi, mi: mi, si: si, no: '', title: minorName(gi, mi, si) + ' 영상', text: '', photos: [], links: [] };
  }
  return lessonById(id);
}

// ── 그리기
function coverHtml(l) {
  return '<div class="cover"><div class="cv-unit">' + esc((state.grades[l.gi] || '') + ' · ' + minorName(l.gi, l.mi, l.si)) + '</div>' +
    '<div class="cv-title">' + (l.no ? '<span>' + esc(l.no) + '</span>' : '') + esc(l.title) + '</div>' +
    (l.page ? '<div class="cv-page">교과서 ' + esc(l.page) + '쪽</div>' : '') + '</div>';
}

function topicHtml(l, p) {
  const t = topicOf(l);
  const nText = topicText(l);
  const ph = t.photos[Math.max(0, p.topic - nText)];
  const showMemo = p.topic >= 1;
  const showGoal = p.topic >= (t.memo ? 2 : 1);
  let side = '<div class="t-label">인트로' + (t.page ? '<span class="pg">' + esc(t.page) + '쪽</span>' : '') + '</div>';
  if (t.q) side += '<div class="t-q">' + board.rich(t.q) + '</div>';
  if (t.memo) side += '<div class="t-memo' + (showMemo ? '' : ' hidn') + '">' + esc(t.memo).replace(/\n/g, '<br>') + '</div>';
  if (t.goals) {
    side += '<div class="t-goal' + (showGoal ? '' : ' hidn') + '"><b>학습목표</b>' +
      goalLines(t).map(function (g, i, arr) { return '<div>' + (arr.length > 1 && !/^\d/.test(g) ? (i + 1) + '. ' : '') + esc(g) + '</div>'; }).join('') + '</div>';
  }
  if (t.photos.length > 1) side += '<div class="t-count">사진 ' + (Math.max(0, p.topic - nText) + 1) + ' / ' + t.photos.length + '</div>';
  const items = t.links.map(function (x) {
    return '<a class="mcard text" href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener"><span>기사 · ' + esc(x.title || x.url) + ' ↗</span></a>';
  }).concat(topicVideos(l).map(function (v) { return board.videoCard(v, 'mcard small'); }));
  if (items.length) side += '<div class="t-items">' + items.join('') + '</div>';
  return '<div class="topic' + (ph ? '' : ' nophoto') + '">' +
    (ph ? '<button class="t-photo" data-act="zoom-topic" data-i="' + t.photos.indexOf(ph) + '"><img data-pid="' + esc(ph.id) + '" src="' + esc(ph.thumb || '') + '" alt="">' +
      (ph.caption ? '<span>' + esc(ph.caption) + '</span>' : '') + '</button>' : '') +
    '<div class="t-side">' + side + '</div></div>';
}

// 영상 단계에 실제로 보여 줄 영상 (마무리로 고른 게 없으면 이 단원 영상 전부)
function shownVideos(l) {
  const vids = endVideos(l);
  return vids.length ? vids : videosOf(l.gi, l.mi, l.si);
}
function videoHtml(l) {
  const vids = shownVideos(l);
  const link = '<a class="mini" href="videos.html" target="_blank" rel="noopener">영상 모음 열기 ↗</a>';
  if (!vids.length) {
    return '<div class="empty"><div>이 단원에 등록된 영상이 없어요.</div><div class="btn-row">' + link +
      (l.virtual ? '' : '<button class="mini" data-act="prep">✎ 준비에서 유튜브 주소로 추가</button>') + '</div></div>';
  }
  const note = endVideos(l).length ? '' : '<span>마무리 영상으로 고른 것이 없어 이 단원 영상을 모두 보여 줘요</span>';
  return '<div class="v-top">' + note + link + '</div>' +
    '<div class="vgrid' + (vids.length === 1 ? ' one' : '') + '">' +
    vids.map(function (v) { return board.videoCard(v, 'vcard'); }).join('') + '</div>';
}

export function renderRun(l) {
  const $ = function (id) { return document.getElementById(id); };
  const stage = $('stage');
  $('runTitle').innerHTML = (l.no ? '<span>' + esc(l.no) + '</span>' : '') + esc(l.title);
  $('runPrep').style.display = l.virtual ? 'none' : '';
  const bb = $('blankBtn');
  bb.style.display = l.virtual ? 'none' : '';
  bb.textContent = state.blank ? '빈칸 켬' : '빈칸 끔';
  bb.classList.toggle('on', !!state.blank);

  const a = avail(l);
  const p = pos(l);
  const showing = a.length || p.sec === 'video';
  $('runSteps').innerHTML = l.virtual ? '' : SECS.map(function (s, i) {
    const has = a.indexOf(s.k) !== -1;
    const open = has || s.k === 'video'; // 영상은 늘 누를 수 있음
    const cls = 'st' + (s.k === p.sec && showing ? ' on' : '') + (has && order(s.k) < order(p.sec) ? ' done' : '') + (open && !has ? ' thin' : '');
    return '<button class="' + cls + '" data-sec="' + s.k + '"' + (open ? '' : ' disabled title="준비한 내용이 없어요"') + '>' +
      NUM[i] + ' ' + s.n + '</button>';
  }).join('');

  stage.className = 'stage sec-' + (showing ? p.sec : 'none');
  if (!showing) {
    stage.innerHTML = videoHtml(l);
  } else if (p.sec === 'cover') {
    stage.innerHTML = coverHtml(l);
  } else if (p.sec === 'topic') {
    stage.innerHTML = topicHtml(l, p);
    board.upgradePhotos(stage);
  } else if (p.sec === 'board') {
    state.boardPage = board.renderBoard(stage, l, p.board, !!state.blank);
  } else if (p.sec === 'review') {
    board.renderReview(stage, l, p.review);
  } else {
    stage.innerHTML = videoHtml(l);
  }
  if (p.sec !== 'board' && p.sec !== 'review') stage.scrollTop = 0;

  // 아래 막대
  const end = atEnd(l);
  const nl = nextLesson(l);
  const nb = $('nextBtn');
  nb.textContent = end ? (nl ? '다음 차시 ▶' : '끝') : (p.sec === 'cover' ? '시작 ▶' : '다음 ▶');
  nb.disabled = end && !nl;
  nb.setAttribute('data-next-lesson', end && nl ? nl.id : '');
  const earlier = a.filter(function (k) { return order(k) < order(p.sec); });
  $('prevBtn').disabled = !earlier.length && getIdx(p, p.sec) === 0;
  let where = '';
  if (showing) {
    const sec = SECS.filter(function (s) { return s.k === p.sec; })[0];
    const name = sec ? sec.n : '표지';
    const m = maxIdx(l, p.sec);
    if (p.sec === 'board') {
      where = name + ' ' + p.board + ' / ' + m;
      if (state.boardPage && state.boardPage.pages > 1) where += ' · ' + state.boardPage.page + '쪽';
    }
    else if (p.sec === 'review') where = name + ' ' + p.review + ' / ' + m;
    else if (p.sec === 'topic' && m > 0) where = name + ' ' + (p.topic + 1) + ' / ' + (m + 1);
    else if (p.sec === 'video') where = name + ' ' + shownVideos(l).length + '개';
    else where = name;
  }
  $('where').textContent = where;
}

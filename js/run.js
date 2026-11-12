// 수업 화면: ① 화두 → ② 판서 → ③ 교과서 → ④ 영상 을 "다음" 하나로 차례로 진행합니다.
// 위쪽 단계 이름을 누르면 그때그때 원하는 단계로 건너뛸 수 있습니다.
import { state, lessonById, videosOf, minorName, nextLesson } from './state.js';
import * as board from './board.js';
import { esc, safeUrl } from './ui.js';

export const SECS = [
  { k: 'topic', n: '화두' },
  { k: 'board', n: '판서' },
  { k: 'book', n: '교과서' },
  { k: 'video', n: '영상' }
];
const NUM = ['①', '②', '③', '④'];

// ── 차시 내용 읽기
export function topicOf(l) {
  const t = (l && l.topic) || {};
  return { q: t.q || '', memo: t.memo || '', photos: t.photos || [], links: t.links || [], videoIds: t.videoIds || [] };
}
function videoById(id) { return state.videos.find(function (v) { return v.id === id; }) || null; }
export function topicVideos(l) {
  return topicOf(l).videoIds.map(videoById).filter(Boolean);
}

// 마무리 영상: 고른 적이 없으면 이 단원 영상 중 화두·판서에 쓰지 않은 것 전부
export function endVideos(l) {
  const unit = videosOf(l.gi, l.mi, l.si);
  if (l.virtual) return unit;
  if (Array.isArray(l.endVideoIds)) {
    return unit.filter(function (v) { return l.endVideoIds.indexOf(v.id) !== -1; });
  }
  const used = board.boardVideoIds(l).concat(topicOf(l).videoIds);
  return unit.filter(function (v) { return used.indexOf(v.id) === -1; });
}

export function hasSec(l, k) {
  if (l.virtual) return k === 'video';
  if (k === 'topic') { const t = topicOf(l); return !!(t.q || t.memo || t.photos.length || t.links.length || t.videoIds.length); }
  if (k === 'board') return board.lineCount(l) > 0;
  if (k === 'book') return !!String(l.page || '').trim();
  return endVideos(l).length > 0;
}
export function avail(l) {
  return SECS.filter(function (s) { return hasSec(l, s.k); }).map(function (s) { return s.k; });
}

// ── 진행 위치
function maxIdx(l, k) {
  if (k === 'topic') return Math.max(0, topicOf(l).photos.length - 1);
  if (k === 'board') return board.lineCount(l);
  return 0;
}
function getIdx(p, k) { return k === 'topic' ? p.topic : k === 'board' ? p.board : 0; }
function setIdx(p, k, v) { if (k === 'topic') p.topic = v; else if (k === 'board') p.board = v; }

function pos(l) {
  let p = state.pos[l.id];
  if (!p) { const a = avail(l); p = state.pos[l.id] = { sec: a[0] || 'board', topic: 0, board: 0 }; }
  // 내용을 고친 뒤에도 범위를 벗어나지 않게
  p.topic = Math.min(p.topic, maxIdx(l, 'topic'));
  p.board = Math.min(p.board, maxIdx(l, 'board'));
  const a = avail(l);
  if (a.length && a.indexOf(p.sec) === -1) p.sec = a[0];
  return p;
}
export function resetPos(id) { delete state.pos[id]; }

export function next(l) {
  const a = avail(l), p = pos(l);
  if (!a.length) return false;
  const i = getIdx(p, p.sec);
  if (i < maxIdx(l, p.sec)) { setIdx(p, p.sec, i + 1); return true; }
  const j = a.indexOf(p.sec);
  if (j < a.length - 1) { p.sec = a[j + 1]; if (p.sec === 'topic') p.topic = 0; return true; }
  return false;
}
export function prev(l) {
  const a = avail(l), p = pos(l);
  if (!a.length) return false;
  const i = getIdx(p, p.sec);
  if (i > 0) { setIdx(p, p.sec, i - 1); return true; }
  const j = a.indexOf(p.sec);
  if (j > 0) { p.sec = a[j - 1]; setIdx(p, p.sec, maxIdx(l, p.sec)); return true; }
  return false;
}
export function jump(l, k) {
  if (!hasSec(l, k)) return false;
  pos(l).sec = k;
  return true;
}
export function atEnd(l) {
  const a = avail(l), p = pos(l);
  return !a.length || (p.sec === a[a.length - 1] && getIdx(p, p.sec) >= maxIdx(l, p.sec));
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
function topicHtml(l, p) {
  const t = topicOf(l);
  const ph = t.photos[p.topic];
  let side = '<div class="t-label">오늘의 화두</div>';
  if (t.q) side += '<div class="t-q">' + board.rich(t.q) + '</div>';
  if (t.memo) side += '<div class="t-memo">' + esc(t.memo).replace(/\n/g, '<br>') + '</div>';
  if (t.photos.length > 1) side += '<div class="t-count">사진 ' + (p.topic + 1) + ' / ' + t.photos.length + '</div>';
  const items = t.links.map(function (x) {
    return '<a class="mcard text" href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener"><span>기사 · ' + esc(x.title || x.url) + ' ↗</span></a>';
  }).concat(topicVideos(l).map(function (v) { return board.videoCard(v, 'mcard small'); }));
  if (items.length) side += '<div class="t-items">' + items.join('') + '</div>';
  return '<div class="topic' + (ph ? '' : ' nophoto') + '">' +
    (ph ? '<button class="t-photo" data-act="zoom-topic" data-i="' + p.topic + '"><img data-pid="' + esc(ph.id) + '" src="' + esc(ph.thumb || '') + '" alt="">' +
      (ph.caption ? '<span>' + esc(ph.caption) + '</span>' : '') + '</button>' : '') +
    '<div class="t-side">' + side + '</div></div>';
}

function bookHtml(l) {
  return '<div class="book"><div class="bk-label">교과서를 펴세요</div>' +
    '<div class="bk-page">' + esc(l.page) + '<span>쪽</span></div>' +
    '<div class="bk-sub">' + (l.no ? esc(l.no) + ' ' : '') + esc(l.title) + '</div></div>';
}

function videoHtml(l) {
  const vids = endVideos(l);
  if (!vids.length) return '<div class="empty"><div>이 단원에 등록된 영상이 없어요.</div></div>';
  return '<div class="vgrid' + (vids.length === 1 ? ' one' : '') + '">' +
    vids.map(function (v) { return board.videoCard(v, 'vcard'); }).join('') + '</div>';
}

export function renderRun(l) {
  const $ = function (id) { return document.getElementById(id); };
  const stage = $('stage');
  $('runTitle').innerHTML = (l.no ? '<span>' + esc(l.no) + '</span>' : '') + esc(l.title);
  $('runPrep').style.display = l.virtual ? 'none' : '';

  const a = avail(l);
  const p = pos(l);
  const cur = a.indexOf(p.sec);
  $('runSteps').innerHTML = l.virtual ? '' : SECS.map(function (s, i) {
    const has = a.indexOf(s.k) !== -1;
    const cls = 'st' + (s.k === p.sec && has ? ' on' : '') + (has && a.indexOf(s.k) < cur ? ' done' : '');
    return '<button class="' + cls + '" data-sec="' + s.k + '"' + (has ? '' : ' disabled title="준비한 내용이 없어요"') + '>' +
      NUM[i] + ' ' + s.n + '</button>';
  }).join('');

  stage.className = 'stage sec-' + (a.length ? p.sec : 'none');
  if (!a.length) {
    stage.innerHTML = l.virtual ? videoHtml(l)
      : '<div class="empty"><div>아직 준비한 내용이 없어요.</div><button class="btn main" data-act="prep">준비하기</button></div>';
  } else if (p.sec === 'topic') {
    stage.innerHTML = topicHtml(l, p);
    board.upgradePhotos(stage);
  } else if (p.sec === 'board') {
    const bp = board.renderBoard(stage, l, p.board);
    state.boardPage = bp;
  } else if (p.sec === 'book') {
    stage.innerHTML = bookHtml(l);
  } else {
    stage.innerHTML = videoHtml(l);
  }
  if (p.sec !== 'board') stage.scrollTop = 0;

  // 아래 막대
  const end = atEnd(l);
  const nl = nextLesson(l);
  const nb = $('nextBtn');
  nb.textContent = end ? (nl ? '다음 차시 ▶' : '끝') : '다음 ▶';
  nb.disabled = end && !nl;
  nb.setAttribute('data-next-lesson', end && nl ? nl.id : '');
  $('prevBtn').disabled = !a.length || (cur <= 0 && getIdx(p, p.sec) === 0);
  let where = '';
  if (a.length) {
    const name = SECS.filter(function (s) { return s.k === p.sec; })[0].n;
    if (p.sec === 'board') {
      where = name + ' ' + p.board + ' / ' + maxIdx(l, 'board');
      if (state.boardPage && state.boardPage.pages > 1) where += ' · ' + state.boardPage.page + '쪽';
    }
    else if (p.sec === 'topic' && topicOf(l).photos.length > 1) where = name + ' ' + (p.topic + 1) + ' / ' + topicOf(l).photos.length;
    else if (p.sec === 'video') where = name + ' ' + endVideos(l).length + '개';
    else where = name;
  }
  $('where').textContent = where;
}

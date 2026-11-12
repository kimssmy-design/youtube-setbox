// 시작점: 암호 → 메인 화면 → 수업 화면(단원 목록, 탭, 조작 막대, 키보드)
import { state, onChange, changed, curLesson, lessonsOf, minorName } from './state.js';
import * as store from './store.js';
import * as board from './board.js';
import { renderFiles, initFiles, viewerNav } from './files.js';
import { renderVideos, initVideos } from './videos.js';
import { toggleEdit, restoreEdit, openLessonEditor } from './editor.js';
import { openBulk } from './bulk.js';
import { openTocEditor } from './toc.js';
import { renderHome, rememberLast } from './home.js';
import { passGate, lockNow } from './gate.js';
import { esc, openModal, closeModal, isModalOpen, isStickyModal } from './ui.js';

const $ = function (id) { return document.getElementById(id); };
const stage = $('stage');
const openMajors = {}; // 펼쳐 둔 대단원

// ── 기기에 기억해 두는 것(고른 학년·단원, 글씨 크기)
function remember() {
  try {
    localStorage.setItem('lessonSel', JSON.stringify(state.sel));
    localStorage.setItem('lessonFont', String(state.fontScale));
  } catch (e) { /* 저장소를 못 쓰는 환경 */ }
}
function recall() {
  try {
    const s = JSON.parse(localStorage.getItem('lessonSel') || 'null');
    if (s && typeof s.gi === 'number') state.sel = { gi: s.gi, mi: s.mi, si: s.si, lessonId: s.lessonId || null };
    const f = parseFloat(localStorage.getItem('lessonFont'));
    if (f >= 0.7 && f <= 1.8) state.fontScale = f;
  } catch (e) { /* 무시 */ }
}

function minorsOf(m) {
  return (m.minors && m.minors.length) ? m.minors : [null];
}

// 고른 단원이 지금 목차에 없으면 고르지 않은 상태로 되돌림
function fixSelection() {
  const s = state.sel;
  if (s.gi >= state.grades.length) { s.gi = 0; s.mi = null; }
  const m = s.mi == null ? null : (state.toc[s.gi] || [])[s.mi];
  if (!m || s.si == null || s.si >= minorsOf(m).length) { s.mi = null; s.si = null; s.lessonId = null; return; }
  const list = lessonsOf(s.gi, s.mi, s.si);
  if (!list.some(function (l) { return l.id === s.lessonId; })) s.lessonId = list.length ? list[0].id : null;
}

// ── 화면 이동
function goHome() {
  state.view = 'home';
  closeDrawer();
  changed();
  window.scrollTo(0, 0);
}
function openLesson(l) {
  state.sel = { gi: l.gi, mi: l.mi, si: l.si, lessonId: l.id };
  state.view = 'lesson';
  state.tab = 'board';
  rememberLast(l.id);
  closeDrawer();
  changed();
  stage.scrollTop = 0;
}
function openMinor(gi, mi, si) {
  const list = lessonsOf(gi, mi, si);
  if (list.length) { openLesson(list[0]); return; }
  state.sel = { gi: gi, mi: mi, si: si, lessonId: null };
  state.view = 'lesson';
  state.tab = state.edit ? 'board' : 'video';
  closeDrawer();
  changed();
}

// ── 왼쪽 목록
function renderSide() {
  $('gradeSel').innerHTML = state.grades.map(function (g, i) {
    return '<option value="' + i + '"' + (i === state.sel.gi ? ' selected' : '') + '>' + esc(g) + '</option>';
  }).join('');

  const gi = state.sel.gi;
  const majors = state.toc[gi] || [];
  let h = '';
  majors.forEach(function (m, mi) {
    const open = openMajors[gi + '-' + mi] || state.sel.mi === mi;
    h += '<button class="major' + (open ? ' open' : '') + '" data-act="major" data-mi="' + mi + '">' +
      esc(m.major) + '<span class="chev">▼</span></button><div class="major-body">';
    minorsOf(m).forEach(function (name, si) {
      const on = state.sel.mi === mi && state.sel.si === si;
      const list = lessonsOf(gi, mi, si);
      if (name !== null) {
        h += '<button class="minor' + (on ? ' on' : '') + '" data-act="minor" data-mi="' + mi + '" data-si="' + si + '">' + esc(name) + '</button>';
      }
      list.forEach(function (l) {
        h += '<button class="lsn' + (l.id === state.sel.lessonId ? ' on' : '') + '" data-act="lesson" data-id="' + esc(l.id) + '">' +
          '<b>' + esc(l.no || '') + '</b>' + esc(l.title) + '</button>';
      });
      if (name === null && !list.length && !state.edit) {
        h += '<button class="minor' + (on ? ' on' : '') + '" data-act="minor" data-mi="' + mi + '" data-si="0">영상 보기</button>';
      }
      if (state.edit) {
        h += '<button class="addl" data-act="add-lesson" data-mi="' + mi + '" data-si="' + si + '">＋ 차시 추가</button>';
      }
    });
    h += '</div>';
  });
  $('tree').innerHTML = h || '<div class="hint" style="padding:16px">목차가 없어요.</div>';

  const eb = $('editBtn');
  eb.textContent = state.edit ? '편집 끄기' : '편집 켜기';
  eb.classList.toggle('on', state.edit);
}

// ── 본문
function emptyHtml() {
  const s = state.sel;
  if (s.mi == null) {
    return '<div class="empty"><div>단원을 골라 주세요.</div>' +
      '<button class="btn" data-act="go-home">메인 화면으로</button></div>';
  }
  if (state.edit) {
    return '<div class="empty"><div>이 단원에는 아직 차시가 없어요.</div><div class="btn-row">' +
      '<button class="btn main" data-act="add-lesson" data-mi="' + s.mi + '" data-si="' + s.si + '">＋ 차시 추가</button>' +
      '<button class="btn" data-act="bulk">여러 차시 한 번에</button>' +
      '</div></div>';
  }
  return '<div class="empty"><div>이 단원에는 아직 판서가 없어요.<br>"편집 켜기"를 누르면 차시를 추가할 수 있어요.</div></div>';
}

function renderMain() {
  const lesson = curLesson();
  document.querySelectorAll('#tabs .tab').forEach(function (t) {
    t.classList.toggle('on', t.getAttribute('data-tab') === state.tab);
  });
  const s = state.sel;
  $('crumb').textContent = s.mi == null ? '' : (state.grades[s.gi] || '') + ' · ' + minorName(s.gi, s.mi, s.si);

  stage.classList.remove('is-board');
  const showBar = state.tab === 'board' && !!lesson && board.lineCount(lesson) > 0;
  $('bar').classList.toggle('show', showBar);

  if (state.tab === 'video' && s.mi != null) { renderVideos(stage); return; }
  if (!lesson) { stage.innerHTML = emptyHtml(); return; }
  if (state.tab === 'files') { renderFiles(stage, lesson); return; }

  board.renderBoard(stage, lesson);
  stage.classList.add('is-board');
  const n = board.shownOf(lesson), max = board.lineCount(lesson);
  $('count').textContent = n + ' / ' + max;
  $('prevBtn').disabled = n === 0;
  $('nextBtn').disabled = n === max;
}

function render() {
  fixSelection();
  document.documentElement.style.setProperty('--fs', String(state.fontScale));
  document.body.classList.toggle('at-home', state.view === 'home');
  if (state.view === 'home') {
    renderHome($('home'));
  } else {
    renderSide();
    renderMain();
  }
  remember();
}

function closeDrawer() { document.body.classList.remove('side-open'); }

function boardStep(n) {
  const lesson = curLesson();
  if (!lesson || state.tab !== 'board' || state.view !== 'lesson') return;
  board.step(lesson, n);
  renderMain();
}

function closeViewer() {
  const v = $('viewer');
  v.classList.remove('open');
  v.innerHTML = ''; // 영상 재생도 함께 멈춤
}

function openHelp() {
  const sheet = openModal(
    '<h2>사용법</h2>' +
    '<ul class="help-list">' +
    '<li><b>수업하기</b>: 메인에서 차시를 고르고, 화면을 누르거나 → 키를 누르면 판서·사진·영상이 순서대로 하나씩 나옵니다. ← 키는 되돌리기.</li>' +
    '<li><b>사진·영상</b>: 화면에 나온 사진을 누르면 가득 크게, 영상을 누르면 바로 재생됩니다.</li>' +
    '<li><b>수업 준비</b>: "편집 켜기" → "차시 추가"(한 차시) 또는 "여러 차시 한 번에"(단원 통째로)에 판서 글을 붙여넣습니다.</li>' +
    '<li><b>사진·영상 넣기</b>: "판서 고치기"에서 넣을 줄에 커서를 두고 "사진 넣기"·"영상 넣기"를 누르면 바로 올리고 끼워 넣습니다.</li>' +
    '<li><b>단원 추가</b>: 메인 화면에서 "편집 켜기 → 목차 편집". 순서를 바꿔도 차시와 영상이 따라갑니다.</li>' +
    '<li><b>강조</b>: 글자를 선택하고 "빨간 강조"를 누르면 빨간색이 됩니다.</li>' +
    '<li><b>☰</b>: 단원 목록을 접어 화면을 넓게 씁니다.</li>' +
    '<li><b>잠그기</b>: 교실 컴퓨터에서 쓴 뒤 누르면 다시 암호를 묻습니다.</li>' +
    '</ul>' +
    '<div class="sheet-btns"><span class="sp"></span><button class="btn main" id="helpOk">확인</button></div>'
  );
  sheet.querySelector('#helpOk').onclick = closeModal;
}

function lessonById(id) {
  return state.lessons.find(function (l) { return l.id === id; }) || null;
}

// ── 이벤트
function bind() {
  // 메인 화면
  $('home').addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    const gi = state.sel.gi;
    const mi = +t.getAttribute('data-mi');
    const si = +t.getAttribute('data-si');
    if (act === 'lesson') { const l = lessonById(t.getAttribute('data-id')); if (l) openLesson(l); }
    else if (act === 'minor') openMinor(gi, mi, si);
    else if (act === 'grade') { state.sel = { gi: +t.getAttribute('data-gi'), mi: null, si: null, lessonId: null }; changed(); }
    else if (act === 'add-lesson') openLessonEditor(null, { gi: gi, mi: mi, si: si });
    else if (act === 'bulk') openBulk({ gi: gi, mi: mi, si: si });
    else if (act === 'toc') openTocEditor();
    else if (act === 'edit') toggleEdit();
    else if (act === 'help') openHelp();
    else if (act === 'lock') lockNow();
  });

  // 수업 화면: 왼쪽 목록
  $('gradeSel').addEventListener('change', function () {
    state.sel = { gi: +this.value, mi: null, si: null, lessonId: null };
    changed();
  });
  $('tree').addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    const gi = state.sel.gi;
    const mi = +t.getAttribute('data-mi');
    const si = +t.getAttribute('data-si');
    if (act === 'major') {
      const isOpen = t.classList.contains('open');
      openMajors[gi + '-' + mi] = !isOpen;
      if (isOpen && state.sel.mi === mi) { t.classList.remove('open'); return; } // 고른 단원이 든 대단원은 화면에서만 접음
      renderSide();
    } else if (act === 'minor') openMinor(gi, mi, si);
    else if (act === 'lesson') { const l = lessonById(t.getAttribute('data-id')); if (l) openLesson(l); }
    else if (act === 'add-lesson') { closeDrawer(); openLessonEditor(null, { gi: gi, mi: mi, si: si }); }
  });

  $('tabs').addEventListener('click', function (e) {
    const t = e.target.closest('.tab');
    if (!t) return;
    state.tab = t.getAttribute('data-tab');
    renderMain();
  });

  stage.addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    const act = t && t.getAttribute('data-act');
    if (act === 'go-home') { goHome(); return; }
    if (act === 'add-lesson') { openLessonEditor(null, { gi: state.sel.gi, mi: +t.getAttribute('data-mi'), si: +t.getAttribute('data-si') }); return; }
    if (act === 'bulk') { openBulk({ gi: state.sel.gi, mi: state.sel.mi, si: state.sel.si }); return; }
    if (act === 'edit-lesson') { openLessonEditor(curLesson()); return; }
    if (act === 'next-lesson') { const n = board.nextLesson(curLesson()); if (n) openLesson(n); return; }
    // 판서 화면은 (사진·영상·기사 카드가 아닌) 어디를 눌러도 다음 단계
    if (!t && !e.target.closest('a') && state.tab === 'board' && curLesson()) boardStep(1);
  });

  $('nextBtn').onclick = function () { boardStep(1); };
  $('prevBtn').onclick = function () { boardStep(-1); };
  $('allBtn').onclick = function () { const l = curLesson(); if (l) { board.showAll(l); renderMain(); } };
  $('resetBtn').onclick = function () { const l = curLesson(); if (l) { board.reset(l); renderMain(); stage.scrollTop = 0; } };

  $('menuBtn').onclick = function () {
    if (window.matchMedia('(max-width:800px)').matches) document.body.classList.toggle('side-open');
    else document.body.classList.toggle('side-closed');
  };
  $('scrim').onclick = closeDrawer;
  $('homeBtn').onclick = goHome;
  $('helpBtn').onclick = openHelp;
  $('editBtn').onclick = toggleEdit;
  $('fontUp').onclick = function () { state.fontScale = Math.min(1.8, +(state.fontScale + 0.1).toFixed(2)); render(); };
  $('fontDown').onclick = function () { state.fontScale = Math.max(0.7, +(state.fontScale - 0.1).toFixed(2)); render(); };
  $('fullBtn').onclick = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  };

  $('viewer').addEventListener('click', function (e) {
    const a = e.target.getAttribute && e.target.getAttribute('data-v');
    if (a === 'prev') viewerNav(-1);
    else if (a === 'next') viewerNav(1);
    else if (a === 'close' || e.target === this) closeViewer();
  });

  document.addEventListener('keydown', function (e) {
    const v = $('viewer');
    if (v.classList.contains('open')) {
      if (e.key === 'Escape') closeViewer();
      else if (v.getAttribute('data-kind') === 'photo' && e.key === 'ArrowRight') viewerNav(1);
      else if (v.getAttribute('data-kind') === 'photo' && e.key === 'ArrowLeft') viewerNav(-1);
      return;
    }
    if (isModalOpen()) { if (e.key === 'Escape' && !isStickyModal()) closeModal(); return; }
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (state.view !== 'lesson' || state.tab !== 'board') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
      if ((e.key === ' ' || e.key === 'Enter') && (tag === 'BUTTON' || tag === 'A')) return; // 버튼 위에서는 버튼 동작만
      e.preventDefault(); boardStep(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault(); boardStep(-1);
    }
  });

  initFiles(stage);
  initVideos(stage);
}

// ── 시작
let bound = false;
async function load() {
  const home = $('home');
  home.innerHTML = '<div class="empty"><div>불러오는 중…</div></div>';
  try {
    const cfg = await store.loadConfig();
    state.grades = cfg.grades;
    state.toc = cfg.toc;
    state.lessons = await store.loadLessons();
  } catch (e) {
    console.error(e);
    home.innerHTML = '<div class="empty"><div>내용을 불러오지 못했어요.<br>인터넷 연결을 확인해 주세요.</div>' +
      '<button class="btn main" id="retryBtn">다시 시도</button></div>';
    $('retryBtn').onclick = load;
    return;
  }
  if (!bound) { onChange(render); bind(); bound = true; }
  render();
  // 영상은 뒤이어 불러와도 판서를 바로 쓸 수 있게 따로 처리
  store.loadVideos().then(function (v) {
    state.videos = v;
    state.videosLoaded = true;
    render();
  }).catch(function (e) { console.warn('영상 목록 불러오기 실패', e); });
}

async function init() {
  recall();
  await passGate();   // 암호를 통과해야 내용을 불러옴
  restoreEdit();
  state.view = 'home';
  document.body.classList.add('at-home');
  load();
}

init();

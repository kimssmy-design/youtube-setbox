// 시작점: 암호 → 메인 → 수업(화두·판서·교과서·영상) / 준비
import { state, onChange, lessonById } from './state.js';
import * as store from './store.js';
import * as run from './run.js';
import { openPrep, initPrep, onPrepExit, prepVideosLoaded } from './prep.js';
import { renderHome, rememberLast, toggleMajor } from './home.js';
import { openPhotos, playVideo, closeViewer, viewerKey, initViewer } from './viewer.js';
import { openBulk } from './bulk.js';
import { openTocEditor } from './toc.js';
import { passGate, lockNow } from './gate.js';
import { openModal, closeModal, isModalOpen, isStickyModal } from './ui.js';

const $ = function (id) { return document.getElementById(id); };
const stage = $('stage');

// ── 기기에 기억해 두는 것(고른 학년, 글씨 크기)
function remember() {
  try {
    localStorage.setItem('lessonGrade', String(state.sel.gi));
    localStorage.setItem('lessonFont', String(state.fontScale));
  } catch (e) { /* 저장소를 못 쓰는 환경 */ }
}
function recall() {
  try {
    const g = parseInt(localStorage.getItem('lessonGrade'), 10);
    if (g >= 0) state.sel.gi = g;
    const f = parseFloat(localStorage.getItem('lessonFont'));
    if (f >= 0.7 && f <= 1.8) state.fontScale = f;
    state.blank = localStorage.getItem('lessonBlank') === '1';
  } catch (e) { /* 무시 */ }
}

// ── 화면 그리기
function render() {
  if (state.sel.gi >= state.grades.length) state.sel.gi = 0;
  document.documentElement.style.setProperty('--fs', String(state.fontScale));
  document.documentElement.style.setProperty('--fs0', String(state.fontScale));
  document.body.setAttribute('data-view', state.view);
  if (state.view === 'home') renderHome($('home'));
  else if (state.view === 'run') {
    const l = run.runLesson();
    if (!l) { state.view = 'home'; return render(); }
    run.renderRun(l);
  }
  // 준비 화면은 prep.js 가 직접 그림 (쓰던 글이 지워지지 않게)
  remember();
}

// ── 화면 이동
function goHome() {
  closeViewer();
  state.view = 'home';
  render();
  $('home').scrollTop = 0;
}
function startRun(id, fresh) {
  if (fresh) run.resetPos(id);
  state.runId = id;
  state.view = 'run';
  if (id.indexOf('unit:') !== 0) {
    rememberLast(id);
    const l = lessonById(id);
    if (l) state.sel.gi = l.gi;
  }
  render();
  stage.scrollTop = 0;
}
function startPrep(lesson, where, from) {
  closeViewer();
  state.prepFrom = from;
  state.view = 'prep';
  document.body.setAttribute('data-view', 'prep');
  openPrep(lesson, where);
}
onPrepExit(function (lesson, how) {
  if (state.prepFrom === 'run' && lesson && how !== 'deleted') { startRun(lesson.id, false); return; }
  goHome();
});

function step(dir) {
  const l = run.runLesson();
  if (!l) return;
  if (dir > 0 ? run.next(l) : run.prev(l)) run.renderRun(l);
}

function openHelp() {
  const sheet = openModal(
    '<h2>사용법</h2>' +
    '<ul class="help-list">' +
    '<li><b>수업하기</b>: 차시를 누르면 표지 → ① 인트로 → ② 판서 → ③ 복습 → ④ 영상 순서로 진행됩니다. 화면을 누르거나 "다음 ▶"(→ 키)를 누르면 다음으로, ← 키는 되돌리기.</li>' +
    '<li><b>빈칸</b>: 수업 중 "빈칸" 버튼(B 키)을 켜면 빨간 핵심어가 빈칸으로 먼저 나오고, 한 번 더 누르면 채워집니다. ③ 복습은 판서 전체를 빈칸으로 다시 띄워 하나씩 맞혀 봅니다.</li>' +
    '<li><b>순서 바꾸기</b>: 위쪽 단계 이름을 누르면 그 단계로 바로 갑니다. 영상을 먼저 보고 판서로 돌아와도 판서는 보던 데서 이어집니다. 숫자 키 1~4도 됩니다.</li>' +
    '<li><b>준비하기</b>: 차시 옆 ✎ 또는 수업 중 "✎ 준비"에서 인트로·판서·마무리 영상을 채웁니다. 비워 둔 단계는 건너뜁니다.</li>' +
    '<li><b>판서 쓰는 법</b>: # 학습 1. 제목 (109쪽) = 큰 제목(새 화면), 1. / (1) / ① = 번호 단계, *글자* = 핵심어, ※ = 빨간 보충, 왼쪽 | 오른쪽 = 두 칸 비교, --- = 화면 넘김.</li>' +
    '<li><b>사진</b>: 준비 화면에서 붙여넣기(Ctrl+V)만 해도 들어갑니다. 판서 글 상자에 붙여넣으면 판서에, 그 밖에서는 인트로에 들어갑니다.</li>' +
    '<li><b>단원 통째로</b>: "여러 차시 한 번에"에 ## 01 제목 (148~151쪽) 형식으로 붙여넣습니다.</li>' +
    '<li><b>잠그기</b>: 교실 컴퓨터에서 쓴 뒤 누르면 다시 암호를 묻습니다.</li>' +
    '</ul>' +
    '<div class="sheet-btns"><span class="sp"></span><button class="btn main" id="helpOk">확인</button></div>'
  );
  sheet.querySelector('#helpOk').onclick = closeModal;
}

// ── 이벤트
function bind() {
  // 메인
  $('home').addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    const gi = state.sel.gi;
    const mi = +t.getAttribute('data-mi'), si = +t.getAttribute('data-si');
    const id = t.getAttribute('data-id');
    if (act === 'run') startRun(id, true);
    else if (act === 'prep') { const l = lessonById(id); if (l) startPrep(l, null, 'home'); }
    else if (act === 'new') startPrep(null, { gi: gi, mi: mi, si: si }, 'home');
    else if (act === 'unit-video') startRun('unit:' + gi + ':' + mi + ':' + si, true);
    else if (act === 'major') { toggleMajor(gi, mi); render(); }
    else if (act === 'grade') { state.sel.gi = +t.getAttribute('data-gi'); render(); }
    else if (act === 'bulk') openBulk({ gi: gi, mi: mi, si: si });
    else if (act === 'toc') openTocEditor();
    else if (act === 'help') openHelp();
    else if (act === 'lock') lockNow();
  });

  // 수업 화면
  $('runBack').onclick = goHome;
  $('runPrep').onclick = function () { const l = run.runLesson(); if (l && !l.virtual) startPrep(l, null, 'run'); };
  $('runSteps').addEventListener('click', function (e) {
    const b = e.target.closest('[data-sec]');
    const l = run.runLesson();
    if (b && l && run.jump(l, b.getAttribute('data-sec'))) { run.renderRun(l); stage.scrollTop = 0; }
  });
  $('nextBtn').onclick = function () {
    const nid = this.getAttribute('data-next-lesson');
    if (nid) startRun(nid, true); else step(1);
  };
  $('prevBtn').onclick = function () { step(-1); };
  $('blankBtn').onclick = function () { const l = run.runLesson(); run.toggleBlank(l); if (l) run.renderRun(l); };

  stage.addEventListener('click', function (e) {
    const l = run.runLesson();
    if (!l) return;
    const t = e.target.closest('[data-act]');
    const act = t && t.getAttribute('data-act');
    if (act === 'view-photo') { openPhotos(l.photos || [], +t.getAttribute('data-i')); return; }
    if (act === 'zoom-topic') { openPhotos(run.topicOf(l).photos, +t.getAttribute('data-i')); return; }
    if (act === 'play') { playVideo(t.getAttribute('data-id'), t.getAttribute('data-title')); return; }
    if (act === 'prep') { startPrep(l, null, 'run'); return; }
    if (t || e.target.closest('a,button')) return;
    step(1); // 빈 곳을 누르면 다음
  });

  $('fontUp').onclick = function () { state.fontScale = Math.min(1.8, +(state.fontScale + 0.1).toFixed(2)); render(); };
  $('fontDown').onclick = function () { state.fontScale = Math.max(0.7, +(state.fontScale - 0.1).toFixed(2)); render(); };
  $('fullBtn').onclick = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  };

  document.addEventListener('keydown', function (e) {
    if (viewerKey(e)) return;
    if (isModalOpen()) { if (e.key === 'Escape' && !isStickyModal()) closeModal(); return; }
    if (state.view !== 'run') return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const l = run.runLesson();
    if (!l) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
      if ((e.key === ' ' || e.key === 'Enter') && (tag === 'BUTTON' || tag === 'A')) return; // 버튼 위에서는 버튼 동작만
      e.preventDefault(); step(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault(); step(-1);
    } else if (/^[1-4]$/.test(e.key)) {
      if (run.jump(l, run.SECS[+e.key - 1].k)) { run.renderRun(l); stage.scrollTop = 0; }
    } else if (e.key === 'b' || e.key === 'B' || e.key === 'ㅠ') {
      run.toggleBlank(l); run.renderRun(l);
    } else if (e.key === 'Escape') {
      goHome();
    }
  });

  initViewer();
  initPrep();

  // 화면 크기·글꼴이 바뀌면 판서 쪽 나누기를 다시 계산
  let rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (state.view === 'run') render(); }, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (state.view === 'run') render(); });
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
    if (state.view === 'prep') prepVideosLoaded();
  }).catch(function (e) { console.warn('영상 목록 불러오기 실패', e); });
}

async function init() {
  recall();
  await passGate();   // 암호를 통과해야 내용을 불러옴
  state.view = 'home';
  document.body.setAttribute('data-view', 'home');
  load();
}

init();

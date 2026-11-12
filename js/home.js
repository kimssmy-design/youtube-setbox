// 메인 화면: 이어서 하기, 학년, 단원(접고 펴기)과 차시 목록
import { state, lessonsOf, videosOf, minorsOf, minorName, lessonById } from './state.js';
import { hasSec, SECS } from './run.js';
import { esc } from './ui.js';

export function lastLessonId() {
  try { return localStorage.getItem('lessonLast') || ''; } catch (e) { return ''; }
}
export function rememberLast(id) {
  try { localStorage.setItem('lessonLast', id); } catch (e) { /* 무시 */ }
}

// 펼쳐 둔 대단원 기억
function opens() {
  try { return JSON.parse(localStorage.getItem('lessonOpen') || '{}') || {}; } catch (e) { return {}; }
}
export function toggleMajor(gi, mi) {
  const o = opens();
  const k = gi + '-' + mi;
  o[k] = !isOpen(gi, mi, o);
  try { localStorage.setItem('lessonOpen', JSON.stringify(o)); } catch (e) { /* 무시 */ }
}
function isOpen(gi, mi, o) {
  const k = gi + '-' + mi;
  if (k in o) return !!o[k];
  const last = lessonById(lastLessonId());
  return !!(last && last.gi === gi && last.mi === mi);
}

function dots(l) {
  return '<span class="dots" title="인트로 · 판서 · 복습 · 영상">' + SECS.map(function (s) {
    return '<i class="' + (hasSec(l, s.k) ? 'y' : '') + '"></i>';
  }).join('') + '</span>';
}

export function renderHome(el) {
  const gi = state.sel.gi;
  const o = opens();
  let h = '<div class="home-in"><div class="home-top"><div><h1>도덕 수업</h1>' +
    '<div class="home-sub">오늘 수업할 차시를 고르세요</div></div>' +
    '<div class="home-tools"><a class="mini" href="videos.html">영상 모음</a><button class="mini" data-act="help">? 사용법</button></div></div>';

  const last = lessonById(lastLessonId());
  if (last) {
    h += '<div class="home-sec">이어서 하기</div>' +
      '<div class="resume"><div class="resume-t"><b>' + esc((last.no ? last.no + ' ' : '') + last.title) + '</b><span>' +
      esc((state.grades[last.gi] || '') + ' · ' + minorName(last.gi, last.mi, last.si)) + '</span></div>' +
      '<button class="btn main" data-act="run" data-id="' + esc(last.id) + '">수업 시작</button></div>';
  }

  h += '<div class="home-sec">학년</div><div class="chips">' + state.grades.map(function (g, i) {
    return '<button class="chip' + (i === gi ? ' on' : '') + '" data-act="grade" data-gi="' + i + '">' + esc(g) + '</button>';
  }).join('') + '</div><div class="home-sec">단원</div>';

  const majors = state.toc[gi] || [];
  if (!majors.length) h += '<div class="hint">목차가 없어요. 아래 "목차 편집"에서 단원을 만들어 주세요.</div>';
  majors.forEach(function (m, mi) {
    const open = isOpen(gi, mi, o);
    let nL = 0, nV = 0;
    minorsOf(m).forEach(function (_, si) { nL += lessonsOf(gi, mi, si).length; nV += videosOf(gi, mi, si).length; });
    h += '<div class="acc' + (open ? ' open' : '') + '"><button class="acc-h" data-act="major" data-mi="' + mi + '">' +
      '<span>' + esc(m.major) + '</span><small>차시 ' + nL + (nV ? ' · 영상 ' + nV : '') + ' ' + (open ? '▴' : '▾') + '</small></button>';
    if (open) {
      minorsOf(m).forEach(function (name, si) {
        const list = lessonsOf(gi, mi, si);
        const vids = videosOf(gi, mi, si).length;
        h += '<div class="mn"><span>' + esc(name || '') + '</span>' +
          (vids ? '<button class="mn-v" data-act="unit-video" data-mi="' + mi + '" data-si="' + si + '">영상 ' + vids + '개 ▶</button>' : '') + '</div>';
        list.forEach(function (l) {
          h += '<div class="ls"><button class="ls-main" data-act="run" data-id="' + esc(l.id) + '"><b>' + esc(l.no || '') + '</b>' +
            '<span class="ls-t">' + esc(l.title) + '</span>' + dots(l) + '</button>' +
            '<button class="ls-edit" data-act="prep" data-id="' + esc(l.id) + '" aria-label="준비" title="준비">✎</button></div>';
        });
        h += '<div class="ls-add"><button data-act="new" data-mi="' + mi + '" data-si="' + si + '">＋ 차시 만들기</button>' +
          '<button data-act="bulk" data-mi="' + mi + '" data-si="' + si + '">여러 차시 한 번에</button></div>';
      });
    }
    h += '</div>';
  });

  h += '<div class="legend">점 4개 = 인트로 · 판서 · 복습(핵심어) · 영상 준비 여부 <i></i>준비됨</div>' +
    '<div class="home-foot">' +
    '<button class="mini" data-act="toc">목차 편집</button>' +
    '<button class="mini" data-act="lock">잠그기</button></div></div>';
  el.innerHTML = h;
}

// 메인 화면: 이어서 하기, 학년, 단원별 차시 목록
import { state, lessonsOf, videosOf, minorName } from './state.js';
import { lineCount } from './board.js';
import { esc } from './ui.js';

export function lastLessonId() {
  try { return localStorage.getItem('lessonLast') || ''; } catch (e) { return ''; }
}
export function rememberLast(id) {
  try { localStorage.setItem('lessonLast', id); } catch (e) { /* 무시 */ }
}

function lessonInfo(l) {
  const parts = ['판서 ' + lineCount(l) + '줄'];
  if ((l.photos || []).length) parts.push('사진 ' + l.photos.length);
  if ((l.links || []).length) parts.push('기사 ' + l.links.length);
  return parts.join(' · ');
}

export function renderHome(el) {
  const gi = state.sel.gi;
  let h = '<div class="home-in"><div class="home-top"><div><h1>도덕 수업</h1>' +
    '<div class="home-sub">오늘 수업할 차시를 고르세요</div></div>' +
    '<button class="mini" data-act="help">? 사용법</button></div>';

  const last = state.lessons.find(function (l) { return l.id === lastLessonId(); });
  if (last) {
    h += '<div class="home-sec">이어서 하기</div>' +
      '<button class="resume" data-act="lesson" data-id="' + esc(last.id) + '"><div><b>' +
      esc((last.no ? last.no + ' ' : '') + last.title) + '</b><span>' +
      esc((state.grades[last.gi] || '') + ' · ' + minorName(last.gi, last.mi, last.si)) + '</span></div><i>▶</i></button>';
  }

  h += '<div class="home-sec">학년</div><div class="chips">' + state.grades.map(function (g, i) {
    return '<button class="chip' + (i === gi ? ' on' : '') + '" data-act="grade" data-gi="' + i + '">' + esc(g) + '</button>';
  }).join('') + '</div>';

  const majors = state.toc[gi] || [];
  if (!majors.length) h += '<div class="hint">목차가 없어요. "편집 켜기 → 목차 편집"에서 단원을 만들어 주세요.</div>';
  majors.forEach(function (m, mi) {
    h += '<div class="home-sec">' + esc(m.major) + '</div>';
    const minors = (m.minors && m.minors.length) ? m.minors : [m.major];
    minors.forEach(function (name, si) {
      const list = lessonsOf(gi, mi, si);
      const vids = videosOf(gi, mi, si).length;
      h += '<div class="unit"><button class="unit-h" data-act="minor" data-mi="' + mi + '" data-si="' + si + '">' +
        esc(name) + '<small>' + (vids ? '영상 ' + vids : '') + '</small></button>';
      list.forEach(function (l) {
        h += '<button class="row" data-act="lesson" data-id="' + esc(l.id) + '"><b>' + esc(l.no || '') + '</b>' +
          '<span class="row-t">' + esc(l.title) + '</span><small>' + lessonInfo(l) + '</small></button>';
      });
      if (!list.length && !state.edit) {
        h += '<div class="row none">아직 준비한 차시가 없어요</div>';
      }
      if (state.edit) {
        h += '<div class="row tools"><button class="addl" data-act="add-lesson" data-mi="' + mi + '" data-si="' + si + '">＋ 차시 추가</button>' +
          '<button class="addl" data-act="bulk" data-mi="' + mi + '" data-si="' + si + '">여러 차시 한 번에</button></div>';
      }
      h += '</div>';
    });
  });

  h += '<div class="home-foot">' +
    '<a class="mini" href="./">영상 모음</a>' +
    '<button class="mini' + (state.edit ? ' on' : '') + '" data-act="edit">' + (state.edit ? '편집 끄기' : '편집 켜기') + '</button>' +
    (state.edit ? '<button class="mini" data-act="toc">목차 편집</button>' : '') +
    '<button class="mini" data-act="lock">잠그기</button></div></div>';
  el.innerHTML = h;
}

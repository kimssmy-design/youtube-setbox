// 화면 전체가 함께 쓰는 상태
export const state = {
  grades: [],
  toc: [],
  lessons: [],     // 차시(판서·자료) 목록
  videos: [],      // 기존 영상 모음에서 불러온 영상
  videosLoaded: false,
  sel: { gi: 0, mi: null, si: null, lessonId: null },
  view: 'home',    // home: 메인 화면, lesson: 수업 화면
  tab: 'board',
  edit: false,
  shown: {},       // 차시별로 지금까지 보여 준 줄 수
  fontScale: 1
};

const subs = [];
export function onChange(fn) { subs.push(fn); }
export function changed() { subs.forEach(function (fn) { fn(); }); }

export function curLesson() {
  return state.lessons.find(function (l) { return l.id === state.sel.lessonId; }) || null;
}

export function lessonsOf(gi, mi, si) {
  return state.lessons
    .filter(function (l) { return l.gi === gi && l.mi === mi && l.si === si; })
    .sort(function (a, b) {
      const c = String(a.no || '').localeCompare(String(b.no || ''), 'ko', { numeric: true });
      return c !== 0 ? c : (a.createdAt || 0) - (b.createdAt || 0);
    });
}

// 중단원 이름 (중단원이 없는 대단원은 대단원 이름)
export function minorName(gi, mi, si) {
  const m = (state.toc[gi] || [])[mi];
  if (!m) return '';
  return (m.minors && m.minors.length) ? (m.minors[si] || '') : m.major;
}

// 그 단원에 등록된 영상 (짧은 것부터)
export function videosOf(gi, mi, si) {
  const m = (state.toc[gi] || [])[mi];
  const hasMinors = m && m.minors && m.minors.length;
  return state.videos
    .filter(function (v) { return v.gi === gi && v.mi === mi && (!hasMinors || v.si === si); })
    .sort(function (a, b) { return (a.durSec || 99999) - (b.durSec || 99999); });
}

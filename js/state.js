// 화면 전체가 함께 쓰는 상태
export const state = {
  grades: [],
  toc: [],
  lessons: [],      // 차시 목록
  videos: [],       // 영상 모음에 등록된 영상
  videosLoaded: false,
  sel: { gi: 0 },   // 메인 화면에서 고른 학년
  view: 'home',     // home: 메인, run: 수업, prep: 준비
  runId: null,      // 수업 중인 차시 id (단원 영상만 볼 때는 'unit:학년:대단원:중단원')
  pos: {},          // 차시별 진행 위치 { sec, topic, board }
  fontScale: 1
};

const subs = [];
export function onChange(fn) { subs.push(fn); }
export function changed() { subs.forEach(function (fn) { fn(); }); }

export function lessonById(id) {
  return state.lessons.find(function (l) { return l.id === id; }) || null;
}

export function lessonsOf(gi, mi, si) {
  return state.lessons
    .filter(function (l) { return l.gi === gi && l.mi === mi && l.si === si; })
    .sort(function (a, b) {
      const c = String(a.no || '').localeCompare(String(b.no || ''), 'ko', { numeric: true });
      return c !== 0 ? c : (a.createdAt || 0) - (b.createdAt || 0);
    });
}

// 대단원의 중단원 목록 (중단원이 없으면 [null] 하나)
export function minorsOf(m) {
  return (m && m.minors && m.minors.length) ? m.minors : [null];
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

// 같은 단원의 다음 차시
export function nextLesson(lesson) {
  if (!lesson || lesson.virtual) return null;
  const list = lessonsOf(lesson.gi, lesson.mi, lesson.si);
  const i = list.findIndex(function (l) { return l.id === lesson.id; });
  return (i !== -1 && i + 1 < list.length) ? list[i + 1] : null;
}

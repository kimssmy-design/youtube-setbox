// 데이터 읽기·쓰기
// 수업 자료는 기존 영상 모음과 같은 'moral_videos' 묶음 안에 종류(kind)로 구분해 저장합니다.
//   kind:'lesson'  차시(판서 글, 기사 링크, 사진 목록)
//   kind:'photo'   사진 원본(줄인 것)
import {
  db, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, writeBatch
} from './firebase.js';

const COL = 'moral_videos';
const VIDEO_COL = 'moral_videos_list';
const SETTINGS_ID = 'lesson_settings';

// 기존 사이트에 설정이 아직 없을 때 쓰는 기본 목차
const DEFAULT_GRADES = ['중학교 2학년', '중학교 3학년'];
const DEFAULT_TOC = [
  [
    { major: 'Ⅰ. 자신과의 관계', minors: ['1. 자아와 도덕적인 삶', '2. 도덕적인 사람의 모습', '3. 행복과 도덕'] },
    { major: 'Ⅱ. 타인과의 관계', minors: ['1. 바람직한 가정의 모습', '2. 우정의 소중함', '3. 가상공간과 타인 존중'] },
    { major: 'Ⅲ. 사회·공동체와의 관계', minors: ['1. 인권의 보편성', '2. 다양한 문화와 종교의 공존', '3. 통일의 의미와 가치'] },
    { major: 'Ⅳ. 자연과의 관계', minors: ['1. 생명을 존중하는 삶'] }
  ],
  [
    { major: 'Ⅰ. 타인과의 관계', minors: ['1. 정보 통신 윤리', '2. 평화적 갈등 해결', '3. 폭력의 문제'] },
    { major: 'Ⅱ. 사회·공동체와의 관계', minors: ['1. 도덕적 시민', '2. 사회 정의', '3. 북한 이해', '4. 통일 윤리 의식'] },
    { major: 'Ⅲ. 자연·초월과의 관계', minors: ['1. 자연관', '2. 과학과 윤리', '3. 삶의 소중함'] }
  ]
];

// 목차 저장 모양: Firestore는 배열 안의 배열을 저장하지 못하므로
//   tocv2: [ { majors: [ { major, minors: [..] } ] }, ... ]  (학년 순서대로)
// 로 저장하고, 화면에서는 toc[학년][대단원] 모양으로 풀어서 씁니다.
function unpack(tocv2) {
  return tocv2.map(function (g) {
    return (g.majors || []).map(function (m) { return { major: m.major, minors: m.minors || [] }; });
  });
}
function pack(toc) {
  return toc.map(function (majors) {
    return { majors: majors.map(function (m) { return { major: m.major, minors: m.minors || [] }; }) };
  });
}

export async function loadConfig() {
  const snap = await getDoc(doc(db, COL, 'config'));
  if (snap.exists()) {
    const d = snap.data();
    let toc = DEFAULT_TOC;
    if (Array.isArray(d.tocv2) && d.tocv2.length) toc = unpack(d.tocv2);
    else if (Array.isArray(d.toc) && d.toc.length) toc = d.toc;
    return { grades: (d.grades && d.grades.length) ? d.grades : DEFAULT_GRADES, toc: toc };
  }
  return { grades: DEFAULT_GRADES, toc: DEFAULT_TOC };
}

// 목차를 저장하면서, 자리가 바뀐 차시·영상의 단원 번호도 한꺼번에 옮깁니다.
//   moves: [{ kind:'lesson'|'video', id, gi, mi, si }]
export async function saveStructure(grades, toc, moves) {
  const chunks = [];
  for (let i = 0; i < moves.length; i += 400) chunks.push(moves.slice(i, i + 400));
  if (!chunks.length) chunks.push([]);
  for (let c = 0; c < chunks.length; c++) {
    const batch = writeBatch(db);
    chunks[c].forEach(function (m) {
      batch.update(doc(db, m.kind === 'video' ? VIDEO_COL : COL, m.id), { gi: m.gi, mi: m.mi, si: m.si });
    });
    if (c === chunks.length - 1) batch.set(doc(db, COL, 'config'), { grades: grades, tocv2: pack(toc) });
    await batch.commit();
  }
}

export async function loadLessons() {
  const snap = await getDocs(query(collection(db, COL), where('kind', '==', 'lesson')));
  return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
}

export async function loadVideos() {
  const snap = await getDocs(collection(db, VIDEO_COL));
  return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
}

export async function addVideo(data) {
  const ref = await addDoc(collection(db, VIDEO_COL), data);
  return Object.assign({ id: ref.id }, data);
}

export async function addLesson(data) {
  const full = Object.assign({ kind: 'lesson', text: '', links: [], photos: [], createdAt: Date.now() }, data);
  const ref = await addDoc(collection(db, COL), full);
  return Object.assign({ id: ref.id }, full);
}

export async function updateLesson(id, patch) {
  await updateDoc(doc(db, COL, id), patch);
}

export async function removeLesson(lesson) {
  const photos = lesson.photos || [];
  for (let i = 0; i < photos.length; i++) {
    try { await deleteDoc(doc(db, COL, photos[i].id)); } catch (e) { console.warn('사진 삭제 실패', e); }
  }
  await deleteDoc(doc(db, COL, lesson.id));
}

// ── 사진
const photoCache = {};
export async function addPhoto(dataUrl) {
  const ref = await addDoc(collection(db, COL), { kind: 'photo', data: dataUrl, createdAt: Date.now() });
  photoCache[ref.id] = dataUrl;
  return ref.id;
}
export function cachedPhoto(id) { return photoCache[id] || null; }
export async function getPhoto(id) {
  if (photoCache[id]) return photoCache[id];
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  photoCache[id] = snap.data().data;
  return photoCache[id];
}
export async function removePhoto(id) {
  delete photoCache[id];
  await deleteDoc(doc(db, COL, id));
}

// ── 편집 암호
export async function loadSettings() {
  const snap = await getDoc(doc(db, COL, SETTINGS_ID));
  return snap.exists() ? snap.data() : {};
}
export async function saveSettings(data) {
  await setDoc(doc(db, COL, SETTINGS_ID), Object.assign({ kind: 'settings' }, data));
}

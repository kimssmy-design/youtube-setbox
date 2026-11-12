// 준비 화면: 한 차시의 ① 인트로 ② 판서 ③ 마무리 영상을 위에서 아래로 채웁니다.
// 올린 사진은 바로 저장되지만, 차시에 붙는 것은 "저장"을 눌렀을 때입니다.
import { state, lessonsOf, videosOf, minorName } from './state.js';
import * as store from './store.js';
import { fileToPhoto } from './photo.js';
import { addYoutube, insertLine, setDuration } from './media.js';
import { endVideos, topicOf } from './run.js';
import { unmatched } from './board.js';
import { esc, safeUrl, toast, confirmBox } from './ui.js';

let d = null;                       // 고치는 중인 내용
let exitFn = function () {};
export function onPrepExit(fn) { exitFn = fn; }

const root = function () { return document.getElementById('prep'); };
const q = function (sel) { return root().querySelector(sel); };
function pad(n) { return ('0' + n).slice(-2); }
function mark() { if (d) d.dirty = true; }

// ── 열기
export function openPrep(lesson, where) {
  const isNew = !lesson;
  const at = isNew ? where : { gi: lesson.gi, mi: lesson.mi, si: lesson.si };
  const t = topicOf(lesson);
  d = {
    isNew: isNew, lesson: lesson, at: at, dirty: false, busy: false, fileTarget: 'topic',
    photos: isNew ? [] : (lesson.photos || []).slice(),
    links: isNew ? [] : (lesson.links || []).slice(),
    topic: { photos: t.photos.slice(), links: t.links.slice(), videoIds: t.videoIds.slice() },
    endIds: isNew ? videosOf(at.gi, at.mi, at.si).map(function (v) { return v.id; })
      : endVideos(lesson).map(function (v) { return v.id; }),
    newIds: [], removedIds: []
  };
  const L = lesson || {};
  root().innerHTML =
    '<div class="prep-in">' +
    '<div class="prep-top"><button class="mini" data-p="cancel">‹ 나가기</button>' +
    '<div class="prep-h"><b>' + (isNew ? '새 차시 준비' : '차시 준비') + '</b><small>' + esc(minorName(at.gi, at.mi, at.si)) + '</small></div>' +
    '<button class="btn main" data-p="save">저장</button></div>' +

    '<div class="blk"><div class="blk-b"><div class="row3">' +
    '<div><label class="field-label">번호</label><input class="field" id="pNo" value="' + esc(isNew ? pad(lessonsOf(at.gi, at.mi, at.si).length + 1) : (L.no || '')) + '"></div>' +
    '<div><label class="field-label">차시 제목</label><input class="field" id="pTitle" value="' + esc(L.title || '') + '" placeholder="예: 북한을 이해하려면"></div>' +
    '<div><label class="field-label">교과서 쪽</label><input class="field" id="pPage" value="' + esc(L.page || '') + '" placeholder="148~151"></div>' +
    '</div></div></div>' +

    '<div class="blk" data-blk="topic"><div class="blk-h"><em>1</em>인트로<small>근황토크 · 시사 · 생각 열기 · 학습목표</small></div><div class="blk-b">' +
    '<div class="row2"><div><label class="field-label">학생에게 던질 질문</label><input class="field" id="pQ" value="' + esc(t.q) + '" placeholder="예: \'북한\' 하면 떠오르는 단어 5가지?"></div>' +
    '<div><label class="field-label">쪽 (선택)</label><input class="field" id="pTPage" value="' + esc(t.page) + '" placeholder="148"></div></div>' +
    '<label class="field-label">예시·덧붙일 말 — 빨간 글씨, 한 번 누르면 나타남 (선택)</label><textarea class="field short" id="pMemo" placeholder="예) 핵, 미사일 / 이산가족, 탈북민">' + esc(t.memo) + '</textarea>' +
    '<label class="field-label">학습목표 — 한 줄에 하나, 그다음 누를 때 나타남 (선택)</label><textarea class="field short" id="pGoals" placeholder="북한을 바라보는 두 가지 시각을 설명할 수 있다.&#10;북한에 관한 균형 있는 관점을 지닌다.">' + esc(t.goals) + '</textarea>' +
    '<div id="pTopicMedia"></div>' +
    '<div class="ins-row"><button class="mini" data-p="t-photo">＋ 사진</button><button class="mini" data-p="t-link">＋ 기사</button><button class="mini" data-p="t-video">＋ 영상</button></div>' +
    '<div class="pick" id="pTopicPick"></div>' +
    '<div class="rule">사진이 여러 장이면 "다음"을 누를 때마다 한 장씩 넘어갑니다. 복사한 사진은 이 화면에서 붙여넣기(Ctrl+V)만 해도 인트로에 들어갑니다.</div>' +
    '</div></div>' +

    '<div class="blk" data-blk="board"><div class="blk-h"><em>2</em>판서<small>한 줄씩 나타남</small></div><div class="blk-b">' +
    '<textarea class="field" id="pText" placeholder="# 학습 1. 큰 제목 (109쪽)&#10;(1) *핵심어*가 들어간 내용&#10;※ 빨간 보충&#10;왼쪽 개념 | 오른쪽 개념">' + esc(L.text || '') + '</textarea>' +
    '<div class="ins-row"><button class="mini" data-p="red">핵심어(빨강·빈칸)</button><button class="mini" data-p="cmp">두 칸 비교</button><button class="mini" data-p="brk">화면 넘김</button>' +
    '<button class="mini" data-p="b-photo">＋ 사진</button><button class="mini" data-p="b-video">＋ 중간 영상</button><button class="mini" data-p="b-link">＋ 기사</button></div>' +
    '<div class="pick" id="pBoardPick"></div>' +
    '<div class="rule"><code># 학습 1. 제목 (109쪽)</code> 큰 제목 — 새 화면에서 시작하고 끝의 (109쪽)은 쪽수 배지가 됩니다. ' +
    '<code>1.</code> <code>(1)</code> <code>①</code> 번호 단계 — 아래에 더 깊은 번호가 딸려 있으면 소제목, 없으면 내용 줄. ' +
    '<code>*글자*</code> 핵심어 — 수업 중 "빈칸"을 켜면 빈칸으로 먼저 나옵니다. <code>※</code> 빨간 보충, <code>-</code> 회색 작은 글씨. ' +
    '<code>왼쪽 | 오른쪽</code> 두 칸 비교(첫 줄은 칸 제목). <code>---</code> 화면 넘김. 사진·영상·기사는 커서가 있는 줄 다음에 작은 카드로 들어갑니다.</div>' +
    '<div id="pBoardMedia"></div>' +
    '</div></div>' +

    '<div class="blk"><div class="blk-h"><em>3</em>마무리 영상<small>이 단원 영상에서 고르기</small></div><div class="blk-b">' +
    '<div id="pEnd"></div>' +
    '<div class="ins-row"><button class="mini" data-p="e-video">＋ 유튜브 주소로 추가</button></div>' +
    '<div class="pick" id="pEndPick"></div>' +
    '</div></div>' +

    '<div class="prep-foot">' + (isNew ? '' : '<button class="mini danger" data-p="delete">차시 삭제</button>') +
    '<span class="sp"></span><button class="btn" data-p="cancel">나가기</button><button class="btn main" data-p="save">저장</button></div>' +
    '<input type="file" id="pFile" accept="image/*" multiple hidden>' +
    '</div>';
  paintTopic(); paintBoardMedia(); paintEnd();
  root().scrollTop = 0;
  if (isNew) q('#pTitle').focus();
}

// 영상 목록을 뒤늦게 불러왔을 때 마무리 영상 칸을 다시 그림
export function prepVideosLoaded() {
  if (!d) return;
  const base = d.isNew ? videosOf(d.at.gi, d.at.mi, d.at.si) : endVideos(d.lesson);
  base.forEach(function (v) { if (d.endIds.indexOf(v.id) === -1) d.endIds.push(v.id); });
  paintEnd();
}

// ── 목록 그리기
function thumbHtml(p, kind, i) {
  return '<div class="pthumb"><img src="' + esc(p.thumb || '') + '" alt="">' +
    '<input data-cap="' + kind + '" data-i="' + i + '" value="' + esc(p.caption || '') + '" placeholder="사진 설명">' +
    '<button class="x" data-p="' + kind + '-del-photo" data-i="' + i + '" aria-label="사진 빼기">×</button></div>';
}
function rowHtml(label, act, i) {
  return '<div class="prow"><span>' + label + '</span><button class="x" data-p="' + act + '" data-i="' + i + '" aria-label="빼기">×</button></div>';
}
function vById(id) { return state.videos.find(function (v) { return v.id === id; }); }

function paintTopic() {
  const t = d.topic;
  let h = '';
  if (t.photos.length) h += '<div class="pthumbs">' + t.photos.map(function (p, i) { return thumbHtml(p, 't', i); }).join('') + '</div>';
  h += t.links.map(function (l, i) { return rowHtml('기사 · ' + esc(l.title || l.url), 't-del-link', i); }).join('');
  h += t.videoIds.map(function (id, i) { const v = vById(id); return v ? rowHtml('영상 · ' + esc(v.title), 't-del-video', i) : ''; }).join('');
  q('#pTopicMedia').innerHTML = h;
}

function paintBoardMedia() {
  if (!d.photos.length && !d.links.length) { q('#pBoardMedia').innerHTML = ''; return; }
  q('#pBoardMedia').innerHTML = '<div class="pmini-t">판서에 쓰는 사진·기사 <small>설명을 고치면 판서 글도 함께 바뀝니다</small></div>' +
    (d.photos.length ? '<div class="pthumbs">' + d.photos.map(function (p, i) { return thumbHtml(p, 'b', i); }).join('') + '</div>' : '') +
    d.links.map(function (l, i) { return rowHtml('기사 · ' + esc(l.title || l.url), 'b-del-link', i); }).join('');
}

function paintEnd() {
  const vids = videosOf(d.at.gi, d.at.mi, d.at.si);
  d.endListed = vids.map(function (v) { return v.id; });
  q('#pEnd').innerHTML = vids.length
    ? '<div class="pmini-t">체크한 영상이 수업 마지막에 나옵니다. 오른쪽 칸에 길이를 적으면 영상 모음에도 함께 저장돼요.</div>' + vids.map(function (v) {
      return '<div class="vrow"><label><input type="checkbox" data-end="' + esc(v.id) + '"' + (d.endIds.indexOf(v.id) !== -1 ? ' checked' : '') + '>' +
        (v.videoId ? '<img src="https://img.youtube.com/vi/' + esc(v.videoId) + '/default.jpg" alt="">' : '<i class="ebs">EBS</i>') +
        '<span>' + esc(v.title) + '</span></label>' +
        '<input class="dur" data-dur="' + esc(v.id) + '" value="' + esc(v.duration || '') + '" placeholder="길이" aria-label="영상 길이" inputmode="numeric"></div>';
    }).join('')
    : '<div class="pmini-t">이 단원에 등록된 영상이 없어요. 유튜브 주소로 추가하면 영상 모음에도 등록됩니다.</div>';
}

// ── 고르기 칸
function videoPick(box, mode) {
  const vids = videosOf(d.at.gi, d.at.mi, d.at.si);
  box.innerHTML = '<div class="pick-t">유튜브 주소를 넣으면 영상 모음에도 함께 등록됩니다</div>' +
    '<input class="field" data-in="vurl" placeholder="https://youtu.be/…">' +
    '<div class="pick-row"><input class="field" data-in="vtitle" placeholder="영상 제목 (비우면 자동으로 가져옵니다)">' +
    '<input class="field dur" data-in="vdur" placeholder="길이 2:00" inputmode="numeric"><button class="btn" data-p="v-add" data-mode="' + mode + '">추가</button></div>' +
    (mode !== 'end' && vids.length ? '<div class="pick-t">또는 이 단원에 이미 있는 영상</div>' +
      vids.map(function (v) {
        return '<button class="pick-i" data-p="v-pick" data-mode="' + mode + '" data-id="' + esc(v.id) + '">' + esc(v.title) + (v.duration ? ' (' + esc(v.duration) + ')' : '') + '</button>';
      }).join('') : '') +
    '<button class="pick-close" data-p="pick-close">닫기</button>';
  box.querySelector('[data-in="vurl"]').focus();
}
function linkPick(box, mode) {
  box.innerHTML = '<div class="pick-t">기사 주소와 화면에 보일 제목을 넣어 주세요</div>' +
    '<input class="field" data-in="lurl" placeholder="https://…">' +
    '<div class="pick-row"><input class="field" data-in="ltitle" placeholder="기사 제목"><button class="btn" data-p="l-add" data-mode="' + mode + '">추가</button></div>' +
    (mode === 'board' && d.links.length ? '<div class="pick-t">또는 이미 넣어 둔 기사</div>' +
      d.links.map(function (l, i) { return '<button class="pick-i" data-p="l-pick" data-i="' + i + '">' + esc(l.title || l.url) + '</button>'; }).join('') : '') +
    '<button class="pick-close" data-p="pick-close">닫기</button>';
  box.querySelector('[data-in="lurl"]').focus();
}
function photoPick(box) {
  box.innerHTML = '<button class="pick-i new" data-p="b-upload">＋ 새 사진 올리기</button>' +
    (d.photos.length ? '<div class="pick-t">또는 이미 올린 사진을 한 번 더</div>' +
      d.photos.map(function (p, i) { return '<button class="pick-i" data-p="b-pick-photo" data-i="' + i + '">' + esc(p.caption) + '</button>'; }).join('') : '') +
    '<button class="pick-close" data-p="pick-close">닫기</button>';
}

// ── 사진 올리기
async function upload(files, target) {
  const list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
  if (!list.length) { toast('사진 파일만 넣을 수 있어요'); return; }
  const bin = target === 'board' ? d.photos : d.topic.photos;
  for (let i = 0; i < list.length; i++) {
    toast('사진 올리는 중… (' + (i + 1) + '/' + list.length + ')');
    try {
      const p = await fileToPhoto(list[i], bin);
      if (!d) return;
      bin.push(p);
      d.newIds.push(p.id);
      mark();
      if (target === 'board') insertLine(q('#pText'), '[사진] ' + p.caption);
    } catch (e) { console.error(e); toast('사진 올리기 실패: ' + e.message); break; }
  }
  if (target === 'board') { paintBoardMedia(); q('#pBoardPick').innerHTML = ''; } else paintTopic();
  toast(target === 'board' ? '판서에 사진을 넣었어요' : '인트로에 사진을 넣었어요');
}

// 판서 글에서 [사진] 줄 이름 바꾸기·지우기
//   두 칸 비교 줄 안의 칸도 함께 처리
function renameLines(kind, oldName, newName) {
  const ta = q('#pText');
  const hit = function (cell) {
    const m = /^\s*\[(사진|영상|기사)\]\s*(.+?)\s*$/.exec(cell);
    return !!(m && m[1] === kind && m[2] === oldName);
  };
  ta.value = ta.value.split('\n').map(function (line) {
    if (line.indexOf('|') === -1) {
      if (!hit(line)) return line;
      return newName === null ? null : '[' + kind + '] ' + newName;
    }
    return line.split('|').map(function (c) {
      if (!hit(c)) return c;
      return newName === null ? ' ' : ' [' + kind + '] ' + newName + ' ';
    }).join('|');
  }).filter(function (x) { return x !== null; }).join('\n');
}

// ── 저장 · 나가기 · 삭제
async function save() {
  if (d.busy) return;
  const title = q('#pTitle').value.trim();
  if (!title) { toast('차시 제목을 넣어 주세요'); q('#pTitle').focus(); return; }
  const data = {
    no: q('#pNo').value.trim(),
    title: title,
    page: q('#pPage').value.trim().replace(/쪽$/, ''),
    text: q('#pText').value.replace(/\r/g, ''),
    photos: d.photos,
    links: d.links,
    topic: { q: q('#pQ').value.trim(), memo: q('#pMemo').value.trim(), goals: q('#pGoals').value.trim(), page: q('#pTPage').value.trim().replace(/쪽$/, ''), photos: d.topic.photos, links: d.topic.links, videoIds: d.topic.videoIds },
    // 체크를 끈 영상만 기억 (나중에 영상 모음에 추가한 영상은 자동으로 마무리에 나옴)
    //   화면에 보였던 영상만 판단하고, 아직 못 불러온 영상은 예전 설정을 그대로 둠
    endHideIds: ((d.lesson && d.lesson.endHideIds) || []).filter(function (id) { return d.endListed.indexOf(id) === -1; })
      .concat(d.endListed.filter(function (id) { return d.endIds.indexOf(id) === -1; })),
    endVideoIds: []
  };
  const miss = unmatched(Object.assign({}, d.at, data));
  if (miss.length && !(await confirmBox('판서에서 찾을 수 없는 자료 줄이 있어요: ' + miss.join(', ') + ' — 이 줄은 수업 때 건너뜁니다. 그대로 저장할까요?', '저장'))) return;
  d.busy = true;
  try {
    let saved;
    if (d.isNew) {
      saved = await store.addLesson(Object.assign({ gi: d.at.gi, mi: d.at.mi, si: d.at.si }, data));
      state.lessons.push(saved);
    } else {
      await store.updateLesson(d.lesson.id, data);
      Object.assign(d.lesson, data);
      saved = d.lesson;
    }
    d.removedIds.forEach(function (id) { store.removePhoto(id).catch(function () {}); });
    d = null;
    toast('저장했어요');
    exitFn(saved, 'saved');
  } catch (e) {
    d.busy = false;
    toast('저장 실패: ' + e.message);
  }
}

async function leave() {
  if (d.dirty && !(await confirmBox('저장하지 않고 나갈까요? 고친 내용은 사라집니다.', '나가기'))) return;
  d.newIds.forEach(function (id) { store.removePhoto(id).catch(function () {}); });
  const l = d.lesson;
  d = null;
  exitFn(l, 'cancel');
}

async function removeIt() {
  if (!(await confirmBox('"' + d.lesson.title + '" 차시를 삭제할까요? 인트로·판서 사진과 기사도 함께 지워집니다.', '삭제'))) return;
  try {
    const all = d.photos.concat(d.topic.photos, d.lesson.photos || [], topicOf(d.lesson).photos);
    const seen = {};
    await store.removeLesson({ id: d.lesson.id, photos: all.filter(function (p) { if (seen[p.id]) return false; seen[p.id] = 1; return true; }) });
    state.lessons = state.lessons.filter(function (l) { return l.id !== d.lesson.id; });
    d = null;
    toast('삭제했어요');
    exitFn(null, 'deleted');
  } catch (e) { toast('삭제 실패: ' + e.message); }
}

// ── 이벤트 (한 번만 연결)
export function initPrep() {
  const r = root();

  r.addEventListener('input', function (e) { if (e.target.closest('.prep-in')) mark(); });

  r.addEventListener('change', function (e) {
    const t = e.target;
    if (!d) return;
    if (t.hasAttribute('data-end')) {
      const id = t.getAttribute('data-end');
      d.endIds = d.endIds.filter(function (x) { return x !== id; });
      if (t.checked) d.endIds.push(id);
      mark();
      return;
    }
    if (t.hasAttribute('data-dur')) {
      const v = vById(t.getAttribute('data-dur'));
      if (!v) return;
      setDuration(v, t.value).then(function (dur) { t.value = dur; toast(dur ? '길이 ' + dur + ' 저장했어요' : '길이를 지웠어요'); })
        .catch(function (err) { t.value = v.duration || ''; toast(err.message); });
      return;
    }
    if (t.id === 'pFile') { upload(t.files, d.fileTarget); t.value = ''; return; }
    const kind = t.getAttribute('data-cap');
    if (kind) {
      const bin = kind === 'b' ? d.photos : d.topic.photos;
      const i = +t.getAttribute('data-i');
      const oldName = bin[i].caption;
      const name = t.value.trim();
      if (!name) { t.value = oldName; toast('사진 설명은 비워 둘 수 없어요'); return; }
      if (bin.some(function (p, k) { return k !== i && p.caption === name; })) { t.value = oldName; toast('같은 설명의 사진이 이미 있어요'); return; }
      bin[i] = Object.assign({}, bin[i], { caption: name });
      if (kind === 'b') renameLines('사진', oldName, name);
      mark();
    }
  });

  r.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-p]');
    if (!b || !d) return;
    const a = b.getAttribute('data-p');
    const i = +b.getAttribute('data-i');
    const ta = q('#pText');
    if (a === 'save') return save();
    if (a === 'cancel') return leave();
    if (a === 'delete') return removeIt();
    if (a === 'pick-close') { b.closest('.pick').innerHTML = ''; return; }

    // 인트로
    if (a === 't-photo') { d.fileTarget = 'topic'; q('#pFile').click(); return; }
    if (a === 't-link') return linkPick(q('#pTopicPick'), 'topic');
    if (a === 't-video') return videoPick(q('#pTopicPick'), 'topic');
    if (a === 't-del-photo') { d.removedIds.push(d.topic.photos[i].id); d.topic.photos.splice(i, 1); mark(); return paintTopic(); }
    if (a === 't-del-link') { d.topic.links.splice(i, 1); mark(); return paintTopic(); }
    if (a === 't-del-video') { d.topic.videoIds.splice(i, 1); mark(); return paintTopic(); }

    // 판서
    if (a === 'red') {
      const s = ta.selectionStart, en = ta.selectionEnd;
      if (s === en) { toast('강조할 글자를 먼저 선택해 주세요'); ta.focus(); return; }
      ta.value = ta.value.slice(0, s) + '*' + ta.value.slice(s, en) + '*' + ta.value.slice(en);
      ta.focus(); ta.setSelectionRange(en + 2, en + 2); mark();
      return;
    }
    if (a === 'cmp') { insertLine(ta, '왼쪽 제목 | 오른쪽 제목\n왼쪽 내용 | 오른쪽 내용'); mark(); toast('두 칸 비교 줄을 넣었어요. 글자를 바꿔 쓰세요'); return; }
    if (a === 'brk') { insertLine(ta, '---'); mark(); return; }
    if (a === 'b-photo') return photoPick(q('#pBoardPick'));
    if (a === 'b-upload') { d.fileTarget = 'board'; q('#pFile').click(); return; }
    if (a === 'b-pick-photo') { insertLine(ta, '[사진] ' + d.photos[i].caption); q('#pBoardPick').innerHTML = ''; mark(); return; }
    if (a === 'b-video') return videoPick(q('#pBoardPick'), 'board');
    if (a === 'b-link') return linkPick(q('#pBoardPick'), 'board');
    if (a === 'l-pick') { insertLine(ta, '[기사] ' + (d.links[i].title || d.links[i].url)); q('#pBoardPick').innerHTML = ''; mark(); return; }
    if (a === 'b-del-photo') {
      const p = d.photos[i];
      d.removedIds.push(p.id); d.photos.splice(i, 1);
      renameLines('사진', p.caption, null); mark(); paintBoardMedia();
      toast('사진과 판서의 그 줄을 뺐어요');
      return;
    }
    if (a === 'b-del-link') {
      const l = d.links[i];
      d.links.splice(i, 1);
      renameLines('기사', l.title || l.url, null); mark(); paintBoardMedia();
      return;
    }

    // 마무리 영상
    if (a === 'e-video') return videoPick(q('#pEndPick'), 'end');

    // 고르기 칸 안의 버튼
    const mode = b.getAttribute('data-mode');
    const box = b.closest('.pick');
    if (a === 'l-add') {
      const url = safeUrl(box.querySelector('[data-in="lurl"]').value);
      const title = box.querySelector('[data-in="ltitle"]').value.trim();
      if (!url) { toast('http 또는 https로 시작하는 주소를 넣어 주세요'); return; }
      if (!title) { toast('기사 제목을 넣어 주세요'); return; }
      if (mode === 'topic') { d.topic.links.push({ url: url, title: title }); paintTopic(); }
      else { d.links.push({ url: url, title: title }); insertLine(ta, '[기사] ' + title); paintBoardMedia(); }
      box.innerHTML = ''; mark();
      return;
    }
    if (a === 'v-pick' || a === 'v-add') {
      let v;
      if (a === 'v-pick') v = vById(b.getAttribute('data-id'));
      else {
        b.disabled = true;
        try {
          v = await addYoutube(box.querySelector('[data-in="vurl"]').value, box.querySelector('[data-in="vtitle"]').value, d.at, box.querySelector('[data-in="vdur"]').value);
        } catch (err) { b.disabled = false; toast(err.message); return; }
      }
      if (!v || !d) return;
      if (mode === 'topic') { if (d.topic.videoIds.indexOf(v.id) === -1) d.topic.videoIds.push(v.id); paintTopic(); }
      else if (mode === 'board') insertLine(ta, '[영상] ' + v.title);
      else if (d.endIds.indexOf(v.id) === -1) d.endIds.push(v.id);
      paintEnd();
      box.innerHTML = ''; mark();
      toast(a === 'v-add' ? '영상을 넣었어요' : '넣었어요');
    }
  });

  // 끌어다 놓기: 인트로 칸에 놓으면 인트로, 판서 칸에 놓으면 판서
  r.addEventListener('dragover', function (e) { if (d) e.preventDefault(); });
  r.addEventListener('drop', function (e) {
    if (!d || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    const blk = e.target.closest('[data-blk]');
    upload(e.dataTransfer.files, blk && blk.getAttribute('data-blk') === 'board' ? 'board' : 'topic');
  });

  // 붙여넣기: 판서 글 상자면 판서, 그 밖은 인트로
  document.addEventListener('paste', function (e) {
    if (state.view !== 'prep' || !d) return;
    const files = (e.clipboardData && e.clipboardData.files) || [];
    if (!files.length) return;
    e.preventDefault();
    upload(files, e.target && e.target.id === 'pText' ? 'board' : 'topic');
  });
}

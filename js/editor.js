// 편집: 편집 켜고 끄기, 차시 추가·수정·삭제
// 판서 고치기 화면 안에서 사진·영상·기사를 바로 올리고 원하는 줄에 끼워 넣습니다.
import { state, changed, lessonsOf, videosOf } from './state.js';
import * as store from './store.js';
import { fileToPhoto } from './photo.js';
import { esc, safeUrl, toast, openModal, closeModal, confirmBox } from './ui.js';

const KEY = 'lessonEditOn';

// 이 창에서 이미 편집을 켰다면 유지
export function restoreEdit() {
  try { if (sessionStorage.getItem(KEY) === '1') state.edit = true; } catch (e) { /* 무시 */ }
}

export function toggleEdit() {
  state.edit = !state.edit;
  try { state.edit ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
  changed();
  toast(state.edit ? '편집을 켰어요' : '편집을 껐어요');
}

// 글 상자의 지금 줄 다음에 새 줄 넣기
function insertLine(ta, line) {
  const v = ta.value;
  let end = v.indexOf('\n', ta.selectionStart);
  if (end === -1) end = v.length;
  const before = v.slice(0, end);
  const add = (before && before.slice(-1) !== '\n' ? '\n' : '') + line;
  ta.value = before + add + v.slice(end);
  const pos = (before + add).length;
  ta.focus();
  ta.setSelectionRange(pos, pos);
}

function youtubeId(url) {
  const pats = [/youtu\.be\/([^?&\s/]+)/, /[?&]v=([^&\s]+)/, /shorts\/([^?/\s]+)/, /embed\/([^?/\s]+)/];
  for (let i = 0; i < pats.length; i++) { const m = String(url).match(pats[i]); if (m) return m[1]; }
  return null;
}

// 유튜브에서 영상 제목 가져오기 (안 되면 빈 글자)
async function fetchTitle(id) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 4000);
    const res = await fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id), { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return '';
    const j = await res.json();
    return String(j.title || '').trim();
  } catch (e) { return ''; }
}

// 차시 추가(lesson 없음) 또는 수정
export function openLessonEditor(lesson, where) {
  const isNew = !lesson;
  const at = isNew ? where : { gi: lesson.gi, mi: lesson.mi, si: lesson.si };
  const nextNo = isNew
    ? ('0' + (lessonsOf(at.gi, at.mi, at.si).length + 1)).slice(-2)
    : (lesson.no || '');
  // 이 화면에서 올린 자료는 '저장'을 눌러야 차시에 붙습니다.
  let photos = isNew ? [] : (lesson.photos || []).slice();
  let links = isNew ? [] : (lesson.links || []).slice();
  const newPhotoIds = [];

  const sheet = openModal(
    '<h2>' + (isNew ? '차시 추가' : '판서 고치기') + '</h2>' +
    '<div class="row3"><div><label class="field-label">번호</label><input class="field" id="leNo" value="' + esc(nextNo) + '"></div>' +
    '<div><label class="field-label">차시 제목</label><input class="field" id="leTitle" value="' + esc(isNew ? '' : lesson.title) + '" placeholder="예: 북한을 이해하려면"></div>' +
    '<div><label class="field-label">교과서 쪽</label><input class="field" id="lePage" value="' + esc(isNew ? '' : (lesson.page || '')) + '" placeholder="148~151"></div></div>' +
    '<label class="field-label">판서 내용 — 한 줄이 한 번 누를 때 나타납니다</label>' +
    '<textarea class="field" id="leText" placeholder="(1) 소제목&#10;① *핵심어*가 들어간 내용">' + esc(isNew ? '' : lesson.text) + '</textarea>' +
    '<div class="ins-row"><button class="mini" data-ins="red">빨간 강조</button>' +
    '<button class="mini" data-ins="사진">사진 넣기</button><button class="mini" data-ins="영상">영상 넣기</button>' +
    '<button class="mini" data-ins="기사">기사 넣기</button></div>' +
    '<div class="pick" id="lePick"></div><input type="file" id="leFile" accept="image/*" multiple hidden>' +
    '<div class="rule"><code>(1)</code> <code>1.</code> <code>#</code> 으로 시작하면 소제목, <code>-</code> 로 시작하면 작은 글씨, <code>*글자*</code> 는 빨간 강조입니다. 사진·영상·기사는 커서가 있는 줄 다음에 들어가고, 수업 때 그 순서에 나타납니다. 복사한 사진은 글 상자에 붙여넣기만 해도 됩니다.</div>' +
    '<div class="sheet-btns">' + (isNew ? '' : '<button class="btn" id="leDel">차시 삭제</button>') +
    '<span class="sp"></span><button class="btn" id="leCancel">취소</button><button class="btn main" id="leOk">저장</button></div>',
    true
  );
  const ta = sheet.querySelector('#leText');
  const pick = sheet.querySelector('#lePick');
  const fileInput = sheet.querySelector('#leFile');
  if (isNew) sheet.querySelector('#leTitle').focus();

  async function uploadPhotos(files) {
    const list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!list.length) { toast('사진 파일만 넣을 수 있어요'); return; }
    for (let i = 0; i < list.length; i++) {
      toast('사진 올리는 중… (' + (i + 1) + '/' + list.length + ')');
      try {
        const photo = await fileToPhoto(list[i], photos);
        photos.push(photo);
        newPhotoIds.push(photo.id);
        insertLine(ta, '[사진] ' + photo.caption);
      } catch (e) { console.error(e); toast('사진 올리기 실패: ' + e.message); return; }
    }
    toast('사진을 넣었어요. 사진 설명은 저장한 뒤 "자료" 탭에서 고칠 수 있어요');
    pick.innerHTML = '';
  }

  function showPick(kind) {
    let h = '';
    if (kind === '사진') {
      h = '<button class="pick-i new" data-do="upload">＋ 새 사진 올리기</button>' +
        photos.map(function (p) { return '<button class="pick-i" data-line="[사진] ' + esc(p.caption) + '">' + esc(p.caption) + '</button>'; }).join('');
    } else if (kind === '영상') {
      const vids = videosOf(at.gi, at.mi, at.si);
      h = '<div class="pick-t">유튜브 주소를 붙여넣으면 영상 모음에도 함께 등록됩니다</div>' +
        '<input class="field" id="pvUrl" placeholder="https://youtu.be/…">' +
        '<div class="pick-row"><input class="field" id="pvTitle" placeholder="영상 제목 (비우면 자동으로 가져옵니다)"><button class="btn" data-do="add-video">추가</button></div>' +
        (vids.length ? '<div class="pick-t">또는 이 단원에 이미 있는 영상</div>' : '') +
        vids.map(function (v) {
          return '<button class="pick-i" data-line="[영상] ' + esc(v.title) + '">' + esc(v.title) + (v.duration ? ' (' + esc(v.duration) + ')' : '') + '</button>';
        }).join('');
    } else {
      h = '<div class="pick-t">기사 주소와 화면에 보일 제목을 넣어 주세요</div>' +
        '<input class="field" id="pkUrl" placeholder="https://…">' +
        '<div class="pick-row"><input class="field" id="pkTitle" placeholder="기사 제목"><button class="btn" data-do="add-link">추가</button></div>' +
        (links.length ? '<div class="pick-t">또는 이미 넣어 둔 기사</div>' : '') +
        links.map(function (l) { const n = l.title || l.url; return '<button class="pick-i" data-line="[기사] ' + esc(n) + '">' + esc(n) + '</button>'; }).join('');
    }
    pick.innerHTML = h;
  }

  // 넣기 버튼
  sheet.querySelector('.ins-row').addEventListener('click', function (e) {
    const kind = e.target.getAttribute('data-ins');
    if (!kind) return;
    if (kind === 'red') {
      const a = ta.selectionStart, b = ta.selectionEnd;
      if (a === b) { toast('강조할 글자를 먼저 선택해 주세요'); ta.focus(); return; }
      ta.value = ta.value.slice(0, a) + '*' + ta.value.slice(a, b) + '*' + ta.value.slice(b);
      ta.focus(); ta.setSelectionRange(b + 2, b + 2);
      return;
    }
    showPick(kind);
  });

  pick.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-line],[data-do]');
    if (!b) return;
    const act = b.getAttribute('data-do');
    if (!act) { insertLine(ta, b.getAttribute('data-line')); pick.innerHTML = ''; return; }
    if (act === 'upload') { fileInput.click(); return; }
    if (act === 'add-link') {
      const url = safeUrl(pick.querySelector('#pkUrl').value);
      const title = pick.querySelector('#pkTitle').value.trim();
      if (!url) { toast('http 또는 https로 시작하는 주소를 넣어 주세요'); return; }
      if (!title) { toast('기사 제목을 넣어 주세요'); return; }
      links.push({ url: url, title: title });
      insertLine(ta, '[기사] ' + title);
      pick.innerHTML = '';
      return;
    }
    if (act === 'add-video') {
      const url = pick.querySelector('#pvUrl').value.trim();
      const id = youtubeId(url);
      if (!id) { toast('유튜브 주소만 넣을 수 있어요. 다른 영상은 "영상 모음"에서 추가해 주세요'); return; }
      const dup = videosOf(at.gi, at.mi, at.si).find(function (v) { return v.videoId === id; });
      if (dup) { insertLine(ta, '[영상] ' + dup.title); pick.innerHTML = ''; toast('이미 등록된 영상이라 그대로 넣었어요'); return; }
      b.disabled = true;
      let title = pick.querySelector('#pvTitle').value.trim();
      if (!title) title = await fetchTitle(id);
      if (!title) { b.disabled = false; toast('제목을 자동으로 가져오지 못했어요. 제목을 직접 넣어 주세요'); return; }
      try {
        const v = await store.addVideo({ gi: at.gi, mi: at.mi, si: at.si, type: 'youtube', url: url, title: title, duration: '', durSec: 99999, videoId: id });
        state.videos.push(v);
        insertLine(ta, '[영상] ' + title);
        pick.innerHTML = '';
        toast('영상을 등록하고 판서에 넣었어요');
      } catch (err) { b.disabled = false; toast('영상 등록 실패: ' + err.message); }
    }
  });

  fileInput.addEventListener('change', function () { uploadPhotos(fileInput.files); fileInput.value = ''; });
  ta.addEventListener('paste', function (e) {
    const files = (e.clipboardData && e.clipboardData.files) || [];
    if (files.length) { e.preventDefault(); uploadPhotos(files); }
  });

  sheet.querySelector('#leCancel').onclick = function () {
    // 저장하지 않고 닫으면 이 화면에서 올린 사진은 지움
    newPhotoIds.forEach(function (id) { store.removePhoto(id).catch(function () {}); });
    closeModal();
  };

  sheet.querySelector('#leOk').onclick = async function () {
    const data = {
      no: sheet.querySelector('#leNo').value.trim(),
      title: sheet.querySelector('#leTitle').value.trim(),
      page: sheet.querySelector('#lePage').value.trim().replace(/쪽$/, ''),
      text: ta.value.replace(/\r/g, ''),
      photos: photos,
      links: links
    };
    if (!data.title) { toast('차시 제목을 넣어 주세요'); return; }
    try {
      if (isNew) {
        const made = await store.addLesson(Object.assign({ gi: at.gi, mi: at.mi, si: at.si }, data));
        state.lessons.push(made);
        state.sel = { gi: at.gi, mi: at.mi, si: at.si, lessonId: made.id };
        state.view = 'lesson';
      } else {
        await store.updateLesson(lesson.id, data);
        Object.assign(lesson, data);
      }
      closeModal();
      state.tab = 'board';
      changed();
      toast('저장했어요');
    } catch (e) { toast('저장 실패: ' + e.message); }
  };

  if (!isNew) {
    sheet.querySelector('#leDel').onclick = async function () {
      if (!(await confirmBox('"' + lesson.title + '" 차시를 삭제할까요? 사진과 기사 링크도 함께 지워집니다.', '삭제'))) return;
      try {
        lesson.photos = photos; // 방금 올린 사진까지 함께 지움
        await store.removeLesson(lesson);
        state.lessons = state.lessons.filter(function (l) { return l.id !== lesson.id; });
        const rest = lessonsOf(lesson.gi, lesson.mi, lesson.si);
        state.sel.lessonId = rest.length ? rest[0].id : null;
        changed();
        toast('삭제했어요');
      } catch (e) { toast('삭제 실패: ' + e.message); }
    };
  }
}

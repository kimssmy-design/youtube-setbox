// 자료 탭: 사진(끌어다 놓기·붙여넣기)과 기사 링크
import { state, changed, curLesson } from './state.js';
import * as store from './store.js';
import { fileToPhoto } from './photo.js';
import { esc, safeUrl, toast, openModal, closeModal, confirmBox, isModalOpen } from './ui.js';

async function addPhotoFiles(files) {
  const lesson = curLesson();
  if (!lesson || !state.edit) return;
  const list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
  if (!list.length) { toast('사진 파일만 넣을 수 있어요'); return; }
  let added = 0;
  for (let i = 0; i < list.length; i++) {
    toast('사진 저장 중… (' + (i + 1) + '/' + list.length + ')');
    try {
      const photo = await fileToPhoto(list[i], lesson.photos || []);
      const photos = (lesson.photos || []).concat([photo]);
      await store.updateLesson(lesson.id, { photos: photos });
      lesson.photos = photos;
      added++;
    } catch (e) {
      console.error(e);
      toast('사진 저장 실패: ' + e.message);
    }
  }
  if (added) toast('사진 ' + added + '장을 저장했어요');
  changed();
}

// ── 그리기
export function renderFiles(el, lesson) {
  const photos = lesson.photos || [];
  const links = lesson.links || [];
  let h = '<div class="sec">사진' + (state.edit ? ' <small>끌어다 놓기·붙여넣기(Ctrl+V) 가능. 판서 중간에 넣으려면 "판서 고치기 → 사진 넣기"</small>' : '') + '</div><div class="grid">';
  photos.forEach(function (p, i) {
    h += '<div class="card">' +
      (state.edit ? '<button class="del" data-act="del-photo" data-i="' + i + '" title="삭제">×</button>' : '') +
      '<button class="card" style="border:none;border-radius:0" data-act="view-photo" data-i="' + i + '">' +
      '<div class="ph"><img src="' + esc(p.thumb || '') + '" alt=""></div></button>' +
      '<div class="cap">' + (state.edit
        ? '<input data-act="cap" data-i="' + i + '" value="' + esc(p.caption || '') + '" placeholder="사진 설명">'
        : esc(p.caption || '')) + '</div></div>';
  });
  if (state.edit) {
    h += '<button class="add" id="dropZone" data-act="pick-photo">＋ 사진 추가<br>(눌러서 고르거나 끌어다 놓기)</button>';
  } else if (!photos.length) {
    h += '<div class="hint" style="margin:0">등록된 사진이 없어요.</div>';
  }
  h += '</div><div class="sec">기사</div><div class="grid">';
  links.forEach(function (l, i) {
    h += '<div class="card">' +
      (state.edit ? '<button class="del" data-act="del-link" data-i="' + i + '" title="삭제">×</button>' : '') +
      '<a class="card" style="border:none;border-radius:0" href="' + esc(safeUrl(l.url)) + '" target="_blank" rel="noopener">' +
      '<div class="cap">' + esc(l.title || l.url) + '<small>' + esc(l.url) + '</small></div></a></div>';
  });
  if (state.edit) {
    h += '<button class="add" style="min-height:76px" data-act="add-link">＋ 기사 링크 추가</button>';
  } else if (!links.length) {
    h += '<div class="hint" style="margin:0">등록된 기사가 없어요.</div>';
  }
  h += '</div><input type="file" id="photoInput" accept="image/*" multiple hidden>';
  el.innerHTML = h;

  const input = el.querySelector('#photoInput');
  input.addEventListener('change', function () { addPhotoFiles(input.files); input.value = ''; });
  const zone = el.querySelector('#dropZone');
  if (zone) {
    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); });
    });
    zone.addEventListener('dragleave', function () { zone.classList.remove('over'); });
  }
}

// ── 크게 보기
let viewIdx = 0;
async function showPhoto(i) {
  const lesson = curLesson();
  const photos = (lesson && lesson.photos) || [];
  if (!photos.length) return;
  viewIdx = (i + photos.length) % photos.length;
  const p = photos[viewIdx];
  const v = document.getElementById('viewer');
  v.innerHTML = '<button class="v-close" data-v="close" aria-label="닫기">×</button>' +
    (photos.length > 1 ? '<button class="v-nav prev" data-v="prev" aria-label="이전 사진">‹</button><button class="v-nav next" data-v="next" aria-label="다음 사진">›</button>' : '') +
    '<img src="' + esc(p.thumb || '') + '" alt=""><div class="v-cap">' + esc(p.caption || '') + '</div>';
  v.classList.add('open');
  v.setAttribute('data-kind', 'photo');
  const want = viewIdx;
  try {
    const full = await store.getPhoto(p.id);
    if (full && want === viewIdx && v.classList.contains('open')) v.querySelector('img').src = full;
  } catch (e) { console.warn('큰 사진 불러오기 실패', e); }
}
export function viewerNav(n) { showPhoto(viewIdx + n); }

function openLinkForm() {
  const sheet = openModal(
    '<h2>기사 링크 추가</h2>' +
    '<label class="field-label">기사 주소</label><input class="field" id="lkUrl" placeholder="https://…">' +
    '<label class="field-label">화면에 보일 제목</label><input class="field" id="lkTitle" placeholder="예: 이산가족 생존자 현황">' +
    '<div class="sheet-btns"><span class="sp"></span><button class="btn" id="lkNo">취소</button><button class="btn main" id="lkOk">저장</button></div>'
  );
  sheet.querySelector('#lkNo').onclick = closeModal;
  sheet.querySelector('#lkOk').onclick = async function () {
    const url = safeUrl(sheet.querySelector('#lkUrl').value);
    const title = sheet.querySelector('#lkTitle').value.trim();
    if (!url) { toast('http 또는 https로 시작하는 주소를 넣어 주세요'); return; }
    const lesson = curLesson();
    const links = (lesson.links || []).concat([{ url: url, title: title }]);
    try {
      await store.updateLesson(lesson.id, { links: links });
      lesson.links = links;
      closeModal();
      changed();
    } catch (e) { toast('저장 실패: ' + e.message); }
  };
}

// ── 이벤트 연결 (한 번만)
export function initFiles(stage) {
  stage.addEventListener('click', async function (e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    const i = +t.getAttribute('data-i');
    const lesson = curLesson();
    if (!lesson) return;
    if (act === 'view-photo') { showPhoto(i); return; } // 자료 탭과 판서 중간 사진 모두
    if (state.tab !== 'files') return;
    if (act === 'pick-photo') stage.querySelector('#photoInput').click();
    else if (act === 'add-link') openLinkForm();
    else if (act === 'del-photo') {
      if (!(await confirmBox('이 사진을 삭제할까요?', '삭제'))) return;
      const p = lesson.photos[i];
      const photos = lesson.photos.filter(function (_, k) { return k !== i; });
      try {
        await store.updateLesson(lesson.id, { photos: photos });
        lesson.photos = photos;
        await store.removePhoto(p.id);
      } catch (err) { toast('삭제 실패: ' + err.message); }
      changed();
    } else if (act === 'del-link') {
      if (!(await confirmBox('이 기사 링크를 삭제할까요?', '삭제'))) return;
      const links = lesson.links.filter(function (_, k) { return k !== i; });
      try {
        await store.updateLesson(lesson.id, { links: links });
        lesson.links = links;
      } catch (err) { toast('삭제 실패: ' + err.message); }
      changed();
    }
  });

  // 사진 설명 고치기
  stage.addEventListener('change', async function (e) {
    const t = e.target;
    if (!t.matches || !t.matches('input[data-act="cap"]')) return;
    const lesson = curLesson();
    if (!lesson) return;
    const i = +t.getAttribute('data-i');
    const oldCap = (lesson.photos[i].caption || '').trim();
    const newCap = t.value.trim();
    const photos = lesson.photos.map(function (p, k) {
      return k === i ? Object.assign({}, p, { caption: newCap }) : p;
    });
    // 판서 중간에 넣어 둔 '[사진] 설명' 줄도 새 설명으로 함께 바꿈
    const text = String(lesson.text || '').split('\n').map(function (line) {
      const m = /^\s*\[사진\]\s*(.+)$/.exec(line);
      return (m && oldCap && m[1].trim() === oldCap) ? '[사진] ' + newCap : line;
    }).join('\n');
    try {
      await store.updateLesson(lesson.id, { photos: photos, text: text });
      lesson.photos = photos;
      lesson.text = text;
      toast('사진 설명을 저장했어요');
    } catch (err) { toast('저장 실패: ' + err.message); }
  });

  // 끌어다 놓기 · 붙여넣기
  stage.addEventListener('dragover', function (e) {
    if (state.tab === 'files' && state.edit) e.preventDefault();
  });
  stage.addEventListener('drop', function (e) {
    if (state.tab !== 'files' || !state.edit) return;
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) addPhotoFiles(e.dataTransfer.files);
  });
  document.addEventListener('paste', function (e) {
    if (state.tab !== 'files' || !state.edit || isModalOpen()) return;
    if (e.target && e.target.matches && e.target.matches('input,textarea')) return;
    const items = (e.clipboardData && e.clipboardData.files) || [];
    if (items.length) { e.preventDefault(); addPhotoFiles(items); }
  });
}

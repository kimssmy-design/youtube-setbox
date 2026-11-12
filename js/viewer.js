// 크게 보기: 사진을 화면 가득, 유튜브 영상을 화면 안에서 재생
import * as store from './store.js';
import { esc } from './ui.js';

let list = [], idx = 0;
const el = function () { return document.getElementById('viewer'); };

async function show(i) {
  if (!list.length) return;
  idx = (i + list.length) % list.length;
  const p = list[idx];
  const v = el();
  v.innerHTML = '<button class="v-close" data-v="close" aria-label="닫기">×</button>' +
    (list.length > 1 ? '<button class="v-nav prev" data-v="prev" aria-label="이전 사진">‹</button><button class="v-nav next" data-v="next" aria-label="다음 사진">›</button>' : '') +
    '<img src="' + esc(store.cachedPhoto(p.id) || p.thumb || '') + '" alt=""><div class="v-cap">' + esc(p.caption || '') + '</div>';
  v.classList.add('open');
  v.setAttribute('data-kind', 'photo');
  const want = idx;
  try {
    const full = await store.getPhoto(p.id);
    if (full && want === idx && v.classList.contains('open')) v.querySelector('img').src = full;
  } catch (e) { console.warn('큰 사진 불러오기 실패', e); }
}

export function openPhotos(photos, i) { list = photos || []; show(i); }

export function playVideo(id, title) {
  const v = el();
  const safeId = encodeURIComponent(id);
  v.innerHTML = '<button class="v-close" data-v="close" aria-label="닫기">×</button>' +
    '<iframe src="https://www.youtube-nocookie.com/embed/' + safeId + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>' +
    '<div class="v-cap">' + esc(title) +
    '<a href="https://youtu.be/' + safeId + '" target="_blank" rel="noopener">재생이 안 되면 유튜브에서 열기 ↗</a></div>';
  v.classList.add('open');
  v.setAttribute('data-kind', 'video');
}

export function viewerOpen() { return el().classList.contains('open'); }

export function closeViewer() {
  const v = el();
  v.classList.remove('open');
  v.innerHTML = ''; // 영상 재생도 함께 멈춤
}

// 열려 있을 때의 키 처리. 처리했으면 true
export function viewerKey(e) {
  if (!viewerOpen()) return false;
  const photo = el().getAttribute('data-kind') === 'photo';
  if (e.key === 'Escape') closeViewer();
  else if (photo && e.key === 'ArrowRight') show(idx + 1);
  else if (photo && e.key === 'ArrowLeft') show(idx - 1);
  return true;
}

export function initViewer() {
  el().addEventListener('click', function (e) {
    const a = e.target.getAttribute && e.target.getAttribute('data-v');
    if (a === 'prev') show(idx - 1);
    else if (a === 'next') show(idx + 1);
    else if (a === 'close' || e.target === this) closeViewer();
  });
}

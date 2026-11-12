// 영상 탭: 기존 영상 모음에 등록된 영상을 단원에 맞춰 보여 줍니다.
import { state, videosOf } from './state.js';
import { esc, safeUrl } from './ui.js';

export function renderVideos(el) {
  const vids = videosOf(state.sel.gi, state.sel.mi, state.sel.si);
  let h = '<div class="sec">이 단원 영상 <small>영상 추가·삭제는 "영상 모음"에서 합니다</small></div>';
  if (!vids.length) {
    el.innerHTML = h + '<div class="hint" style="margin:0">이 단원에 등록된 영상이 없어요.</div>';
    return;
  }
  h += '<div class="grid">';
  vids.forEach(function (v) {
    const dur = v.duration ? '<span class="tag">' + esc(v.duration) + '</span>' : '';
    if (v.videoId) {
      h += '<button class="card" data-act="play" data-id="' + esc(v.videoId) + '" data-title="' + esc(v.title) + '">' +
        '<div class="ph"><img src="https://img.youtube.com/vi/' + esc(v.videoId) + '/mqdefault.jpg" loading="lazy" alt="">' + dur + '</div>' +
        '<div class="cap">' + esc(v.title) + '</div></button>';
    } else {
      h += '<a class="card" href="' + esc(safeUrl(v.url)) + '" target="_blank" rel="noopener">' +
        '<div class="ph dark">지식채널e' + dur + '</div>' +
        '<div class="cap">' + esc(v.title) + '<small>누르면 새 창으로 열립니다</small></div></a>';
    }
  });
  el.innerHTML = h + '</div>';
}

function play(id, title) {
  const v = document.getElementById('viewer');
  const safeId = encodeURIComponent(id);
  v.innerHTML = '<button class="v-close" data-v="close" aria-label="닫기">×</button>' +
    '<iframe src="https://www.youtube-nocookie.com/embed/' + safeId + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>' +
    '<div class="v-cap">' + esc(title) +
    '<a href="https://youtu.be/' + safeId + '" target="_blank" rel="noopener">재생이 안 되면 유튜브에서 열기 ↗</a></div>';
  v.classList.add('open');
  v.setAttribute('data-kind', 'video');
}

export function initVideos(stage) {
  stage.addEventListener('click', function (e) {
    const t = e.target.closest('[data-act="play"]');
    if (!t) return; // 영상 탭과 판서 중간 영상 모두
    play(t.getAttribute('data-id'), t.getAttribute('data-title'));
  });
}

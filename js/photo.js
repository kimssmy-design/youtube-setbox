// 사진 파일을 줄여서 저장하고 { id, caption, thumb } 를 돌려줍니다.
import * as store from './store.js';

const MAX_CHARS = 900000; // 문서 하나의 저장 한도(1MB)보다 여유 있게

function loadImage(file) {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('사진을 읽을 수 없어요')); };
    img.src = url;
  });
}

function draw(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

function shrinkFull(img) {
  const tries = [[1600, 0.82], [1600, 0.7], [1280, 0.75], [1024, 0.72], [800, 0.7], [640, 0.6]];
  for (let i = 0; i < tries.length; i++) {
    const out = draw(img, tries[i][0], tries[i][1]);
    if (out.length <= MAX_CHARS) return out;
  }
  return null;
}

// 판서에서 사진을 설명으로 찾으므로, 같은 차시 안에서 설명이 겹치지 않게 함
function uniqueCaption(name, existing) {
  let base = String(name || '').replace(/\.[^.]+$/, '').trim();
  if (!base || /^image$/i.test(base)) base = '사진';
  const used = existing.map(function (p) { return String(p.caption || '').trim(); });
  if (used.indexOf(base) === -1) return base;
  let n = 2;
  while (used.indexOf(base + ' ' + n) !== -1) n++;
  return base + ' ' + n;
}

export async function fileToPhoto(file, existing) {
  const img = await loadImage(file);
  const full = shrinkFull(img);
  if (!full) throw new Error('사진이 너무 커요');
  const thumb = draw(img, 360, 0.7);
  const id = await store.addPhoto(full);
  return { id: id, caption: uniqueCaption(file.name, existing || []), thumb: thumb };
}

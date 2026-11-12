// 준비 화면에서 쓰는 자료 도구: 유튜브 주소 처리, 글 상자에 줄 끼워 넣기
import { state, videosOf } from './state.js';
import * as store from './store.js';

export function youtubeId(url) {
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

// 영상 길이 정리: '2' → '2:00', '22' → '22:00', '2:5' → '2:05', '1:02:03' 그대로
//   잘못된 글자면 null, 비어 있으면 ''
export function normDuration(str) {
  const t = String(str || '').replace(/\s|분|초/g, '').replace(/[.;]/g, ':');
  if (!t) return '';
  if (!/^\d{1,3}(:\d{1,2}){0,2}$/.test(t)) return null;
  const n = t.split(':').map(Number);
  if (n.length === 1) n.push(0);
  for (let i = 1; i < n.length; i++) if (n[i] > 59) return null;
  return n.map(function (x, i) { return i === 0 ? String(x) : ('0' + x).slice(-2); }).join(':');
}
// '3:25' → 205초 (정렬용, 기존 영상 모음과 같은 방식)
export function durSec(dur) {
  if (!dur) return 99999;
  const n = dur.split(':').map(Number);
  return n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
}

// 이미 등록된 영상의 길이 바꾸기
export async function setDuration(v, str) {
  const dur = normDuration(str);
  if (dur === null) throw new Error('길이는 2:00 이나 22:00 처럼 넣어 주세요');
  await store.updateVideo(v.id, { duration: dur, durSec: durSec(dur) });
  v.duration = dur;
  v.durSec = durSec(dur);
  return dur;
}

// 유튜브 영상을 단원 영상 모음에 등록 (이미 있으면 그 영상을 돌려줌)
export async function addYoutube(url, title, at, duration) {
  const dur = normDuration(duration);
  if (dur === null) throw new Error('길이는 2:00 이나 22:00 처럼 넣어 주세요');
  const id = youtubeId(url);
  if (!id) throw new Error('유튜브 주소만 넣을 수 있어요. 다른 영상은 "영상 모음"에서 추가해 주세요');
  const dup = videosOf(at.gi, at.mi, at.si).find(function (v) { return v.videoId === id; });
  if (dup) { if (dur && !dup.duration) await setDuration(dup, dur); return dup; }
  const t = String(title || '').trim() || await fetchTitle(id);
  if (!t) throw new Error('제목을 자동으로 가져오지 못했어요. 제목을 직접 넣어 주세요');
  const v = await store.addVideo({ gi: at.gi, mi: at.mi, si: at.si, type: 'youtube', url: url.trim(), title: t, duration: dur, durSec: durSec(dur), videoId: id });
  state.videos.push(v);
  return v;
}

// 글 상자의 지금 줄 다음에 새 줄 넣기
export function insertLine(ta, line) {
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

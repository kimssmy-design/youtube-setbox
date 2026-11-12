// 목차 편집: 학년·대단원·중단원 추가, 이름 변경, 순서 이동, 삭제
// 차시와 영상은 단원의 '순서 번호'로 연결되어 있으므로,
// 순서가 바뀌면 그 번호를 함께 옮겨 제 단원을 따라가게 합니다.
import { state, changed } from './state.js';
import * as store from './store.js';
import { esc, toast, openModal, closeModal } from './ui.js';

let draft = [];   // [{ name, o, majors:[{ name, o, minors:[{ name, o }] }] }]  (o = 원래 순서 번호, 새로 만든 것은 null)
let cur = 0;      // 지금 편집 중인 학년
let sheet = null;

function origHadMinors(go, mo) {
  const m = (state.toc[go] || [])[mo];
  return !!(m && m.minors && m.minors.length);
}

// 그 자리에 들어 있는 차시·영상 수
function count(go, mo, so) {
  if (go == null) return { l: 0, v: 0 };
  const inIt = function (x) {
    if (x.gi !== go) return false;
    if (mo === undefined) return true;
    if (mo == null || x.mi !== mo) return false;
    if (so === undefined) return true;
    return so != null && x.si === so;
  };
  return { l: state.lessons.filter(inIt).length, v: state.videos.filter(inIt).length };
}
function label(c) {
  const p = [];
  if (c.l) p.push('차시 ' + c.l);
  if (c.v) p.push('영상 ' + c.v);
  return p.join(' · ');
}

function tools(prefix, attrs) {
  return '<button class="ic" data-a="' + prefix + '-up"' + attrs + ' aria-label="위로">↑</button>' +
    '<button class="ic" data-a="' + prefix + '-down"' + attrs + ' aria-label="아래로">↓</button>' +
    '<button class="ic" data-a="' + prefix + '-del"' + attrs + ' aria-label="삭제">×</button>';
}

// 단원 개수가 교과서 차례와 같거나(이름만 바꿈) 아직 비어 있는 학년에만 버튼을 보여 줌
function bookFits(g) {
  const book = store.bookToc();
  if (!g.majors.length) return true;
  if (g.majors.length !== book.length) return false;
  const same = g.majors.every(function (m, i) { return m.name.trim() === book[i].major && m.minors.length === book[i].minors.length && m.minors.every(function (n, k) { return n.name.trim() === book[i].minors[k]; }); });
  return !same && g.majors.every(function (m, i) { return m.minors.length === book[i].minors.length; });
}

function paint() {
  const g = draft[cur];
  let h = '<h2>목차 편집</h2>' +
    '<p class="desc">단원을 추가하거나 순서를 바꿔도 영상과 차시가 제 단원을 따라갑니다. 차시나 영상이 든 단원은 지울 수 없어요.</p>' +
    '<label class="field-label">학년</label><div class="chips">' +
    draft.map(function (x, i) {
      return '<button class="chip' + (i === cur ? ' on' : '') + '" data-a="g-sel" data-gi="' + i + '">' + esc(x.name || '(이름 없음)') + '</button>';
    }).join('') + '<button class="chip dashed" data-a="g-add">＋ 학년</button></div>';

  if (g) {
    h += '<div class="t-row gname"><input data-t="g" value="' + esc(g.name) + '" placeholder="학년 이름 (예: 중학교 2학년)">' +
      '<button class="ic" data-a="g-up" aria-label="앞으로">←</button><button class="ic" data-a="g-down" aria-label="뒤로">→</button>' +
      '<button class="ic" data-a="g-del" aria-label="학년 삭제">×</button></div>' +
      (bookFits(g) ? '<button class="dash" data-a="book" style="margin-top:8px">비상교육 도덕① 교과서 차례로 단원 이름 바꾸기</button>' : '') +
      '<label class="field-label">단원</label>';
    g.majors.forEach(function (m, mi) {
      const a = ' data-mi="' + mi + '"';
      const mc = m.minors.length ? '' : label(count(g.o, m.o));
      h += '<div class="major-box"><div class="t-row"><input data-t="M"' + a + ' value="' + esc(m.name) + '" placeholder="대단원 이름 (예: Ⅰ. 자신과의 관계)">' +
        (mc ? '<small>' + mc + '</small>' : '') + tools('M', a) + '</div>';
      m.minors.forEach(function (n, si) {
        const b = a + ' data-si="' + si + '"';
        const c = label(count(g.o, m.o, n.o));
        h += '<div class="t-row sub"><input data-t="m"' + b + ' value="' + esc(n.name) + '" placeholder="중단원 이름 (예: 1. 자아와 도덕적인 삶)">' +
          (c ? '<small>' + c + '</small>' : '') + tools('m', b) + '</div>';
      });
      h += '<div class="t-row sub"><button class="dash" data-a="m-add"' + a + '>＋ 중단원 추가</button></div></div>';
    });
    h += '<button class="dash" data-a="M-add">＋ 대단원 추가</button>';
  }
  h += '<div class="sheet-btns"><span class="sp"></span><button class="btn" data-a="cancel">취소</button><button class="btn main" data-a="save">저장</button></div>';
  const top = sheet.scrollTop;
  sheet.innerHTML = h;
  sheet.scrollTop = top;
}

function swap(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
}

function hasContent(c) { return c.l + c.v > 0; }

async function save() {
  // 빈 이름 정리
  for (let gi = 0; gi < draft.length; gi++) {
    const g = draft[gi];
    if (!g.name.trim()) { cur = gi; paint(); toast('학년 이름을 넣어 주세요'); return; }
    for (let mi = 0; mi < g.majors.length; mi++) {
      if (!g.majors[mi].name.trim()) { cur = gi; paint(); toast('이름이 빈 대단원이 있어요'); return; }
      if (g.majors[mi].minors.some(function (n) { return !n.name.trim(); })) { cur = gi; paint(); toast('이름이 빈 중단원이 있어요'); return; }
    }
  }
  if (!draft.length) { toast('학년이 최소 1개 있어야 해요'); return; }

  // 원래 자리 → 새 자리
  const exact = {}, whole = {};
  draft.forEach(function (g, gi) {
    if (g.o == null) return;
    g.majors.forEach(function (m, mi) {
      if (m.o == null) return;
      if (!m.minors.length) { whole[g.o + '-' + m.o] = { gi: gi, mi: mi, si: null }; return; }
      if (!origHadMinors(g.o, m.o)) whole[g.o + '-' + m.o] = { gi: gi, mi: mi, si: 0 }; // 중단원이 새로 생긴 대단원: 첫 중단원으로
      m.minors.forEach(function (n, si) {
        if (n.o != null) exact[g.o + '-' + m.o + '-' + n.o] = { gi: gi, mi: mi, si: si };
      });
    });
  });
  function target(x) {
    const e = exact[x.gi + '-' + x.mi + '-' + x.si];
    if (e) return e;
    const w = whole[x.gi + '-' + x.mi];
    if (w) return { gi: w.gi, mi: w.mi, si: w.si == null ? x.si : w.si };
    return null;
  }
  const moves = [];
  const plan = function (kind, list) {
    list.forEach(function (x) {
      const t = target(x);
      if (t && (t.gi !== x.gi || t.mi !== x.mi || t.si !== x.si)) moves.push({ kind: kind, id: x.id, gi: t.gi, mi: t.mi, si: t.si, ref: x });
    });
  };
  plan('lesson', state.lessons);
  plan('video', state.videos);

  const grades = draft.map(function (g) { return g.name.trim(); });
  const toc = draft.map(function (g) {
    return g.majors.map(function (m) {
      return { major: m.name.trim(), minors: m.minors.map(function (n) { return n.name.trim(); }) };
    });
  });

  try {
    await store.saveStructure(grades, toc, moves.map(function (m) { return { kind: m.kind, id: m.id, gi: m.gi, mi: m.mi, si: m.si }; }));
  } catch (e) { toast('저장 실패: ' + e.message); return; }

  const selNew = state.sel.mi == null ? null : target(state.sel);
  moves.forEach(function (m) { m.ref.gi = m.gi; m.ref.mi = m.mi; m.ref.si = m.si; });
  state.grades = grades;
  state.toc = toc;
  state.sel = selNew
    ? { gi: selNew.gi, mi: selNew.mi, si: selNew.si, lessonId: state.sel.lessonId }
    : { gi: Math.min(cur, grades.length - 1), mi: null, si: null, lessonId: null };
  closeModal();
  changed();
  toast('목차를 저장했어요' + (moves.length ? ' (차시·영상 ' + moves.length + '개가 함께 이동)' : ''));
}

export function openTocEditor() {
  if (!state.videosLoaded) { toast('영상 목록을 아직 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요'); return; }
  draft = state.grades.map(function (name, gi) {
    return {
      name: name, o: gi,
      majors: (state.toc[gi] || []).map(function (m, mi) {
        return { name: m.major, o: mi, minors: (m.minors || []).map(function (n, si) { return { name: n, o: si }; }) };
      })
    };
  });
  cur = Math.min(state.sel.gi, draft.length - 1);
  sheet = openModal('', true);
  paint();

  sheet.addEventListener('input', function (e) {
    const t = e.target, k = t.getAttribute && t.getAttribute('data-t');
    if (!k) return;
    const g = draft[cur];
    if (k === 'g') g.name = t.value;
    else if (k === 'M') g.majors[+t.getAttribute('data-mi')].name = t.value;
    else g.majors[+t.getAttribute('data-mi')].minors[+t.getAttribute('data-si')].name = t.value;
  });

  sheet.addEventListener('click', function (e) {
    const t = e.target.closest('[data-a]');
    if (!t) return;
    const a = t.getAttribute('data-a');
    const g = draft[cur];
    const mi = +t.getAttribute('data-mi'), si = +t.getAttribute('data-si');
    let focusSel = '';
    if (a === 'cancel') { closeModal(); return; }
    if (a === 'save') { save(); return; }
    if (a === 'g-sel') cur = +t.getAttribute('data-gi');
    else if (a === 'book') {
      const book = store.bookToc();
      if (!g.majors.length) g.majors = book.map(function (m) { return { name: '', o: null, minors: m.minors.map(function () { return { name: '', o: null }; }) }; });
      g.majors.forEach(function (m, i) { m.name = book[i].major; m.minors.forEach(function (n, k) { n.name = book[i].minors[k]; }); });
      toast('교과서 차례로 이름을 바꿨어요. "저장"을 눌러야 반영됩니다');
    }
    else if (a === 'g-add') { draft.push({ name: '', o: null, majors: [] }); cur = draft.length - 1; focusSel = 'input[data-t="g"]'; }
    else if (a === 'g-up') { if (cur > 0) { swap(draft, cur, -1); cur--; } }
    else if (a === 'g-down') { if (cur < draft.length - 1) { swap(draft, cur, 1); cur++; } }
    else if (a === 'g-del') {
      if (draft.length <= 1) { toast('학년이 최소 1개 있어야 해요'); return; }
      if (hasContent(count(g.o))) { toast('차시나 영상이 든 학년은 지울 수 없어요'); return; }
      draft.splice(cur, 1); cur = Math.max(0, cur - 1);
    }
    else if (a === 'M-add') { g.majors.push({ name: '', o: null, minors: [] }); focusSel = 'input[data-t="M"][data-mi="' + (g.majors.length - 1) + '"]'; }
    else if (a === 'M-up') swap(g.majors, mi, -1);
    else if (a === 'M-down') swap(g.majors, mi, 1);
    else if (a === 'M-del') {
      if (hasContent(count(g.o, g.majors[mi].o))) { toast('차시나 영상이 든 단원은 지울 수 없어요'); return; }
      g.majors.splice(mi, 1);
    }
    else if (a === 'm-add') {
      g.majors[mi].minors.push({ name: '', o: null });
      focusSel = 'input[data-t="m"][data-mi="' + mi + '"][data-si="' + (g.majors[mi].minors.length - 1) + '"]';
    }
    else if (a === 'm-up') swap(g.majors[mi].minors, si, -1);
    else if (a === 'm-down') swap(g.majors[mi].minors, si, 1);
    else if (a === 'm-del') {
      const m = g.majors[mi];
      if (hasContent(count(g.o, m.o, m.minors[si].o))) { toast('차시나 영상이 든 단원은 지울 수 없어요'); return; }
      m.minors.splice(si, 1);
    }
    paint();
    if (focusSel) { const el = sheet.querySelector(focusSel); if (el) el.focus(); }
  });
}

// 여러 차시 한 번에: '## 01 제목 (148~151쪽)' 줄마다 새 차시가 시작됩니다.
//   [질문] [예시] [목표] 줄은 인트로로, 나머지는 판서로 들어갑니다.
import { state, changed, lessonsOf, minorName } from './state.js';
import * as store from './store.js';
import { parseText } from './board.js';
import { seedText } from './seed.js';
import { esc, toast, openModal, closeModal } from './ui.js';

export function parseBulk(text) {
  const list = [];
  let cur = null;
  String(text || '').replace(/\r/g, '').split('\n').forEach(function (raw) {
    const t = raw.trim();
    const m = /^##\s*(.+)$/.exec(t);
    if (m) {
      let title = m[1], page = '', no = '';
      const pm = /\s*\(\s*(?:p\.?\s*)?([\d~\-–,\s]+)쪽?\s*\)\s*$/.exec(title);
      if (pm && /\d/.test(pm[1])) { page = pm[1].trim(); title = title.slice(0, pm.index); }
      const nm = /^(\d+)[.\s]+/.exec(title);
      if (nm) { no = nm[1]; title = title.slice(nm[0].length); }
      cur = { no: no, title: title.trim(), page: page, lines: [], q: '', qPage: '', memo: [], goals: [] };
      list.push(cur);
    } else if (cur && t) {
      const im = /^\[(질문|예시|목표)\]\s*(.+)$/.exec(t);
      if (!im) { cur.lines.push(t); return; }
      if (im[1] === '질문') {
        const qp = /\s*\(\s*(\d+(?:\s*[~\-–]\s*\d+)?)\s*(?:쪽|페이지)\s*\)\s*$/.exec(im[2]);
        cur.q = qp ? im[2].slice(0, qp.index) : im[2];
        cur.qPage = qp ? qp[1].replace(/\s/g, '') : '';
      } else if (im[1] === '예시') cur.memo.push(im[2]);
      else cur.goals.push(im[2]);
    }
  });
  return list.filter(function (l) { return l.title; });
}

export function openBulk(where) {
  const existing = lessonsOf(where.gi, where.mi, where.si);
  const example = existing.length ? '' : seedText(minorName(where.gi, where.mi, where.si));
  const sheet = openModal(
    '<h2>여러 차시 한 번에</h2>' +
    '<p class="desc">' + esc(minorName(where.gi, where.mi, where.si)) + ' 단원에 차시를 한꺼번에 만듭니다. ' +
    '<b>##</b> 로 시작하는 줄이 새 차시의 시작이고, 쪽수는 제목 끝 괄호에 적습니다. <b>[질문] [예시] [목표]</b> 줄은 인트로로, 나머지는 판서로 들어갑니다.' +
    (example ? ' 이 단원은 교과서 기준 초안이 미리 들어 있어요.' : '') + '</p>' +
    '<textarea class="field" id="bkText" placeholder="## 01 차시 제목 (148~151쪽)&#10;[질문] 학생에게 던질 질문 (148쪽)&#10;[예시] 예) …&#10;[목표] 학습목표 한 줄&#10;# 학습 1. 큰 제목 (149쪽)&#10;(1) *핵심어*가 들어간 내용&#10;&#10;## 02 다음 차시 제목">' + esc(example) + '</textarea>' +
    '<div class="bulk-res" id="bkRes"></div>' +
    '<div class="sheet-btns"><span class="sp"></span><button class="btn" id="bkCancel">취소</button><button class="btn main" id="bkOk">차시 만들기</button></div>',
    true
  );
  const ta = sheet.querySelector('#bkText');
  const res = sheet.querySelector('#bkRes');

  function preview() {
    const list = parseBulk(ta.value);
    if (!list.length) { res.innerHTML = '<div class="none">## 로 시작하는 줄을 넣으면 만들어질 차시가 여기에 보입니다.</div>'; return; }
    res.innerHTML = '<div class="head">차시 ' + list.length + '개가 만들어집니다</div>' + list.map(function (l) {
      const n = parseText(l.lines.join('\n')).length;
      return '<div><b>' + esc(l.no) + '</b><span>' + esc(l.title) + '</span><small>판서 ' + n + '줄' +
        (l.q ? ' · 인트로' : '') + (l.page ? ' · ' + esc(l.page) + '쪽' : '') + '</small></div>';
    }).join('');
  }
  ta.addEventListener('input', preview);
  preview();

  sheet.querySelector('#bkCancel').onclick = closeModal;
  sheet.querySelector('#bkOk').onclick = async function () {
    const list = parseBulk(ta.value);
    if (!list.length) { toast('## 로 시작하는 차시 제목 줄이 없어요'); return; }
    this.disabled = true;
    let made = 0, first = null;
    let nextNo = existing.length;
    try {
      for (let i = 0; i < list.length; i++) {
        nextNo++;
        const l = list[i];
        const doc = await store.addLesson({
          gi: where.gi, mi: where.mi, si: where.si,
          no: l.no || ('0' + nextNo).slice(-2), title: l.title, page: l.page,
          text: l.lines.join('\n'), createdAt: Date.now() + i,
          topic: { q: l.q, page: l.qPage, memo: l.memo.join('\n'), goals: l.goals.join('\n'), photos: [], links: [], videoIds: [] }
        });
        state.lessons.push(doc);
        if (!first) first = doc;
        made++;
      }
      closeModal();
      toast('차시 ' + made + '개를 만들었어요');
    } catch (e) {
      toast('저장 실패: ' + e.message + (made ? ' (' + made + '개까지는 저장됨)' : ''));
      this.disabled = false;
    }
    changed();
  };
}

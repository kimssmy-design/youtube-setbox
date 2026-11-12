// 공통 화면 도구: 글자 안전 처리, 알림, 모달
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// http(s) 주소만 허용
export function safeUrl(u) {
  const s = String(u || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

export function isModalOpen() {
  return !!document.querySelector('#modalRoot .backdrop');
}

export function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

// sticky가 참이면 바깥을 누르거나 Esc를 눌러도 닫히지 않음(쓰던 글 보호)
export function openModal(html, sticky) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = '<div class="backdrop"><div class="sheet' + (sticky ? ' sticky' : '') + '">' + html + '</div></div>';
  const bd = root.firstChild;
  bd.addEventListener('mousedown', function (e) { if (e.target === bd && !sticky) closeModal(); });
  const first = bd.querySelector('input,textarea');
  if (first) first.focus();
  return bd.querySelector('.sheet');
}

// 확인 창 (예/아니오)
export function confirmBox(message, okLabel) {
  return new Promise(function (resolve) {
    const sheet = openModal(
      '<h2>' + esc(message) + '</h2>' +
      '<div class="sheet-btns"><span class="sp"></span>' +
      '<button class="btn" data-a="no">취소</button>' +
      '<button class="btn main" data-a="yes">' + esc(okLabel || '확인') + '</button></div>'
    );
    sheet.addEventListener('click', function (e) {
      const a = e.target.getAttribute('data-a');
      if (!a) return;
      closeModal();
      resolve(a === 'yes');
    });
  });
}

export function isStickyModal() {
  return !!document.querySelector('#modalRoot .sheet.sticky');
}

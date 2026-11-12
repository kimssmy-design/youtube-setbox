// 접속 암호: 들어올 때 한 번 묻습니다. (편집용 암호는 따로 없음)
// 화면 잠금 용도이며, 데이터 자체를 보호하려면 Firebase 규칙을 따로 설정해야 합니다.
import * as store from './store.js';
import { toast } from './ui.js';

const KEY = 'lessonAuth';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.prototype.map.call(new Uint8Array(buf), function (b) {
    return ('0' + b.toString(16)).slice(-2);
  }).join('');
}

function saved() {
  try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; }
}
function keep(hash, always) {
  try {
    sessionStorage.setItem(KEY, hash);
    if (always) localStorage.setItem(KEY, hash); else localStorage.removeItem(KEY);
  } catch (e) { /* 저장소를 못 쓰는 환경: 매번 묻게 됨 */ }
}

// 다시 잠그기
export function lockNow() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); sessionStorage.removeItem('lessonEditOn'); } catch (e) { /* 무시 */ }
  location.reload();
}

// 암호를 통과하면 끝나는 약속을 돌려줍니다.
export function passGate() {
  const gate = document.getElementById('gate');
  return new Promise(function (resolve) {
    function done() {
      gate.innerHTML = '';
      document.body.classList.remove('locked');
      resolve();
    }

    function form(settings) {
      const isNew = !settings.passHash;
      gate.innerHTML =
        '<div class="gate-box"><h1>도덕 수업</h1>' +
        '<div class="gate-sub">' + (isNew ? '처음 한 번, 사용할 암호를 정해 주세요' : '암호를 입력하면 열립니다') + '</div>' +
        '<input class="field" id="gPw1" type="password" placeholder="암호" autocomplete="off">' +
        (isNew ? '<input class="field" id="gPw2" type="password" placeholder="암호 한 번 더" autocomplete="off">' : '') +
        '<label class="gate-chk"><input type="checkbox" id="gKeep"> 이 기기에서는 다시 묻지 않기 (내 폰·집 컴퓨터용)</label>' +
        '<button class="btn main" id="gOk">' + (isNew ? '암호 정하고 들어가기' : '들어가기') + '</button></div>';
      const pw1 = gate.querySelector('#gPw1');
      pw1.focus();
      const submit = async function () {
        const p1 = pw1.value;
        if (!p1) { toast('암호를 입력해 주세요'); return; }
        const hash = await sha256(p1);
        if (isNew) {
          if (p1.length < 4) { toast('암호는 4글자 이상으로 정해 주세요'); return; }
          if (p1 !== gate.querySelector('#gPw2').value) { toast('두 암호가 서로 달라요'); return; }
          try { await store.saveSettings({ passHash: hash }); }
          catch (e) { toast('저장 실패: ' + e.message); return; }
        } else if (hash !== settings.passHash) {
          toast('암호가 맞지 않아요');
          pw1.value = ''; pw1.focus();
          return;
        }
        keep(hash, gate.querySelector('#gKeep').checked);
        done();
      };
      gate.querySelector('#gOk').onclick = submit;
      gate.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    }

    async function start() {
      gate.innerHTML = '<div class="gate-box"><div class="gate-sub">불러오는 중…</div></div>';
      let settings;
      try { settings = await store.loadSettings(); }
      catch (e) {
        console.error(e);
        gate.innerHTML = '<div class="gate-box"><div class="gate-sub">연결하지 못했어요.<br>인터넷 연결을 확인해 주세요.</div>' +
          '<button class="btn main" id="gRetry">다시 시도</button></div>';
        gate.querySelector('#gRetry').onclick = start;
        return;
      }
      if (settings.passHash && saved() === settings.passHash) { done(); return; }
      form(settings);
    }
    start();
  });
}

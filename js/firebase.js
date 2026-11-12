// Firebase 연결 설정 — 기존 영상 모음(index.html)과 같은 프로젝트를 씁니다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export * from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const app = initializeApp({
  apiKey: "AIzaSyD_DEKiwYD2MvGQxez80llnOGEmkyY2A1Q",
  authDomain: "school-notebook-multi.firebaseapp.com",
  projectId: "school-notebook-multi",
  storageBucket: "school-notebook-multi.firebasestorage.app",
  messagingSenderId: "78709255917",
  appId: "1:78709255917:web:e69cf4da157053ee7a26e4"
});

// 한 번 본 내용은 기기에 보관해 두어, 교실 인터넷이 끊겨도 판서·사진은 열리게 합니다.
let _db;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  _db = getFirestore(app);
}
export const db = _db;

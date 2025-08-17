// 파일 경로: src/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
// ▼▼▼ [누락된 부분] Realtime Database import 추가 ▼▼▼
import { getDatabase } from "firebase/database";
// ▲▲▲ 추가 완료 ▲▲▲

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8_0SFaNFN0DcwzDSYk-9G0kVw0k-sQSE",
  authDomain: "saltmate-project.firebaseapp.com",
  projectId: "saltmate-project",
  storageBucket: "saltmate-project.appspot.com",
  messagingSenderId: "285568911553",
  appId: "1:285568911553:web:9a3d95ab4060f3ab436c40",
  measurementId: "G-Q1MHZJH2B5",
  // ▼▼▼ [누락된 부분] Realtime Database URL 추가 ▼▼▼
  databaseURL:
    "https://saltmate-project-default-rtdb.asia-southeast1.firebasedatabase.app",
  // ▲▲▲ 추가 완료 ▲▲▲
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "asia-northeast3");

// ▼▼▼ [누락된 부분] Realtime Database 초기화 코드 추가 ▼▼▼
const rtdb = getDatabase(app);
// ▲▲▲ 추가 완료 ▲▲▲

// [수정] rtdb를 export에 추가
export { auth, db, storage, functions, rtdb };

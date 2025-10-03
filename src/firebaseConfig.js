	// 파일 경로: src/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getDatabase } from "firebase/database";
// [신규 추가] 애널리틱스 import
import { getAnalytics } from "firebase/analytics";
import firebaseAdmin from 'firebase-admin'; // Firebase Admin SDK는 Functions에서 사용되므로 여기서는 주석 처리하거나 제거 (Functions index.js에서 사용)

// .env 파일에서 Firebase 설정 정보를 안전하게 불러옵니다.
const firebaseConfig = {
  apiKey: process.env.VUE_APP_API_KEY,
  authDomain: process.env.VUE_APP_AUTH_DOMAIN,
  projectId: process.env.VUE_APP_PROJECT_ID,
  storageBucket: process.env.VUE_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.VUE_APP_MESSAGING_SENDER_ID,
  appId: process.env.VUE_APP_APP_ID,
  measurementId: process.env.VUE_APP_MEASUREMENT_ID,
  databaseURL: process.env.VUE_APP_DATABASE_URL,
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "asia-northeast3");
const rtdb = getDatabase(app);

// [신규 추가] 애널리틱스 초기화 및 export
const analytics = getAnalytics(app);

export { auth, db, storage, functions, rtdb, analytics };
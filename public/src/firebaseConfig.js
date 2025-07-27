// src/firebaseConfig.js

// 필요한 Firebase 서비스 모듈을 가져옵니다.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // 사용자 인증
import { getFirestore } from "firebase/firestore"; // 클라우드 Firestore (데이터베이스)
import { getStorage } from "firebase/storage"; // 클라우드 Storage (파일 저장)
import { getFunctions } from "firebase/functions"; // 클라우드 Functions (서버리스 함수)

// ✨ 중요: 여러분의 Firebase 프로젝트 설정 값을 여기에 붙여넣으세요!
const firebaseConfig = {
  apiKey: "AIzaSyD8_0SFaNFN0DcwzDSYk-9G0kVw0k-sQSE",
  authDomain: "saltmate-project.firebaseapp.com",
  projectId: "saltmate-project",
  storageBucket: "saltmate-project.firebasestorage.app",
  messagingSenderId: "285568911553",
  appId: "1:285568911553:web:9a3d95ab4060f3ab436c40",
  measurementId: "G-Q1MHZJH2B5",
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 각 Firebase 서비스 인스턴스를 가져와 내보냅니다.
export const auth = getAuth(app); // 인증
export const db = getFirestore(app); // 데이터베이스
export const storage = getStorage(app); // 스토리지
export const functions = getFunctions(app); // 함수

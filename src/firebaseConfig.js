import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8_0SFaNFN0DcwzDSYk-9G0kVw0k-sQSE",
  authDomain: "saltmate-project.firebaseapp.com",
  projectId: "saltmate-project",
  storageBucket: "saltmate-project.appspot.com", // .appspot.com이 표준입니다.
  messagingSenderId: "285568911553",
  appId: "1:285568911553:web:9a3d95ab4060f3ab436c40",
  measurementId: "G-Q1MHZJH2B5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Cloud Functions and point to the asia-northeast3 region
const functions = getFunctions(app, "asia-northeast3");

export { auth, db, storage, functions };

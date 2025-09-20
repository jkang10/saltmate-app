// 파일 경로: src/service-worker.js

/* eslint-disable no-undef */

// Workbox(PWA) 라이브러리 import
import { precacheAndRoute } from 'workbox-precaching';

// Firebase 라이브러리 import
importScripts(
  "https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js"
);

// PWA 플러그인이 생성한 파일 목록을 캐싱합니다. (이 코드는 빌드 시 자동으로 채워집니다)
precacheAndRoute(self.__WB_MANIFEST);

// Firebase 설정 (환경 변수에서 자동으로 값을 가져옵니다)
const firebaseConfig = {
  apiKey: "%VUE_APP_API_KEY%",
  authDomain: "%VUE_APP_AUTH_DOMAIN%",
  projectId: "%VUE_APP_PROJECT_ID%",
  storageBucket: "%VUE_APP_STORAGE_BUCKET%",
  messagingSenderId: "%VUE_APP_MESSAGING_SENDER_ID%",
  appId: "%VUE_APP_APP_ID%",
  measurementId: "%VUE_APP_MEASUREMENT_ID%",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드 메시지 처리 로직
messaging.onBackgroundMessage((payload) => {
  console.log("백그라운드 메시지 수신: ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/img/icons/android-chrome-192x192.png",
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

/* eslint-enable no-undef */
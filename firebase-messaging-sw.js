// 이 파일은 public 폴더 최상단에 위치해야 합니다.
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js",
);

// .env 파일에서 VUE_APP_으로 시작하는 환경 변수를 사용합니다.
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

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Received background message ",
    payload,
  );
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/img/icons/android-chrome-192x192.png", // public/img/icons/ 폴더에 아이콘 파일이 있어야 함
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

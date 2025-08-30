<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <h3>알림 설정</h3>
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else>
        <p>
          새로운 공지사항이나 중요한 업데이트가 있을 때 웹 푸시 알림을
          받으시겠습니까?
        </p>
        <div class="status-text">
          현재 알림 상태:
          <strong :class="notificationStatus">{{
            notificationStatusText
          }}</strong>
        </div>
        <div class="button-group">
          <button
            @click="subscribeToNotifications"
            class="btn btn-success"
            :disabled="isSubscribed || isBlocked"
          >
            알림 수신 동의
          </button>
          <button
            @click="unsubscribeFromNotifications"
            class="btn btn-danger"
            :disabled="!isSubscribed"
          >
            알림 수신 거부
          </button>
        </div>
        <p v-if="isBlocked" class="error-message">
          브라우저 설정에서 알림이 차단되었습니다. 사이트 설정에서 알림을
          '허용'으로 변경해주세요.
        </p>
      </div>
      <button @click="$emit('close')" class="close-button">&times;</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { getMessaging, getToken, deleteToken } from "firebase/messaging";
import { auth, db } from "@/firebaseConfig";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

const isLoading = ref(true);
const notificationPermission = ref(Notification.permission);
const fcmToken = ref(null);

const notificationStatus = computed(() => {
  if (notificationPermission.value === "granted" && fcmToken.value) {
    return "subscribed";
  }
  if (notificationPermission.value === "denied") {
    return "blocked";
  }
  return "unsubscribed";
});

const isSubscribed = computed(() => notificationStatus.value === "subscribed");
const isBlocked = computed(() => notificationStatus.value === "denied");

const notificationStatusText = computed(() => {
  switch (notificationStatus.value) {
    case "subscribed":
      return "수신 동의 상태";
    case "blocked":
      return "브라우저에서 차단됨";
    default:
      return "수신 거부 상태";
  }
});

const getFcmToken = async () => {
  try {
    const messaging = getMessaging();
    const currentToken = await getToken(messaging, {
      vapidKey:
        "BFupxAUiECe0rx_4KqxtBV_0cGrxOur1bqjNDur1U5Vw8ov5vFUyb9uqe0lZS4Wx0lGzdMWJOpRInshg67Zhykc", // Firebase 콘솔 > 프로젝트 설정 > 클라우드 메시징 > 웹 푸시 인증서에서 생성
    });
    return currentToken;
  } catch (error) {
    console.error("FCM 토큰을 가져오는 데 실패했습니다:", error);
    if (error.code === "messaging/notifications-blocked") {
      notificationPermission.value = "denied";
    }
    return null;
  }
};

const subscribeToNotifications = async () => {
  const permission = await Notification.requestPermission();
  notificationPermission.value = permission;

  if (permission === "granted") {
    const token = await getFcmToken();
    if (token && auth.currentUser) {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
      });
      fcmToken.value = token;
      alert("알림 수신에 동의하셨습니다.");
    }
  } else {
    alert("알림이 허용되지 않았습니다.");
  }
};

const unsubscribeFromNotifications = async () => {
  if (fcmToken.value && auth.currentUser) {
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(fcmToken.value),
      });
      const messaging = getMessaging();
      await deleteToken(messaging);
      fcmToken.value = null;
      alert("알림 수신을 거부했습니다.");
    } catch (error) {
      console.error("알림 수신 거부 처리 중 오류 발생:", error);
    }
  }
};

onMounted(async () => {
  if (notificationPermission.value === "granted") {
    fcmToken.value = await getFcmToken();
  }
  isLoading.value = false;
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}
.modal-content {
  width: 90%;
  max-width: 500px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.2em;
}
.close-button {
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
}
.modal-body {
  padding: 20px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}
.btn-primary,
.btn-secondary {
  border: none;
  border-radius: 5px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.setting-item {
  display: grid;
  grid-template-columns: 1fr 60px;
  grid-template-areas:
    "label switch"
    "desc switch";
  gap: 5px 15px;
  align-items: center;
}
.setting-item label[for] {
  /* label 태그 중 for 속성이 있는 것만 선택 */
  grid-area: label;
  font-weight: bold;
  font-size: 1.1em;
  margin: 0;
}
.setting-item p {
  grid-area: desc;
  font-size: 0.9em;
  color: #666;
  margin: 0;
}
.switch {
  grid-area: switch;
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
  justify-self: center;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
}
input:checked + .slider {
  background-color: #28a745;
}
input:checked + .slider:before {
  transform: translateX(22px);
}
.slider.round {
  border-radius: 34px;
}
.slider.round:before {
  border-radius: 50%;
}
</style>

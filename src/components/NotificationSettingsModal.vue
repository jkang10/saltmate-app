<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <h3><i class="fas fa-bell"></i> 알림 설정</h3>
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else>
        <p class="description">
          새로운 공지사항이나 중요한 업데이트가 있을 때 웹 푸시 알림을
          받으시겠습니까?
        </p>
        <div class="status-text">
          <span>현재 알림 상태:</span>
          <strong :class="notificationStatus">{{
            notificationStatusText
          }}</strong>
        </div>
        <div class="button-group">
          <button
            @click="subscribeToNotifications"
            class="btn btn-success"
            :disabled="isSubscribed || isBlocked || isProcessing"
          >
            <span v-if="isProcessing" class="spinner-small"></span>
            <span v-else>알림 수신 동의</span>
          </button>
          <button
            @click="unsubscribeFromNotifications"
            class="btn btn-danger"
            :disabled="!isSubscribed || isProcessing"
          >
            <span v-if="isProcessing" class="spinner-small"></span>
            <span v-else>알림 수신 거부</span>
          </button>
        </div>
        <p v-if="isBlocked" class="error-message">
          브라우저 설정에서 알림이 차단되었습니다. 사이트 설정에서 알림을
          '허용'으로 변경해주세요.
        </p>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
      <button @click="$emit('close')" class="close-button" title="닫기">&times;</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { getMessaging, getToken, deleteToken } from "firebase/messaging";
import { auth, db } from "@/firebaseConfig";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

const isLoading = ref(true);
const isProcessing = ref(false);
const error = ref(null);
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
  error.value = null;
  try {
    const messaging = getMessaging();
    const currentToken = await getToken(messaging, {
      vapidKey: "BOY_y-5Ew_5E-l_xX_8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E8E", // Firebase 콘솔에서 발급받은 VAPID 키
    });
    return currentToken;
  } catch (err) {
    console.error("FCM 토큰을 가져오는 데 실패했습니다:", err);
    error.value = "알림 토큰을 가져오는 데 실패했습니다. 브라우저 설정을 확인해주세요.";
    if (err.code === "messaging/notifications-blocked") {
      notificationPermission.value = "denied";
    }
    return null;
  }
};

const subscribeToNotifications = async () => {
  isProcessing.value = true;
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
  isProcessing.value = false;
};

const unsubscribeFromNotifications = async () => {
  if (fcmToken.value && auth.currentUser) {
    isProcessing.value = true;
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(fcmToken.value),
      });
      const messaging = getMessaging();
      await deleteToken(messaging);
      fcmToken.value = null;
      notificationPermission.value = "default";
      alert("알림 수신을 거부했습니다.");
    } catch (err) {
      console.error("알림 수신 거부 처리 중 오류 발생:", err);
      error.value = "알림 수신 거부 중 오류가 발생했습니다.";
    } finally {
      isProcessing.value = false;
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
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  position: relative;
  padding: 30px;
  width: 100%;
  max-width: 500px;
  text-align: center;
}
.modal-content h3 {
  margin-top: 0;
}
.description {
  margin: 20px 0;
  color: #555;
}
.status-text {
  margin-bottom: 25px;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 8px;
}
.status-text strong.subscribed {
  color: #28a745;
}
.status-text strong.blocked {
  color: #dc3545;
}
.status-text strong.unsubscribed {
  color: #6c757d;
}
.button-group {
  display: flex;
  gap: 15px;
  justify-content: center;
}
.btn {
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-success {
  background-color: #28a745;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.close-button {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  font-size: 1.8em;
  cursor: pointer;
  color: #aaa;
}
.error-message {
  margin-top: 15px;
  color: #dc3545;
  font-size: 0.9em;
}
.spinner,
.spinner-small {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinner {
  width: 36px;
  height: 36px;
}
.spinner-small {
  width: 16px;
  height: 16px;
  border-width: 2px;
}
</style>
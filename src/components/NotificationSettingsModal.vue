<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i class="fas fa-bell"></i> 알림 설정</h3>
        <button class="close-button" @click="$emit('close')">&times;</button>
      </header>
      <main class="modal-body">
        <p class="description">
          새로운 공지사항, 주요 업데이트 등 중요한 소식을 푸시 알림으로 받아보시겠습니까?
        </p>
        <div class="toggle-switch-container">
          <span class="label">알림 수신 동의</span>
          <label class="switch">
            <input type="checkbox" v-model="hasPermission" @change="handleToggle" :disabled="isLoading" />
            <span class="slider round"></span>
          </label>
        </div>
        <div v-if="isLoading" class="loading-state">
          <div class="spinner-small"></div>
          <p>설정 변경 중...</p>
        </div>
        <div v-if="error" class="error-message">
          <p>{{ error }}</p>
        </div>
        <div v-if="successMessage" class="success-message">
          <p>{{ successMessage }}</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { auth, db } from '@/firebaseConfig';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export default {
  name: 'NotificationSettingsModal',
  emits: ['close'],
  // [수정] 사용하지 않는 인자 ' _, { emit } ' 를 제거합니다.
  setup() {
    const hasPermission = ref(Notification.permission === 'granted');
    const isLoading = ref(false);
    const error = ref(null);
    const successMessage = ref(null);
    const VAPID_KEY = process.env.VUE_APP_VAPID_KEY;

    // 현재 사용자의 토큰을 DB에서 삭제하는 함수
    const removeTokenFromFirestore = async (currentToken) => {
      if (!auth.currentUser || !currentToken) return;
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        fcmTokens: arrayRemove(currentToken),
      });
    };
    
    // 알림 권한 상태를 확인하고 UI를 업데이트하는 함수
    const checkCurrentPermission = () => {
        hasPermission.value = Notification.permission === 'granted';
    };

    const handleToggle = async () => {
      isLoading.value = true;
      error.value = null;
      successMessage.value = null;

      try {
        if (hasPermission.value) { // 스위치를 켰을 때 (동의)
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const messaging = getMessaging();
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            
            if (currentToken) {
              const userRef = doc(db, 'users', auth.currentUser.uid);
              await updateDoc(userRef, {
                fcmTokens: arrayUnion(currentToken),
              });
              successMessage.value = '알림 수신이 설정되었습니다.';
            } else {
              throw new Error('토큰을 가져올 수 없습니다. 다시 시도해주세요.');
            }
          } else {
            hasPermission.value = false; // 사용자가 권한 거부 시 스위치를 다시 끔
            throw new Error('알림 권한이 거부되었습니다.');
          }
        } else { // 스위치를 껐을 때 (거부/해제)
          // 현재는 브라우저에서 권한을 직접 해제해야 하므로, DB의 토큰만 삭제 시도
           const messaging = getMessaging();
           const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
           if(currentToken) {
             await removeTokenFromFirestore(currentToken);
           }
           successMessage.value = '알림 수신이 해제되었습니다. 브라우저 설정에서 알림을 차단해주세요.';
        }
      } catch (e) {
        console.error('알림 설정 오류:', e);
        error.value = `알림 토큰을 가져오는 데 실패했습니다. 브라우저 설정을 확인해주세요. (${e.message})`;
        hasPermission.value = false; // 오류 발생 시 스위치 끔
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(() => {
        checkCurrentPermission();
        // 백그라운드가 아닌 앱 사용 중에 알림을 수신했을 때의 처리
        const messaging = getMessaging();
        onMessage(messaging, (payload) => {
            console.log('Message received. ', payload);
            // 필요 시 여기에 알림 UI를 직접 띄우는 로직 추가
        });
    });

    return {
      hasPermission,
      isLoading,
      error,
      successMessage,
      handleToggle,
    };
  },
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6); /* 어두운 배경 추가 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.2);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.5em;
  color: #333;
}
.close-button {
  background: none;
  border: none;
  font-size: 2em;
  cursor: pointer;
  color: #888;
}
.modal-body .description {
    color: #555;
    line-height: 1.6;
    margin-bottom: 25px;
}
.toggle-switch-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
}
.label {
    font-size: 1.1em;
    font-weight: 500;
    color: #333;
}
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
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
  transition: .4s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
}
input:checked + .slider {
  background-color: #2196F3;
}
input:checked + .slider:before {
  transform: translateX(26px);
}
.slider.round {
  border-radius: 34px;
}
.slider.round:before {
  border-radius: 50%;
}
.loading-state, .error-message, .success-message {
    margin-top: 15px;
    text-align: center;
}
.error-message { color: #dc3545; }
.success-message { color: #28a745; }
.spinner-small {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px; /* 스피너와 텍스트 사이에 여백 추가 */
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
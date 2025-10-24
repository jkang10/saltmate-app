<template>
  <div class="user-profile-container card glassmorphism">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>프로필 정보를 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error || "정보를 불러올 수 없습니다." }}</p>
    </div>
    <div v-else-if="userProfileData" class="widget-layout">
  <section class="profile-info-section widget-card">
        <div class="profile-header">
          <div class="profile-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="profile-name">
            <h2>{{ userProfileData.name }}</h2>
            <p>{{ userProfileData.email }}</p>
            </div>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <label><i class="fas fa-calendar-alt"></i> 가입일</label>
            <span>{{ formatDate(userProfileData.createdAt) }}</span>
          </div>
          <div class="info-item">
            <label><i class="fas fa-store"></i> 소속 센터</label>
            <span>{{ userProfileData.centerId || "미지정" }}</span>
          </div>
          <div class="info-item">
            <label><i class="fas fa-phone"></i> 연락처</label>
            <span>{{ userProfileData.phone || "미등록" }}</span>
          </div>
          <div class="info-item">
             <label><i class="fas fa-star"></i> 등급</label>
             <span :class="['tier-badge', getTierClass(userProfileData.tier)]">{{ userProfileData.tier || 'BRONZE' }}</span>
          </div>
          <div class="info-item">
              <label><i class="fas fa-file-invoice-dollar"></i> 구독 상태</label>
              <span :class="['subscription-status', subscriptionStatusClass]">
                  {{ getSubscriptionStatusText(userProfileData.subscriptionStatus) }}
                  <template v-if="userProfileData.subscriptionStatus === 'active' && userProfileData.nextPaymentDueDate">
                    (~{{ formatDate(userProfileData.nextPaymentDueDate, true) }})
                  </template>
              </span>
          </div>
          <div class="info-item" v-if="userProfileData.subscriptionStatus === 'overdue'">
             <label><i class="fas fa-exclamation-triangle"></i> 구독 만료</label>
             <button @click="requestPayment" class="btn-pay urgent" :disabled="isRequestingPayment">
                {{ isRequestingPayment ? '요청 중...' : '결제 요청 (만원)' }}
             </button>
          </div>
          </div>
      </section>

      <section class="profile-details-section">
        <div class="detail-card widget-card">
          <h3><i class="fas fa-chart-bar"></i> 활동 요약</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <label>총 추천인 수</label>
              <span class="highlight-blue">{{ (userProfileData.referralCount || 0).toLocaleString() }} 명</span>
            </div>
            <div class="summary-item">
              <label>총 정산 수익 (Cash)</label>
              <span class="highlight-green">{{ (userProfileData.totalPayouts || 0).toLocaleString() }} 원</span>
            </div>
            <div class="summary-item">
              <label>총 게임 수익 (Salt)</label>
              <span class="highlight-purple">{{ (userProfileData.totalGameWinnings || 0).toLocaleString() }} S</span>
            </div>
            </div>
        </div>

        <div class="detail-card widget-card">
          <h3><i class="fas fa-share-alt"></i> 추천인 링크 공유</h3>
          <p class="referral-desc">
            이 링크를 통해 가입한 회원은 나의 추천인으로 등록됩니다.
          </p>
          <div class="link-box">
            <input type="text" :value="referralLink" readonly ref="referralInput" />
            <button class="copy-button" @click="copyReferralLink">
              <i class="fas fa-copy"></i> 복사
            </button>
          </div>
        </div>

        <div class="detail-card widget-card">
          <h3><i class="fas fa-cog"></i> 계정 설정</h3>
          <div class="settings-grid">
            <button class="setting-item" @click="emitOpenPasswordModal">
              <i class="fas fa-key"></i>
              <span>비밀번호 변경</span>
            </button>
            <button class="setting-item" @click="emitOpenNotificationSettingsModal">
              <i class="fas fa-bell"></i>
              <span>알림 설정</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
// [수정] 필요한 모듈 import
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { auth, db, functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
// [수정] Firestore 모듈 import
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; // onAuthStateChanged 추가

// [수정] Props 제거
// const props = defineProps({...});

// Emits는 그대로 유지 (부모가 모달 관리 가정)
const emit = defineEmits(['openPasswordModal', 'openNotificationSettingsModal']);

// [수정] 내부 상태 변수 정의 (props 대신)
const userProfileData = ref(null);
const isLoading = ref(true);
const error = ref(null);
let unsubscribe = null; // Firestore 리스너 해제를 위한 변수

const isRequestingPayment = ref(false);
const referralInput = ref(null);
const requestMonthlyPaymentFunc = httpsCallable(functions, 'requestMonthlyPayment');

// Computed Properties (props.userProfile -> userProfileData.value 로 변경)
const referralLink = computed(() => {
  if (!auth.currentUser?.uid) return "";
  const baseUrl = "https://saltmate-app.netlify.app";
  return `${baseUrl}/signup?ref=${auth.currentUser.uid}`;
});

const subscriptionStatusClass = computed(() => {
  if (!userProfileData.value?.subscriptionStatus) return "";
  return `status-${userProfileData.value.subscriptionStatus}`;
});

// Methods (기존과 거의 동일, props.userProfile -> userProfileData.value 사용)
const formatDate = (timestamp, includeTime = false) => {
  if (!timestamp) return "N/A";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  if (!(date instanceof Date) || isNaN(date)) return "N/A";
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  if (includeTime) {
      options.hour = 'numeric';
      options.minute = 'numeric';
  }
  return date.toLocaleDateString("ko-KR", options);
};

const copyReferralLink = () => {
    if (!referralInput.value) return;
    referralInput.value.select();
    navigator.clipboard.writeText(referralLink.value).then(() => {
        alert("추천인 링크가 복사되었습니다!");
    }).catch(err => {
        console.error('링크 복사 실패:', err);
        alert("링크 복사에 실패했습니다. 직접 복사해주세요.");
        try {
            referralInput.value.select();
            referralInput.value.setSelectionRange(0, 99999);
        } catch (selectErr) {
            console.error('텍스트 선택 실패:', selectErr);
        }
    });
};

const getTierClass = (tier) => {
  if (!tier) return "default";
  return tier.toLowerCase().replace(/\s+/g, '-') || "default";
};

const getSubscriptionStatusText = (status) => {
  switch (status) {
    case 'active': return '활성';
    case 'pending': return '승인 대기 중';
    case 'overdue': return '기간 만료';
    default: return '알 수 없음';
  }
};

const requestPayment = async () => {
  if (isRequestingPayment.value) return;
  if (!confirm("월간 구독료(만원의 행복) 결제를 요청하시겠습니까? 관리자 확인 후 승인 처리됩니다.")) return;
  isRequestingPayment.value = true;
  try {
    await requestMonthlyPaymentFunc();
    alert("결제 요청이 완료되었습니다. 관리자가 승인하면 구독 상태가 갱신됩니다.");
  } catch (e) {
    console.error("월간 결제 요청 오류:", e);
    alert(`오류가 발생했습니다: ${e.message}`);
  } finally {
    isRequestingPayment.value = false;
  }
};

const emitOpenPasswordModal = () => { emit('openPasswordModal'); };
const emitOpenNotificationSettingsModal = () => { emit('openNotificationSettingsModal'); };

// [수정] 데이터 로딩 로직 추가
const listenToUserProfile = (uid) => {
  isLoading.value = true;
  const userRef = doc(db, "users", uid);
  unsubscribe = onSnapshot(userRef,
    (docSnap) => {
      if (docSnap.exists()) {
        userProfileData.value = docSnap.data(); // 내부 ref 업데이트
        error.value = null; // 성공 시 에러 초기화
      } else {
        error.value = "사용자 프로필을 찾을 수 없습니다.";
        userProfileData.value = null; // 데이터 없음
      }
      isLoading.value = false;
    },
    (e) => {
      console.error("프로필 실시간 수신 실패:", e);
      error.value = "프로필 로딩에 실패했습니다.";
      userProfileData.value = null;
      isLoading.value = false;
    }
  );
};

// [수정] onMounted 훅 추가
onMounted(() => {
  // 인증 상태 변경 감지
  const authUnsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      listenToUserProfile(user.uid); // 로그인된 사용자 UID로 데이터 리스닝 시작
    } else {
      // 로그아웃 상태 처리 (예: 로그인 페이지로 리다이렉트 또는 에러 메시지)
      isLoading.value = false;
      error.value = "로그인이 필요합니다.";
      userProfileData.value = null;
      if (unsubscribe) unsubscribe(); // 이전 리스너 해제
    }
  });

  // 컴포넌트 언마운트 시 리스너 해제
  onUnmounted(() => {
    if (unsubscribe) unsubscribe();
    authUnsubscribe(); // 인증 상태 리스너도 해제
  });
});

</script>

<style scoped>
/* [수정] 클래스명 변경 */
.user-profile-container {
  padding: 0;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  max-width: 1100px; /* 최대 너비 설정 */
  margin: 80px auto 20px; /* 상단 여백 추가 및 중앙 정렬 */
}

/* ... (나머지 스타일은 기존과 동일) ... */
.widget-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
}
.profile-info-section {
  padding: 25px;
  background-color: #ffffff;
  border-bottom: 1px solid #e9ecef;
}
.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}
.profile-avatar {
  font-size: 2.5em;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background-color: #3498db;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}
.profile-name h2 {
  margin: 0;
  font-size: 1.6em;
  color: #2c3e50;
  font-weight: 600;
}
.profile-name p {
  margin: 4px 0 0;
  color: #7f8c8d;
  font-size: 0.95em;
}
.info-grid { display: flex; flex-direction: column; gap: 12px; }
.info-item { display: flex; justify-content: space-between; align-items: center; font-size: 0.95em; }
.info-item label { color: #555; font-weight: 500; display: flex; align-items: center; gap: 8px; }
.info-item label i { color: #95a5a6; width: 16px; text-align: center; }
.info-item span { font-weight: 600; color: #34495e; }
.tier-badge { padding: 3px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold; color: white; text-transform: uppercase; }
.tier-badge.default, .tier-badge.bronze { background-color: #cd7f32; }
.tier-badge.premium { background-color: #c0c0c0; }
.tier-badge.vip { background: linear-gradient(45deg, #f1c40f, #e67e22); }
.tier-badge.vvip { background: linear-gradient(45deg, #7f00ff, #e100ff); }
.tier-badge.infinite { background: linear-gradient(45deg, #ff007f, #f4b400, #4285f4); }
.subscription-status { font-weight: bold; }
.subscription-status.status-active { color: #2ecc71; }
.subscription-status.status-pending { color: #f39c12; }
.subscription-status.status-overdue { color: #e74c3c; }
.btn-pay { padding: 5px 10px; font-size: 0.85em; border-radius: 4px; cursor: pointer; border: none; color: white; font-weight: bold; }
.btn-pay.urgent { background-color: #e74c3c; }
.btn-pay:disabled { background-color: #bdc3c7; cursor: not-allowed; }
.profile-details-section { padding: 25px; display: flex; flex-direction: column; gap: 25px; }
.widget-card { background-color: rgba(255, 255, 255, 0.9); padding: 20px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05); }
.detail-card h3 { font-size: 1.3em; margin: 0 0 18px 0; display: flex; align-items: center; gap: 10px; color: #34495e; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.detail-card h3 i { color: #3498db; width: 20px; text-align: center; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
.summary-item label { display: block; color: #666; font-size: 0.9em; margin-bottom: 5px; }
.summary-item span { font-size: 1.4em; font-weight: bold; }
.summary-item span.highlight-blue { color: #3498db; }
.summary-item span.highlight-green { color: #2ecc71; }
.summary-item span.highlight-purple { color: #9b59b6; }
.referral-desc { font-size: 0.9em; color: #555; margin-bottom: 12px; }
.link-box { display: flex; }
.link-box input { flex-grow: 1; padding: 10px 12px; font-size: 0.9em; border: 1px solid #ccc; border-radius: 6px 0 0 6px; background-color: #f8f9fa; color: #333; outline: none; min-width: 0; }
.copy-button { padding: 0 15px; border: 1px solid #3498db; background-color: #3498db; color: white; border-radius: 0 6px 6px 0; cursor: pointer; font-weight: 500; font-size: 0.9em; white-space: nowrap; transition: background-color 0.2s; display: flex; align-items: center; gap: 5px; }
.copy-button:hover { background-color: #2980b9; }
.settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
.setting-item { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px; text-align: center; cursor: pointer; transition: all 0.2s ease; font-size: 0.95em; font-weight: 500; color: #333; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100px; }
.setting-item:hover { background-color: #e9ecef; border-color: #adb5bd; transform: translateY(-2px); }
.setting-item i { display: block; font-size: 1.6em; margin-bottom: 8px; color: #3498db; }
.loading-state, .error-state { text-align: center; padding: 40px; color: #666; }
.spinner { /* 로딩 스피너 스타일 */
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #09f;
  animation: spin 1s ease infinite;
  margin: 0 auto 10px;
}
@media (min-width: 768px) {
  .widget-layout { grid-template-columns: 1fr 1.5fr; gap: 25px; }
  .profile-info-section { border-right: 1px solid #e9ecef; border-bottom: none; }
  .profile-details-section { padding: 25px 0 25px 25px; }
  .summary-item span { font-size: 1.6em; }
  .setting-item { min-height: 120px; }
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
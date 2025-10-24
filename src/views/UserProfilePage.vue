<template>
  <div class="user-info-widget-container card glassmorphism">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>프로필 정보를 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error || "정보를 불러올 수 없습니다." }}</p>
    </div>
    <div v-else-if="userProfile" class="widget-layout">
      <section class="profile-info-section widget-card">
        <div class="profile-header">
          <div class="profile-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="profile-name">
            <h2>{{ userProfile.name }}</h2>
            <p>{{ userProfile.email }}</p>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <label><i class="fas fa-calendar-alt"></i> 가입일</label>
            <span>{{ formatDate(userProfile.createdAt) }}</span>
          </div>
          <div class="info-item">
            <label><i class="fas fa-store"></i> 소속 센터</label>
            <span>{{ userProfile.centerId || "미지정" }}</span>
          </div>
          <div class="info-item">
            <label><i class="fas fa-phone"></i> 연락처</label>
            <span>{{ userProfile.phone || "미등록" }}</span>
          </div>
          <div class="info-item">
             <label><i class="fas fa-star"></i> 등급</label>
             <span :class="['tier-badge', getTierClass(userProfile.tier)]">{{ userProfile.tier || 'BRONZE' }}</span>
          </div>
          <div class="info-item">
              <label><i class="fas fa-file-invoice-dollar"></i> 구독 상태</label>
              <span :class="['subscription-status', subscriptionStatusClass]">
                  {{ getSubscriptionStatusText(userProfile.subscriptionStatus) }}
                  <template v-if="userProfile.subscriptionStatus === 'active' && userProfile.nextPaymentDueDate">
                    (~{{ formatDate(userProfile.nextPaymentDueDate, true) }})
                  </template>
              </span>
          </div>
          <div class="info-item" v-if="userProfile.subscriptionStatus === 'overdue'">
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
              <span class="highlight-blue">{{ (userProfile.referralCount || 0).toLocaleString() }} 명</span>
            </div>
            <div class="summary-item">
              <label>총 정산 수익 (Cash)</label>
              <span class="highlight-green">{{ (userProfile.totalPayouts || 0).toLocaleString() }} 원</span>
            </div>
            <div class="summary-item">
              <label>총 게임 수익 (Salt)</label>
              <span class="highlight-purple">{{ (userProfile.totalGameWinnings || 0).toLocaleString() }} S</span>
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
// inject, onMounted 제거됨
import { ref, computed } from 'vue';
import { auth, functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { Timestamp } from 'firebase/firestore';

// Props: DashboardPage 등 부모로부터 userProfile 데이터 받기
const props = defineProps({
  userProfile: {
    type: Object,
    default: null
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
});

// Emits: 모달 열기 이벤트를 부모로 전달
const emit = defineEmits(['openPasswordModal', 'openNotificationSettingsModal', 'requestPayment']);

// Refs for internal state
const isRequestingPayment = ref(false); // 결제 요청 로딩 상태
const referralInput = ref(null); // 추천 링크 input 요소 참조

// Firebase Function Callables
const requestMonthlyPaymentFunc = httpsCallable(functions, 'requestMonthlyPayment');

// Computed Properties
const referralLink = computed(() => {
  if (!auth.currentUser?.uid) return "";
  // Netlify 배포 주소를 기본으로 사용
  const baseUrl = "https://saltmate-app.netlify.app";
  return `${baseUrl}/signup?ref=${auth.currentUser.uid}`;
});

const subscriptionStatusClass = computed(() => {
  if (!props.userProfile?.subscriptionStatus) return "";
  return `status-${props.userProfile.subscriptionStatus}`; // active, overdue 등
});

// Methods
const formatDate = (timestamp, includeTime = false) => {
  if (!timestamp) return "N/A";
  // Firestore Timestamp 객체 또는 Date 객체 처리
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  if (!(date instanceof Date) || isNaN(date)) return "N/A"; // 유효한 Date 객체인지 확인

  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  if (includeTime) {
      options.hour = 'numeric';
      options.minute = 'numeric';
  }
  return date.toLocaleDateString("ko-KR", options);
};

const copyReferralLink = () => {
    if (!referralInput.value) return;
    referralInput.value.select(); // input 내용 선택
    navigator.clipboard.writeText(referralLink.value).then(() => {
        alert("추천인 링크가 복사되었습니다!");
    }).catch(err => {
        console.error('링크 복사 실패:', err);
        alert("링크 복사에 실패했습니다. 직접 복사해주세요.");
        // 복사 실패 시 수동 선택/복사 유도
        try {
            referralInput.value.select();
            referralInput.value.setSelectionRange(0, 99999); // 모바일 지원
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

// 결제 요청 함수 (emit 대신 직접 함수 호출하도록 수정)
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


// 모달 열기 Emit 함수
const emitOpenPasswordModal = () => {
  emit('openPasswordModal');
};

const emitOpenNotificationSettingsModal = () => {
  // Service Worker 등록 로직은 상위 컴포넌트(예: App.vue 또는 UserProfilePage)에서 처리하거나,
  // 알림 설정 모달 자체에서 처리하는 것이 더 적합할 수 있습니다.
  // 여기서는 단순히 모달 열기 이벤트만 발생시킵니다.
  emit('openNotificationSettingsModal');
};

</script>

<style scoped>
/* UserInfoWidget 전체 컨테이너 */
.user-info-widget-container {
  padding: 0; /* 내부에서 패딩 관리 */
  background: rgba(255, 255, 255, 0.6); /* 반투명 배경 */
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 12px; /* 부드러운 모서리 */
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden; /* 내부 요소가 넘치지 않도록 */
}

.widget-layout {
  display: grid;
  /* 모바일 기본: 1열 */
  grid-template-columns: 1fr;
  gap: 0; /* 섹션 간 간격 제거 */
}

/* 좌측 프로필 정보 섹션 */
.profile-info-section {
  padding: 25px;
  background-color: #ffffff; /* 흰색 배경 */
  border-bottom: 1px solid #e9ecef; /* 구분선 */
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
  font-size: 2.5em; /* 크기 살짝 조정 */
  width: 70px; /* 크기 살짝 조정 */
  height: 70px;
  border-radius: 50%;
  background-color: #3498db; /* 아이콘 색상 변경 */
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0; /* 크기 유지 */
}
.profile-name h2 {
  margin: 0;
  font-size: 1.6em; /* 크기 살짝 조정 */
  color: #2c3e50;
  font-weight: 600;
}
.profile-name p {
  margin: 4px 0 0;
  color: #7f8c8d;
  font-size: 0.95em;
}
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px; /* 간격 조정 */
}
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95em; /* 전체적인 폰트 크기 조정 */
}
.info-item label {
  color: #555;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px; /* 아이콘과 텍스트 간격 */
}
.info-item label i {
  color: #95a5a6; /* 아이콘 색상 */
  width: 16px; /* 아이콘 너비 고정 */
  text-align: center;
}
.info-item span {
  font-weight: 600; /* 강조 */
  color: #34495e;
}
.tier-badge {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: bold;
    color: white;
    text-transform: uppercase;
}
.tier-badge.default, .tier-badge.bronze { background-color: #cd7f32; }
.tier-badge.premium { background-color: #c0c0c0; }
.tier-badge.vip { background: linear-gradient(45deg, #f1c40f, #e67e22); }
.tier-badge.vvip { background: linear-gradient(45deg, #7f00ff, #e100ff); }
.tier-badge.infinite { background: linear-gradient(45deg, #ff007f, #f4b400, #4285f4); }

.subscription-status { font-weight: bold; }
.subscription-status.status-active { color: #2ecc71; }
.subscription-status.status-pending { color: #f39c12; }
.subscription-status.status-overdue { color: #e74c3c; }

.btn-pay {
    padding: 5px 10px;
    font-size: 0.85em;
    border-radius: 4px;
    cursor: pointer;
    border: none;
    color: white;
    font-weight: bold;
}
.btn-pay.urgent { background-color: #e74c3c; }
.btn-pay:disabled { background-color: #bdc3c7; cursor: not-allowed; }

/* 우측 상세 정보 섹션 */
.profile-details-section {
  padding: 25px;
  display: flex;
  flex-direction: column;
  gap: 25px; /* 카드 간 간격 조정 */
}
.detail-card {
  /* 배경 제거, widget-card 스타일 사용 */
}
.widget-card { /* 좌우측 섹션 및 내부 카드 공통 스타일 */
  background-color: rgba(255, 255, 255, 0.9); /* 내부 카드 배경 약간 투명 */
  padding: 20px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}
.detail-card h3 {
  font-size: 1.3em; /* 크기 조정 */
  margin: 0 0 18px 0;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #34495e;
  border-bottom: 1px solid #eee; /* 헤더 구분선 */
  padding-bottom: 10px;
}
.detail-card h3 i {
    color: #3498db;
    width: 20px;
    text-align: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  text-align: center;
}
.summary-item label {
  display: block;
  color: #666;
  font-size: 0.9em;
  margin-bottom: 5px;
}
.summary-item span {
  font-size: 1.4em; /* 크기 조정 */
  font-weight: bold;
  /* 색상 강조 */
}
.summary-item span.highlight-blue { color: #3498db; }
.summary-item span.highlight-green { color: #2ecc71; }
.summary-item span.highlight-purple { color: #9b59b6; }


.referral-desc {
  font-size: 0.9em; /* 크기 조정 */
  color: #555;
  margin-bottom: 12px;
}
.link-box {
  display: flex;
}
.link-box input {
  flex-grow: 1; /* 남은 공간 차지 */
  padding: 10px 12px;
  font-size: 0.9em; /* 크기 조정 */
  border: 1px solid #ccc;
  border-radius: 6px 0 0 6px; /* 모서리 조정 */
  background-color: #f8f9fa;
  color: #333;
  outline: none;
  min-width: 0; /* flex item 축소 허용 */
}
.copy-button {
  padding: 0 15px; /* 패딩 조정 */
  border: 1px solid #3498db;
  background-color: #3498db;
  color: white;
  border-radius: 0 6px 6px 0; /* 모서리 조정 */
  cursor: pointer;
  font-weight: 500; /* 두께 조정 */
  font-size: 0.9em; /* 크기 조정 */
  white-space: nowrap;
  transition: background-color 0.2s;
  display: flex; /* 아이콘 중앙 정렬 */
  align-items: center;
  gap: 5px;
}
.copy-button:hover {
  background-color: #2980b9;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 2열 고정 */
  gap: 15px;
}
.setting-item {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 15px; /* 패딩 조정 */
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.95em; /* 크기 조정 */
  font-weight: 500;
  color: #333;
  display: flex; /* 아이콘과 텍스트 정렬 */
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100px; /* 최소 높이 */
}
.setting-item:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
  transform: translateY(-2px);
}
.setting-item i {
  display: block;
  font-size: 1.6em; /* 아이콘 크기 조정 */
  margin-bottom: 8px;
  color: #3498db;
}

/* 로딩 및 에러 상태 */
.loading-state, .error-state { text-align: center; padding: 40px; color: #666; }
.spinner { /* 기존 스피너 스타일 */ }

/* PC 화면 스타일 */
@media (min-width: 768px) {
  .widget-layout {
    grid-template-columns: 1fr 1.5fr; /* 좌우 비율 조정 */
    gap: 25px; /* PC에서 섹션 간 간격 */
  }
  .profile-info-section {
    border-right: 1px solid #e9ecef; /* PC에서 구분선 */
    border-bottom: none; /* PC에서 하단 구분선 제거 */
  }
  .profile-details-section {
      padding: 25px 0 25px 25px; /* 좌측 패딩 추가 */
  }
  .summary-item span { font-size: 1.6em; }
  .setting-item { min-height: 120px; }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
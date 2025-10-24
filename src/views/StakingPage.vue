<template>
  <div class="staking-page-container">
    <header class="page-header">
      <h1><i class="fas fa-university"></i> SaltMate 정기예금</h1>
      <p>안정적인 이율로 SaltMate 자산을 증식하세요.</p>
    </header>

    <div class="staking-content-layout">
      <section class="staking-form card pristine-white-card">
        <h2><i class="fas fa-edit"></i> 예금 신청</h2>
        <form @submit.prevent="submitStaking">
          <div class="form-group">
            <label for="amount">
              <i class="fas fa-coins"></i> 예치 금액 (최소 1,000)
            </label>
            <div class="input-group">
              <input type="number" id="amount" v-model.number="depositAmount" min="1000" step="1000" placeholder="1,000 단위 입력">
              <span class="currency-unit">SaltMate</span>
            </div>
            <p class="balance-info">현재 보유: {{ userProfile?.saltmatePoints?.toLocaleString() || 0 }} SaltMate</p>
          </div>
          <div class="form-group">
            <label for="duration">
              <i class="fas fa-calendar-alt"></i> 예치 기간 선택
            </label>
            <div class="select-wrapper">
              <select id="duration" v-model.number="depositDuration">
                <option value="30">30일 (연 {{ calculateAnnualRate(30) }}%)</option>
                <option value="90">90일 (연 {{ calculateAnnualRate(90) }}%)</option>
                <option value="180">180일 (연 {{ calculateAnnualRate(180) }}%)</option>
              </select>
            </div>
          </div>
          <div class="payout-preview">
            <p><strong>만기 예상 지급액:</strong></p>
            <p class="expected-amount">{{ expectedPayout.toLocaleString() }} SaltMate</p>
            <p class="interest-rate">(기간 내 {{ getPeriodRate(depositDuration) }}% 이율 적용)</p>
          </div>
          <button type="submit" class="submit-button" :disabled="isLoading || depositAmount < 1000">
            <span v-if="isLoading" class="spinner-small-light"></span>
            {{ isLoading ? '처리 중...' : '예금 신청하기' }}
          </button>
        </form>
      </section>

      <section class="staking-list card pristine-white-card">
        <h2><i class="fas fa-history"></i> 나의 예금 내역</h2>
        <div v-if="stakings.length > 0" class="staking-items-container">
          <ul>
            <li v-for="staking in stakings" :key="staking.id" :class="['staking-item', `status-${staking.status}`]">
              <div class="item-header">
                 <span class="status-icon" :title="getStatusText(staking.status)">
                    <i v-if="staking.status === 'active'" class="fas fa-hourglass-half"></i>
                    <i v-else-if="staking.status === 'matured'" class="fas fa-check-circle"></i>
                    <i v-else-if="staking.status === 'cancelled'" class="fas fa-times-circle"></i>
                    <i v-else class="fas fa-exclamation-circle"></i>
                 </span>
                 <strong class="item-amount">{{ staking.amount.toLocaleString() }} SaltMate</strong>
              </div>
              <div class="item-details">
                <p><strong>기간:</strong> {{ staking.durationDays }}일 (연 {{ calculateAnnualRate(staking.durationDays) }}%)</p>
                <p><strong>예치일:</strong> {{ formatDate(staking.depositDate) }}</p>
                <p><strong>만기일:</strong> {{ formatDate(staking.maturityDate) }}</p>
                <p v-if="staking.status === 'matured'"><strong>최종 지급액:</strong> <span class="payout-amount">{{ staking.payoutAmount.toLocaleString() }} SaltMate</span></p>
                <p v-else><strong>예상 만기액:</strong> {{ staking.payoutAmount.toLocaleString() }} SaltMate</p>
              </div>
            </li>
          </ul>
        </div>
        <p v-else class="no-data">
          <i class="fas fa-info-circle"></i> 예금 내역이 없습니다.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db, functions } from '@/firebaseConfig';

let unsubscribe = null;

const userProfile = inject('userProfile', ref(null));

const isLoading = ref(false);
const depositAmount = ref(1000);
const depositDuration = ref(30);
const stakings = ref([]);

const stakeSaltmateFunc = httpsCallable(functions, 'stakeSaltmate');

// 기간별 이율 (기간 내 적용될 실제 이율)
const periodRates = { 30: 0.03, 90: 0.10, 180: 0.25 };

// 예상 지급액 계산
const expectedPayout = computed(() => {
  const rate = periodRates[depositDuration.value] || 0;
  return Math.floor((depositAmount.value || 0) * (1 + rate));
});

// 연 이율 환산 함수 (표시용)
const calculateAnnualRate = (durationDays) => {
  const rate = periodRates[durationDays] || 0;
  // (1 + 기간이율)^(365/기간) - 1 로 계산하거나, 단순 비례로 계산
  // 여기서는 단순 비례로 계산 (예: 30일 3% -> 연 36%)
  const annualRate = (rate / durationDays) * 365 * 100;
  return annualRate.toFixed(1); // 소수점 첫째 자리까지 표시
};

// 기간 내 이율 가져오는 함수
const getPeriodRate = (durationDays) => {
    return ((periodRates[durationDays] || 0) * 100).toFixed(1);
};


const submitStaking = async () => {
  if (isLoading.value || depositAmount.value < 1000) {
      alert("최소 예치 금액은 1,000 SaltMate 입니다.");
      return;
  }
  if (!confirm(`${depositAmount.value.toLocaleString()} SaltMate를 ${depositDuration.value}일간 예치하시겠습니까?\n(예상 만기 지급액: ${expectedPayout.value.toLocaleString()} SaltMate)`)) return;

  isLoading.value = true;
  try {
    const result = await stakeSaltmateFunc({ amount: depositAmount.value, durationDays: depositDuration.value });
    alert(result.data.message);
    depositAmount.value = 1000; // 폼 초기화
  } catch (error) {
    console.error("예금 신청 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp; // Date 객체도 처리 가능하게
  if (!(date instanceof Date) || isNaN(date)) return '-';
  // 날짜 형식 변경: YYYY. MM. DD.
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\.$/, '');
};


const getStatusText = (status) => {
  switch (status) {
    case 'active': return '예치 중';
    case 'matured': return '만기됨';
    case 'cancelled': return '중도 해지';
    case 'error': return '오류';
    default: return status;
  }
};

onMounted(() => {
  if (auth.currentUser) {
    const q = query(collection(db, 'users', auth.currentUser.uid, 'stakings'), orderBy('depositDate', 'desc'));
    unsubscribe = onSnapshot(q, (snapshot) => {
      stakings.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, (error) => {
        console.error("예금 내역 조회 중 오류:", error);
        // 사용자에게 오류 알림 (선택적)
    });
  }
});

onUnmounted(() => {
    if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
/* --- 전역 & 레이아웃 --- */
.staking-page-container {
  padding: 20px;
  max-width: 900px; /* 최대 너비 증가 */
  margin: 80px auto 40px; /* 상단 여백 증가 */
  font-family: 'Noto Sans KR', sans-serif; /* 가독성 좋은 폰트 */
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}
.page-header h1 {
  font-size: 2.5em; /* 크기 조정 */
  color: #1A237E; /* 진한 네이비 */
  font-weight: 700;
  margin-bottom: 10px;
}
.page-header h1 i {
  color: #3949AB; /* 중간톤 블루 */
  margin-right: 10px;
}
.page-header p {
  font-size: 1.1em;
  color: #546E7A; /* 차분한 회색 */
}

.staking-content-layout {
  display: grid;
  grid-template-columns: 1fr; /* 모바일 기본 1열 */
  gap: 30px;
}

.card { /* 기본 카드 스타일 제거 - 아래 .pristine-white-card 사용 */
    margin-bottom: 0; /* 레이아웃 gap으로 간격 관리 */
}
.pristine-white-card {
  background: #FFFFFF;
  padding: 30px; /* 패딩 증가 */
  border-radius: 12px; /* 부드러운 모서리 */
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08); /* 그림자 강화 */
  border: 1px solid #E0E0E0; /* 얇은 테두리 */
}

/* --- 예금 신청 폼 --- */
.staking-form h2 {
  font-size: 1.6em;
  color: #283593; /* 헤더 색상 */
  margin: 0 0 25px 0;
  padding-bottom: 15px;
  border-bottom: 1px solid #CFD8DC; /* 연한 구분선 */
  display: flex;
  align-items: center;
  gap: 10px;
}
.staking-form h2 i {
    color: #3949AB;
}

.form-group {
  margin-bottom: 25px;
}
.form-group label {
  display: flex; /* 아이콘과 함께 표시 */
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 500;
  color: #37474F; /* 레이블 색상 */
  font-size: 1em;
}
.form-group label i {
    color: #78909C; /* 아이콘 색상 */
    width: 18px;
    text-align: center;
}

.input-group {
  display: flex;
  align-items: center;
}
.input-group input {
  flex-grow: 1;
  padding: 12px 15px; /* 패딩 증가 */
  border: 1px solid #B0BEC5; /* 테두리 색상 조정 */
  border-radius: 6px 0 0 6px;
  font-size: 1em;
  transition: border-color 0.2s;
  appearance: textfield; /* 스피너 제거 */
  -moz-appearance: textfield;
}
.input-group input::-webkit-outer-spin-button,
.input-group input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.input-group input:focus {
  outline: none;
  border-color: #3949AB;
  box-shadow: 0 0 0 2px rgba(57, 73, 171, 0.2);
}
.currency-unit {
  padding: 12px 15px;
  background-color: #ECEFF1; /* 배경색 */
  border: 1px solid #B0BEC5;
  border-left: none;
  border-radius: 0 6px 6px 0;
  color: #546E7A;
  font-weight: 500;
}
.balance-info {
  font-size: 0.85em;
  color: #78909C;
  margin-top: 8px;
  text-align: right;
}

.select-wrapper {
  position: relative;
}
.select-wrapper::after { /* 커스텀 화살표 */
  content: '\f078'; /* Font Awesome down arrow */
  font-family: 'Font Awesome 5 Free';
  font-weight: 900;
  position: absolute;
  top: 50%;
  right: 15px;
  transform: translateY(-50%);
  color: #78909C;
  pointer-events: none;
}
.form-group select {
  width: 100%;
  padding: 12px 40px 12px 15px; /* 오른쪽 패딩 추가 */
  border: 1px solid #B0BEC5;
  border-radius: 6px;
  font-size: 1em;
  background-color: white;
  appearance: none; /* 기본 화살표 제거 */
  -webkit-appearance: none;
  -moz-appearance: none;
  cursor: pointer;
  transition: border-color 0.2s;
}
.form-group select:focus {
  outline: none;
  border-color: #3949AB;
  box-shadow: 0 0 0 2px rgba(57, 73, 171, 0.2);
}

.payout-preview {
  margin-top: 30px;
  padding: 15px;
  background-color: #F5F5F5; /* 연한 회색 배경 */
  border-radius: 6px;
  text-align: center;
}
.payout-preview p { margin: 5px 0; }
.payout-preview strong { color: #37474F; }
.payout-preview .expected-amount {
  font-size: 1.5em;
  font-weight: 700;
  color: #1A237E; /* 강조색 */
}
.payout-preview .interest-rate {
    font-size: 0.9em;
    color: #546E7A;
}

.submit-button {
  width: 100%;
  padding: 14px; /* 패딩 증가 */
  margin-top: 30px;
  font-size: 1.1em;
  font-weight: 600;
  background-color: #3949AB; /* 브랜드 블루 */
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  display: flex; /* 스피너 중앙 정렬 */
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.submit-button:hover:not(:disabled) {
  background-color: #283593; /* 더 진한 블루 */
  transform: translateY(-1px);
}
.submit-button:disabled {
  background-color: #9FA8DA; /* 비활성 색상 */
  cursor: not-allowed;
}

.spinner-small-light {
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid #fff;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
    display: inline-block;
}

/* --- 예금 내역 리스트 --- */
.staking-list h2 { /* 폼과 동일한 스타일 적용 */
  font-size: 1.6em; color: #283593; margin: 0 0 25px 0; padding-bottom: 15px; border-bottom: 1px solid #CFD8DC; display: flex; align-items: center; gap: 10px;
}
.staking-list h2 i { color: #3949AB; }

.staking-items-container {
    max-height: 400px; /* 스크롤 가능하도록 최대 높이 지정 */
    overflow-y: auto; /* 세로 스크롤 */
    padding-right: 10px; /* 스크롤바 공간 */
}
/* 스크롤바 스타일링 (선택적) */
.staking-items-container::-webkit-scrollbar { width: 6px; }
.staking-items-container::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.staking-items-container::-webkit-scrollbar-thumb { background: #B0BEC5; border-radius: 3px; }
.staking-items-container::-webkit-scrollbar-thumb:hover { background: #78909C; }


.staking-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.staking-item {
  border: 1px solid #E0E0E0;
  border-left-width: 5px; /* 상태 색상 표시 */
  border-radius: 8px;
  margin-bottom: 15px;
  overflow: hidden; /* 내부 요소 border-radius 적용 */
}
.item-header {
  padding: 12px 15px;
  background-color: #F5F5F5; /* 헤더 배경색 */
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #E0E0E0;
}
.status-icon {
  font-size: 1.2em;
}
.item-amount {
  font-weight: 600;
  font-size: 1.1em;
  color: #283593;
}

.item-details {
  padding: 15px;
  font-size: 0.9em;
  color: #546E7A;
  line-height: 1.6;
}
.item-details p { margin: 5px 0; }
.item-details strong { color: #37474F; margin-right: 5px; }

/* 상태별 스타일 */
.staking-item.status-active { border-left-color: #3949AB; }
.staking-item.status-active .status-icon { color: #3949AB; }
.staking-item.status-matured { border-left-color: #2E7D32; /* 진한 녹색 */ }
.staking-item.status-matured .status-icon { color: #2E7D32; }
.staking-item.status-matured .payout-amount { color: #2E7D32; font-weight: bold; }
.staking-item.status-cancelled { border-left-color: #C62828; /* 진한 빨강 */ opacity: 0.8; }
.staking-item.status-cancelled .status-icon { color: #C62828; }
.staking-item.status-error { border-left-color: #FF8F00; /* 주황색 */ }
.staking-item.status-error .status-icon { color: #FF8F00; }

.no-data {
  text-align: center;
  color: #78909C;
  padding: 30px 0;
  font-size: 1em;
}
.no-data i {
    margin-right: 8px;
}

/* --- PC 화면 스타일 --- */
@media (min-width: 768px) {
  .staking-content-layout {
    grid-template-columns: 1fr 1.2fr; /* 왼쪽 폼, 오른쪽 리스트 비율 조정 */
    gap: 40px; /* 간격 증가 */
  }
  .staking-form h2, .staking-list h2 {
      font-size: 1.8em;
  }
}
/* ▼▼▼ [핵심 수정] 모바일 화면 스타일 추가 ▼▼▼ */
@media (max-width: 767px) {
  .staking-page-container {
    padding: 10px; /* 모바일 페이지 좌우 여백 축소 */
  }
  .page-header h1 {
    font-size: 2em; /* 헤더 폰트 크기 축소 */
  }
  .pristine-white-card {
    padding: 20px; /* 카드 내부 여백 축소 */
  }
  .staking-form h2, .staking-list h2 {
    font-size: 1.4em; /* h2 폰트 크기 축소 */
    padding-bottom: 10px;
    margin-bottom: 20px;
  }
  .input-group input,
  .input-group .currency-unit,
  .form-group select {
    padding: 10px; /* 입력창 패딩 축소 */
    font-size: 0.95em;
  }
  .payout-preview .expected-amount {
    font-size: 1.3em; /* 예상 지급액 폰트 축소 */
  }
  .submit-button {
    padding: 12px;
    font-size: 1em;
  }
  .staking-items-container {
    padding-right: 5px; /* 스크롤바 공간 축소 */
  }
  .item-details {
    padding: 12px;
  }
}
/* ▲▲▲ */
@keyframes spin { /* 스피너 애니메이션 */
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
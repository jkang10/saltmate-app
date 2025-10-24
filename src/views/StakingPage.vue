<template>
  <div class="staking-container mobile-padding">
    <h1>SaltMate 정기예금</h1>

    <div class="staking-form card">
      <h2>예금 신청</h2>
      <div class="form-group">
        <label for="amount">예치할 금액:</label>
        <input type="number" id="amount" v-model.number="depositAmount" min="1000" step="1000">
         <span>현재 보유: {{ userProfile?.saltmatePoints?.toLocaleString() || 0 }} SaltMate</span>
      </div>
      <div class="form-group">
        <label for="duration">예치 기간:</label>
        <select id="duration" v-model.number="depositDuration">
          <option value="30">30일 (예상 이율: 3%)</option>
          <option value="90">90일 (예상 이율: 10%)</option>
          <option value="180">180일 (예상 이율: 25%)</option>
        </select>
      </div>
      <p>만기 시 예상 지급액: {{ expectedPayout.toLocaleString() }} SaltMate</p>
      <button @click="submitStaking" :disabled="isLoading || depositAmount <= 0">
        {{ isLoading ? '처리 중...' : '예금 신청하기' }}
      </button>
    </div>

    <div class="staking-list card">
      <h2>나의 예금 내역</h2>
      <ul v-if="stakings.length > 0">
        <li v-for="staking in stakings" :key="staking.id" :class="`status-${staking.status}`">
          <div><strong>금액:</strong> {{ staking.amount.toLocaleString() }} SaltMate</div>
          <div><strong>기간:</strong> {{ staking.durationDays }}일 (이율: {{ (staking.interestRate * 100).toFixed(1) }}%)</div>
          <div><strong>예치일:</strong> {{ formatDate(staking.depositDate) }}</div>
          <div><strong>만기일:</strong> {{ formatDate(staking.maturityDate) }}</div>
          <div><strong>상태:</strong> {{ getStatusText(staking.status) }}</div>
          <div v-if="staking.status === 'matured'"><strong>지급액:</strong> {{ staking.payoutAmount.toLocaleString() }} SaltMate</div>
          </li>
      </ul>
      <p v-else>예금 내역이 없습니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, inject } from 'vue'; // onUnmounted 추가
import { httpsCallable } from 'firebase/functions';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db, functions } from '@/firebaseConfig';

let unsubscribe = null; // 상단에 선언

// App.vue 등 상위 컴포넌트에서 provide된 userProfile 사용 (없으면 직접 가져와야 함)
const userProfile = inject('userProfile', ref(null)); // 예시, 실제 provide key 확인 필요

const isLoading = ref(false);
const depositAmount = ref(1000);
const depositDuration = ref(30);
const stakings = ref([]);

const stakeSaltmateFunc = httpsCallable(functions, 'stakeSaltmate');

const expectedPayout = computed(() => {
  const rates = { 30: 0.03, 90: 0.10, 180: 0.25 };
  const rate = rates[depositDuration.value] || 0;
  return Math.floor((depositAmount.value || 0) * (1 + rate));
});

const submitStaking = async () => {
  if (isLoading.value || depositAmount.value <= 0) return;
  if (!confirm(`${depositAmount.value.toLocaleString()} SaltMate를 ${depositDuration.value}일간 예치하시겠습니까?`)) return;

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
  // Firestore Timestamp 객체인지 확인 후 toDate() 사용
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('ko-KR');
};

const getStatusText = (status) => {
  switch (status) {
    case 'active': return '예치 중';
    case 'matured': return '만기됨 (지급 완료)';
    case 'cancelled': return '중도 해지';
    case 'error': return '오류 발생';
    default: return status;
  }
};

onMounted(() => {
  if (!auth.currentUser) return;
  const q = query(collection(db, 'users', auth.currentUser.uid, 'stakings'), orderBy('depositDate', 'desc'));
  unsubscribe = onSnapshot(q, (snapshot) => { // 할당
    stakings.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
});

// onUnmounted 훅 추가
onUnmounted(() => {
    if (unsubscribe) unsubscribe(); // 컴포넌트 제거 시 리스너 해제
});

</script>

<style scoped>
/* 모바일 우선 스타일 */
.staking-container { padding: 15px; max-width: 600px; margin: 20px auto; }
.card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
.form-group input, .form-group select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
.form-group span { font-size: 0.9em; color: #555; display: block; margin-top: 5px;}
button { padding: 10px 15px; background-color: #2ecc71; color: white; border: none; border-radius: 4px; cursor: pointer; }
button:disabled { background-color: #bdc3c7; cursor: not-allowed; }
.staking-list ul { list-style: none; padding: 0; }
.staking-list li { border: 1px solid #eee; border-radius: 4px; padding: 15px; margin-bottom: 10px; }
.staking-list li.status-matured { border-left: 5px solid #2ecc71; }
.staking-list li.status-active { border-left: 5px solid #3498db; }
.staking-list li.status-cancelled { border-left: 5px solid #e74c3c; opacity: 0.7; }

/* PC 화면 스타일 */
@media (min-width: 768px) {
  .staking-form { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: end; }
  .staking-form h2 { grid-column: 1 / -1; margin-bottom: 0; }
  .staking-form button { grid-column: 1 / -1; width: 100%; }
}
</style>
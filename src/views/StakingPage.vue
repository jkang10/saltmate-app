<template>
  <div class="staking-page-container">
    <div class="bg-glow"></div>

    <header class="page-header">
      <div class="header-content">
        <h1>
          <i class="fas fa-crown gold-icon"></i> 
          Royal Salt Vault
        </h1>
        <p>당신의 자산이 황금처럼 불어나는 공간, 솔트메이트 정기예금</p>
      </div>
      
      <div class="my-asset-badge">
        <span>보유 자산</span>
        <strong>{{ (userProfile?.saltmatePoints || 0).toLocaleString() }} P</strong>
      </div>
    </header>

    <div class="staking-content-layout">
      <section class="staking-form card gold-card">
        <div class="card-header-gold">
          <h2><i class="fas fa-vault"></i> 예금 상품 가입</h2>
          <span class="header-deco">VIP CLASS</span>
        </div>

        <form @submit.prevent="submitStaking">
          <div class="form-group">
            <label>예치할 금액 (최소 1,000)</label>
            <div class="input-wrapper premium-input">
              <input 
                type="number" 
                v-model.number="depositAmount" 
                min="1000" 
                step="1000" 
                placeholder="금액 입력"
              >
              <span class="unit">SaltMate</span>
            </div>
          </div>

          <div class="form-group">
            <label>기간 및 이율 선택</label>
            <div class="duration-cards">
              <div 
                v-for="option in durationOptions" 
                :key="option.days"
                class="duration-card"
                :class="{ active: depositDuration === option.days }"
                @click="depositDuration = option.days"
              >
                <div class="days">{{ option.days }}일</div>
                <div class="rate-badge">연 {{ calculateAnnualRate(option.days) }}%</div>
                <div class="period-rate">총 {{ getPeriodRate(option.days) }}% 수익</div>
              </div>
            </div>
          </div>

          <div class="profit-simulation">
            <div class="sim-row">
              <span>원금</span>
              <span>{{ depositAmount.toLocaleString() }} P</span>
            </div>
            <div class="sim-row plus">
              <span>+ 예상 이자 수익</span>
              <span class="highlight">+{{ (expectedPayout - depositAmount).toLocaleString() }} P</span>
            </div>
            <div class="divider"></div>
            <div class="sim-row total">
              <span>만기 수령액</span>
              <strong class="gold-text">{{ expectedPayout.toLocaleString() }} P</strong>
            </div>
          </div>

          <button type="submit" class="submit-button luxury-btn" :disabled="isLoading || depositAmount < 1000">
            <span v-if="isLoading" class="spinner"></span>
            <span v-else>황금 금고에 예치하기</span>
            <div class="shine"></div>
          </button>
        </form>
      </section>

      <section class="staking-list card glass-card">
        <div class="list-header">
          <h2><i class="fas fa-history"></i> 나의 포트폴리오</h2>
        </div>

        <div v-if="stakings.length > 0" class="staking-items-container">
          <transition-group name="list">
            <div v-for="staking in stakings" :key="staking.id" :class="['staking-ticket', `status-${staking.status}`]">
              <div class="ticket-status">
                <span v-if="staking.status === 'active'" class="badge active">
                  <i class="fas fa-hourglass-half"></i> 이자 쌓이는 중
                </span>
                <span v-else-if="staking.status === 'matured'" class="badge matured">
                  <i class="fas fa-check-circle"></i> 정산 완료 (지급됨)
                </span>
                <span v-else class="badge">{{ staking.status }}</span>
                <span class="date">{{ formatDate(staking.depositDate) }} 가입</span>
              </div>

              <div class="ticket-body">
                <div class="info-group">
                  <label>예치 원금</label>
                  <div class="amount">{{ staking.amount.toLocaleString() }} P</div>
                </div>
                <div class="arrow"><i class="fas fa-arrow-right"></i></div>
                <div class="info-group highlight">
                  <label>{{ staking.status === 'matured' ? '최종 수령액' : '만기 예상액' }}</label>
                  <div class="amount gold">{{ staking.payoutAmount.toLocaleString() }} P</div>
                </div>
              </div>

              <div v-if="staking.status === 'active'" class="progress-area">
                <div class="progress-info">
                  <span>만기일: {{ formatDate(staking.maturityDate) }}</span>
                  <span>{{ calculateProgress(staking) }}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-bar" :style="{ width: calculateProgress(staking) + '%' }"></div>
                </div>
              </div>
            </div>
          </transition-group>
        </div>
        
        <div v-else class="no-data">
          <i class="fas fa-coins"></i>
          <p>아직 예치된 자산이 없습니다.<br>지금 시작하여 부를 축적하세요!</p>
        </div>
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

// 기간별 설정 (확장성을 위해 배열로 관리)
const durationOptions = [
  { days: 30, rate: 0.03 },
  { days: 90, rate: 0.10 },
  { days: 180, rate: 0.25 }
];

const periodRates = { 30: 0.03, 90: 0.10, 180: 0.25 };

// 예상 지급액
const expectedPayout = computed(() => {
  const rate = periodRates[depositDuration.value] || 0;
  return Math.floor((depositAmount.value || 0) * (1 + rate));
});

// 연 이율 계산
const calculateAnnualRate = (durationDays) => {
  const rate = periodRates[durationDays] || 0;
  const annualRate = (rate / durationDays) * 365 * 100;
  return annualRate.toFixed(1);
};

// 기간 수익률
const getPeriodRate = (durationDays) => {
  return ((periodRates[durationDays] || 0) * 100).toFixed(1);
};

// 진행률 계산 (현재 날짜 기준)
const calculateProgress = (staking) => {
  if (staking.status !== 'active') return 100;
  
  const start = staking.depositDate instanceof Timestamp ? staking.depositDate.toDate() : new Date(staking.depositDate);
  const end = staking.maturityDate instanceof Timestamp ? staking.maturityDate.toDate() : new Date(staking.maturityDate);
  const now = new Date();
  
  const total = end.getTime() - start.getTime();
  const current = now.getTime() - start.getTime();
  
  let percent = (current / total) * 100;
  return Math.min(100, Math.max(0, percent)).toFixed(1);
};

const submitStaking = async () => {
  if (isLoading.value || depositAmount.value < 1000) {
      alert("최소 예치 금액은 1,000 SaltMate 입니다.");
      return;
  }
  
  // 고급스러운 컨펌 메시지
  const profit = expectedPayout.value - depositAmount.value;
  const msg = `[정기예금 가입 확인]\n\n💎 예치 금액: ${depositAmount.value.toLocaleString()} P\n📅 기간: ${depositDuration.value}일\n💰 예상 수익: +${profit.toLocaleString()} P\n\n진행하시겠습니까?`;
  
  if (!confirm(msg)) return;

  isLoading.value = true;
  try {
    await stakeSaltmateFunc({ amount: depositAmount.value, durationDays: depositDuration.value });
    alert("가입이 완료되었습니다! '나의 포트폴리오'에서 확인하세요.");
    depositAmount.value = 1000;
  } catch (error) {
    console.error("예금 신청 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return '-';
  return date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
};

onMounted(() => {
  if (auth.currentUser) {
    const q = query(collection(db, 'users', auth.currentUser.uid, 'stakings'), orderBy('depositDate', 'desc'));
    unsubscribe = onSnapshot(q, (snapshot) => {
      stakings.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');

.staking-page-container {
  position: relative;
  padding: 20px;
  max-width: 1000px;
  margin: 80px auto 40px;
  font-family: 'Noto Sans KR', sans-serif;
  color: #ecf0f1;
}

/* 배경 은은한 빛 효과 */
.bg-glow {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 80vw; height: 80vh;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, rgba(0,0,0,0) 70%);
  z-index: -1;
  pointer-events: none;
}

/* 헤더 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
}
.header-content h1 {
  font-size: 2.5em;
  font-weight: 900;
  margin: 0;
  background: linear-gradient(to right, #fff, #FFD700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
}
.gold-icon { color: #FFD700; -webkit-text-fill-color: initial; text-shadow: 0 0 10px rgba(255, 215, 0, 0.6); }
.header-content p {
  margin: 5px 0 0;
  color: #bdc3c7;
  font-size: 1rem;
}

.my-asset-badge {
  text-align: right;
  background: rgba(0, 0, 0, 0.4);
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.my-asset-badge span { display: block; font-size: 0.8rem; color: #aaa; }
.my-asset-badge strong { font-size: 1.4rem; color: #FFD700; letter-spacing: 1px; }

/* 레이아웃 */
.staking-content-layout {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 30px;
}

/* 카드 공통 */
.card {
  border-radius: 16px;
  overflow: hidden;
}

/* 1. 금고 카드 (왼쪽 Form) */
.gold-card {
  background: linear-gradient(145deg, #1e2a3a, #111827);
  border: 1px solid #FFD700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.15);
  padding: 25px;
}
.card-header-gold {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
  padding-bottom: 15px;
}
.card-header-gold h2 {
  margin: 0; font-size: 1.4rem; color: #fff; display: flex; align-items: center; gap: 10px;
}
.card-header-gold i { color: #FFD700; }
.header-deco {
  font-size: 0.7rem; font-weight: bold; color: #111;
  background: #FFD700; padding: 2px 8px; border-radius: 4px;
  letter-spacing: 1px;
}

.form-group { margin-bottom: 25px; }
.form-group label { display: block; margin-bottom: 10px; font-size: 0.95rem; color: #cfd8dc; }

.premium-input {
  display: flex;
  background: rgba(0,0,0,0.3);
  border: 1px solid #444;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.3s;
}
.premium-input:focus-within { border-color: #FFD700; box-shadow: 0 0 8px rgba(255, 215, 0, 0.3); }
.premium-input input {
  flex: 1; background: transparent; border: none; color: white;
  padding: 15px; font-size: 1.1rem; font-weight: bold; outline: none;
}
.premium-input .unit {
  padding: 15px; background: #333; color: #ccc; font-size: 0.9rem;
}

/* 기간 선택 카드 */
.duration-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.duration-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 5px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.duration-card:hover { background: rgba(255, 255, 255, 0.1); }
.duration-card.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: #FFD700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.2);
}
.duration-card .days { font-size: 1.1rem; font-weight: bold; margin-bottom: 2px; color: #fff; }
.duration-card .rate-badge { font-size: 0.75rem; color: #FFD700; margin-bottom: 2px; }
.duration-card .period-rate { font-size: 0.65rem; color: #aaa; }

/* 수익 시뮬레이션 */
.profit-simulation {
  background: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  padding: 15px;
  margin-top: 20px;
}
.sim-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; color: #ccc; }
.sim-row.plus { color: #FFD700; font-size: 1rem; }
.sim-row.total { font-size: 1.2rem; margin-top: 5px; color: #fff; }
.highlight { font-weight: bold; color: #FFD700; }
.gold-text { color: #FFD700; text-shadow: 0 0 5px rgba(255,215,0,0.5); }
.divider { height: 1px; background: rgba(255,255,255,0.2); margin: 8px 0; }

/* 버튼 */
.luxury-btn {
  width: 100%; padding: 16px; margin-top: 25px;
  font-size: 1.1rem; font-weight: bold; color: #000;
  background: linear-gradient(135deg, #FFD700, #FDB931);
  border: none; border-radius: 8px; cursor: pointer;
  position: relative; overflow: hidden; transition: transform 0.1s;
  box-shadow: 0 5px 15px rgba(253, 185, 49, 0.4);
}
.luxury-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(253, 185, 49, 0.6); }
.luxury-btn:active { transform: scale(0.98); }
.luxury-btn:disabled { background: #555; color: #888; box-shadow: none; cursor: not-allowed; }

/* 2. 내역 카드 (오른쪽 List) */
.glass-card {
  background: rgba(30, 40, 55, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 25px;
  display: flex; flex-direction: column;
  height: fit-content;
}
.list-header h2 { margin: 0 0 20px; font-size: 1.4rem; display: flex; gap: 10px; align-items: center; }

.staking-items-container {
  max-height: 600px;
  overflow-y: auto;
  padding-right: 5px;
}

/* 티켓 스타일 */
.staking-ticket {
  background: #252f3f;
  border-radius: 10px;
  margin-bottom: 15px;
  padding: 15px;
  border-left: 4px solid #444;
  position: relative;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
}
.staking-ticket.status-active { border-left-color: #3498db; }
.staking-ticket.status-matured { 
    border-left-color: #FFD700; 
    background: linear-gradient(to right, rgba(255, 215, 0, 0.05), transparent);
}

.ticket-status {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
}
.badge { 
  font-size: 0.8rem; font-weight: bold; padding: 3px 8px; border-radius: 4px; background: #444; color: #ccc; 
}
.badge.active { background: rgba(52, 152, 219, 0.2); color: #3498db; }
.badge.matured { background: rgba(255, 215, 0, 0.2); color: #FFD700; }
.ticket-status .date { font-size: 0.8rem; color: #777; }

.ticket-body {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
}
.info-group { display: flex; flex-direction: column; }
.info-group label { font-size: 0.75rem; color: #888; margin-bottom: 2px; }
.info-group .amount { font-size: 1.1rem; font-weight: bold; color: #eee; }
.info-group.highlight .amount { color: #FFD700; font-size: 1.2rem; }
.arrow { color: #555; }

/* 진행률 바 */
.progress-area { margin-top: 10px; }
.progress-info { display: flex; justify-content: space-between; font-size: 0.75rem; color: #aaa; margin-bottom: 4px; }
.progress-track {
  width: 100%; height: 6px; background: #444; border-radius: 3px; overflow: hidden;
}
.progress-bar {
  height: 100%; background: linear-gradient(90deg, #3498db, #00d2ff);
}

/* 스크롤바 */
.staking-items-container::-webkit-scrollbar { width: 4px; }
.staking-items-container::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
.staking-items-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }

.no-data {
  text-align: center; padding: 50px 0; color: #777;
}
.no-data i { font-size: 2.5rem; margin-bottom: 15px; opacity: 0.5; }

/* 애니메이션 */
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(10px); }

@media (max-width: 768px) {
  .staking-content-layout { grid-template-columns: 1fr; }
  .page-header { flex-direction: column; align-items: center; text-align: center; gap: 20px; }
  .my-asset-badge { text-align: center; width: 100%; }
}
.spinner {
  width: 20px; height: 20px; border: 3px solid rgba(0,0,0,0.3);
  border-radius: 50%; border-top-color: #000; animation: spin 1s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
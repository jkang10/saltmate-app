<template>
  <div class="token-mine-container">
    <div class="mine-header">
      <h2>나의 소금 토큰 광산</h2>
      <p>연료(SaltMate)를 사용하여 자동으로 채굴하거나, 일주일에 한 번 무료로 수동 채굴을 진행할 수 있습니다.</p>
    </div>

    <div class="balance-status card">
      <h3><i class="fas fa-wallet"></i> 나의 보유 자산</h3>
      <div class="balance-grid">
        <div class="balance-item">
          <span class="token-name">SaltMate (연료)</span>
          <span class="token-amount">{{ formatNumber(saltmatePoints) }} SaltMate</span>
        </div>
        <div class="balance-item">
          <span class="token-name">COBS</span>
          <span class="token-amount">{{ formatNumber(myTokens.cobs) }}</span>
        </div>
        <div class="balance-item">
          <span class="token-name">BND</span>
          <span class="token-amount">{{ formatNumber(myTokens.bnd) }}</span>
        </div>
      </div>
      <small class="token-note">(이 토큰은 Saltmate 금고에 보관되며, '출금' 메뉴에서 개인 지갑으로 전송할 수 있습니다.)</small>
    </div>

    <div class="mine-section card auto-mine">
      <div class="section-header">
        <i class="fas fa-robot icon-auto"></i>
        <h3>자동 채굴 (연료 사용)</h3>
      </div>
      <p class="section-description">
        SaltMate를 연료로 사용하여 광산을 자동으로 24시간 가동합니다.<br>
        실시간으로 BND가 채굴되며, 원할 때마다 '보상 수령'을 누르세요.
      </p>

      <div class="auto-mine-stats">
        <div class="stat-item">
          <strong>주간 연료 소모</strong>
          <span>4,000 SaltMate</span>
        </div>
        <div class="stat-item">
          <strong>나의 주간 BND 획득량</strong>
          <span>{{ formatNumber(weeklyBndReward) }} BND</span>
        </div>
        <div class="stat-item lucky-cobs">
          <strong>럭키 보상 (COBS)</strong>
          <span>(주간 1% 확률 / 0.1~1.0개)</span>
        </div>
      </div>

      <div class="fuel-status">
        <h4><i class="fas fa-gas-pump"></i> 현재 연료: <strong>{{ formatNumber(autoMineFuel, 2) }}</strong> / 4000 SaltMate</h4>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" :style="{ width: fuelPercentage + '%' }"></div>
        </div>
        <small v-if="autoMineFuel > 0">약 {{ formatNumber(remainingHours, 1) }} 시간 작동 가능</small>
        <small v-else>연료가 없습니다. 충전 후 자동 채굴이 시작됩니다.</small>
      </div>

      <div class="auto-mine-actions">
        <button @click="addFuel" :disabled="isProcessing || saltmatePoints < 4000" class="btn btn-fuel">
          <span v-if="!isProcessing">연료 충전하기 (4,000 SaltMate)</span>
          <span v-else>처리 중...</span>
        </button>
        <button @click="claimAutoReward" :disabled="isProcessing || calculatedAutoReward < 0.01" class="btn btn-claim">
          <span v-if="!isProcessing">실시간 보상 수령 ({{ formatNumber(calculatedAutoReward, 4) }} BND)</span>
          <span v-else>정산 중...</span>
        </button>
      </div>
    </div>

    <div class="mine-section card manual-mine">
      <div class="section-header">
        <i class="fas fa-tools icon-manual"></i>
        <h3>주간 수동 채굴 (무료)</h3>
      </div>
      <p class="section-description">
        일주일에 한 번, 무료로 광부에게 작업을 지시합니다. (주간 2 BND 고정)
      </p>

      <div class="mine-status">
        <div v-if="isLoading" class="loading-spinner"></div>
        <div v-else-if="canClaim" class="mine-action">
          <i class="fas fa-gem icon-success"></i>
          <h4>채굴 완료!</h4>
          <p>광부들이 일주일간의 작업을 마쳤습니다. 보상을 수령하세요.</p>
          <button @click="claimManualReward" :disabled="isProcessing" class="btn btn-claim-manual">
            <span v-if="!isProcessing">보상 받기 (BND +2)</span>
            <span v-else>처리 중...</span>
          </button>
        </div>
        <div v-else-if="isMining" class="mine-progress">
          <i class="fas fa-hourglass-half icon-progress"></i>
          <h4>채굴 진행 중...</h4>
          <p>다음 보상까지 남은 시간:</p>
          <div class="countdown">{{ countdown }}</div>
          <button class="btn btn-disabled" disabled>일주일 뒤 방문해주세요</button>
        </div>
        <div v-else class="mine-action">
          <i class="fas fa-play-circle icon-start"></i>
          <h4>광산이 쉬고 있습니다</h4>
          <p>광부들에게 주간 작업을 지시하여 BND 토큰 채굴을 시작하세요.</p>
          <button @click="startManualMining" :disabled="isProcessing" class="btn btn-start">
            <span v-if="!isProcessing">주간 채굴 시작하기</span>
            <span v-else>처리 중...</span>
          </button>
        </div>
      </div>
    </div>
    
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { db, auth, functions } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export default {
  name: 'TokenMine',
  setup() {
    // ... (setup 상단 상태 변수들은 변경 없음) ...
    const myTokens = reactive({ cobs: 0, bnd: 0 });
    const saltmatePoints = ref(0);
    const isLoading = ref(true);
    const isProcessing = ref(false);
    const errorMessage = ref(null);
    const now = ref(new Date());
    const manualMineState = reactive({ startTime: null, nextClaimTime: null });
    const autoMineFuel = ref(0);
    const autoMineLastChecked = ref(null);
    const weeklyBndReward = ref(5);
    const FUEL_COST_PER_WEEK = 4000;
    const SECONDS_PER_WEEK = 604800;
    const FUEL_RATE_PER_SECOND = FUEL_COST_PER_WEEK / SECONDS_PER_WEEK;
    let userUnsubscribe = null;
    let mineUnsubscribe = null;
    let timerInterval = null;
    const startManualMiningFunc = httpsCallable(functions, 'startWeeklyTokenMine');
    const claimManualRewardFunc = httpsCallable(functions, 'claimWeeklyTokenMine');
    const addAutoMineFuelFunc = httpsCallable(functions, 'addAutoMineFuel');
    const claimAutoMineRewardFunc = httpsCallable(functions, 'claimAutoMineReward');
    
    // ... (setupListeners, onMounted, onUnmounted 함수는 변경 없음) ...
    const setupListeners = (uid) => {
      const userRef = doc(db, 'users', uid);
      userUnsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const tokens = data.tokens || { bnd: 0, cobs: 0 };
          myTokens.bnd = tokens.bnd;
          myTokens.cobs = tokens.cobs;
          saltmatePoints.value = data.saltmatePoints || 0;
          if (data.tokenMineStats && data.tokenMineStats.weeklyBndReward) {
            weeklyBndReward.value = data.tokenMineStats.weeklyBndReward;
          }
        }
      });
      const mineRef = doc(db, 'users', uid, 'gamedata', 'tokenMine');
      mineUnsubscribe = onSnapshot(mineRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          manualMineState.startTime = data.startTime?.toDate();
          manualMineState.nextClaimTime = data.nextClaimTime?.toDate();
          autoMineFuel.value = data.autoMineFuel || 0;
          autoMineLastChecked.value = data.autoMineLastChecked?.toDate();
        } else {
          manualMineState.startTime = null;
          manualMineState.nextClaimTime = null;
          autoMineFuel.value = 0;
          autoMineLastChecked.value = null;
        }
        isLoading.value = false;
      });
    };

    onMounted(() => {
      const user = auth.currentUser;
      if (user) {
        setupListeners(user.uid);
      } else {
        isLoading.value = false;
        errorMessage.value = "로그인이 필요합니다.";
      }
      timerInterval = setInterval(() => { now.value = new Date(); }, 1000);
    });

    onUnmounted(() => {
      if (userUnsubscribe) userUnsubscribe();
      if (mineUnsubscribe) mineUnsubscribe();
      if (timerInterval) clearInterval(timerInterval);
    });

    // ... (수동 채굴 Computed, 자동 채굴 Computed는 변경 없음) ...
    const isMining = computed(() => {
      return manualMineState.nextClaimTime && manualMineState.nextClaimTime > now.value;
    });
    const canClaim = computed(() => {
      return manualMineState.nextClaimTime && manualMineState.nextClaimTime <= now.value;
    });
    const countdown = computed(() => {
      if (!isMining.value) return '00:00:00';
      const diff = manualMineState.nextClaimTime.getTime() - now.value.getTime();
      if (diff <= 0) return '00:00:00';
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
    });
    const fuelPercentage = computed(() => {
      return Math.min((autoMineFuel.value / FUEL_COST_PER_WEEK) * 100, 100);
    });
    const remainingHours = computed(() => {
      if (autoMineFuel.value <= 0) return 0;
      const remainingSeconds = autoMineFuel.value / FUEL_RATE_PER_SECOND;
      return remainingSeconds / 3600; // 시간
    });
    const calculatedAutoReward = computed(() => {
      if (!autoMineLastChecked.value || autoMineFuel.value <= 0) return 0;
      const elapsedSeconds = (now.value.getTime() - autoMineLastChecked.value.getTime()) / 1000;
      if (elapsedSeconds <= 0) return 0;
      const maxFuelToConsume = elapsedSeconds * FUEL_RATE_PER_SECOND;
      const consumedFuel = Math.min(autoMineFuel.value, maxFuelToConsume);
      const REWARD_RATE_PER_SECOND = weeklyBndReward.value / SECONDS_PER_WEEK;
      const earnedBnd = (consumedFuel / FUEL_RATE_PER_SECOND) * REWARD_RATE_PER_SECOND;
      return earnedBnd;
    });

    // ... (수동 채굴 Methods, 자동 채굴 addFuel Method는 변경 없음) ...
    const startManualMining = async () => {
      isProcessing.value = true;
      errorMessage.value = null;
      try {
        await startManualMiningFunc();
      } catch (error) { errorMessage.value = error.message; } 
      finally { isProcessing.value = false; }
    };
    const claimManualReward = async () => {
      isProcessing.value = true;
      errorMessage.value = null;
      try {
        const result = await claimManualRewardFunc();
        alert(`수동 채굴 보상 수령 완료! BND +${result.data.reward.bnd}`);
      } catch (error) { errorMessage.value = error.message; } 
      finally { isProcessing.value = false; }
    };
    const addFuel = async () => {
      if (saltmatePoints.value < 4000) {
        errorMessage.value = "연료로 충전할 SaltMate가 부족합니다.";
        return;
      }
      if (!confirm("4,000 SaltMate를 사용하여 자동 채굴기 연료를 충전하시겠습니까? (1주일 작동 분량, 1% 럭키 COBS 확률 적용)")) return;
      
      isProcessing.value = true;
      errorMessage.value = null;
      try {
        // [★수정★] addAutoMineFuel 함수는 이제 COBS 보상도 반환할 수 있음
        // (참고: COBS 보상 로직은 claimAutoMineReward로 이동했으므로 addFuel은 알림만 띄웁니다)
        await addAutoMineFuelFunc();
        alert("연료 4,000 SaltMate가 충전되었습니다. 자동 채굴이 즉시 시작/연장됩니다.");
      } catch (error) { errorMessage.value = error.message; } 
      finally { isProcessing.value = false; }
    };

    // [★수정★] 자동 채굴 claimAutoReward Method
    const claimAutoReward = async () => {
      if (calculatedAutoReward.value < 0.0001) {
        errorMessage.value = "정산할 보상이 없습니다.";
        return;
      }
      isProcessing.value = true;
      errorMessage.value = null;
      try {
        // [★수정★] 백엔드에서 earnedCobs 값을 반환받음
        const result = await claimAutoMineRewardFunc();
        const { earnedBnd, consumedFuel, earnedCobs } = result.data;
        
        let alertMsg = `자동 채굴 보상 수령 완료!\n\nBND: +${earnedBnd.toFixed(4)}\n연료 소모: -${consumedFuel.toFixed(2)} P`;
        
        // [★신규★] COBS 보상이 있으면 알림에 추가
        if (earnedCobs && earnedCobs > 0) {
          alertMsg += `\n\n🎉🎉🎉\n축하합니다! 럭키 보상으로 COBS +${earnedCobs.toFixed(4)}를 추가 획득했습니다!`;
        }
        
        alert(alertMsg);
        
      } catch (error) { errorMessage.value = error.message; } 
      finally { isProcessing.value = false; }
    };
    
    // ... (formatNumber 함수는 변경 없음) ...
    const formatNumber = (num, digits = 0) => {
      if (num == null) return 0;
      return num.toLocaleString(undefined, { 
        minimumFractionDigits: digits, 
        maximumFractionDigits: digits 
      });
    }

    return {
      myTokens, saltmatePoints, isLoading, isProcessing, errorMessage, now,
      manualMineState, isMining, canClaim, countdown, startManualMining, claimManualReward,
      autoMineFuel, weeklyBndReward, fuelPercentage, remainingHours, calculatedAutoReward, addFuel, claimAutoReward,
      formatNumber
    };
  }
}
</script>

<style scoped>
/* ... (기존 스타일 상단) ... */
.token-mine-container { max-width: 800px; margin: 2rem auto; padding: 1.5rem; }
.mine-header { text-align: center; margin-bottom: 2rem; }
.mine-header h2 { font-size: 2.5rem; color: #333; }
.card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  padding: 1.5rem 2rem;
  margin-bottom: 1.5rem;
}
.balance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; }
.balance-item { text-align: center; background: #f9f9f9; padding: 1rem; border-radius: 8px; }
.token-name { display: block; font-weight: bold; color: #007bff; }
.token-amount { display: block; font-size: 2rem; font-weight: bold; color: #333; margin-top: 0.5rem; }

/* [★신규★] 토큰 안내 문구 스타일 */
.token-note {
  display: block;
  text-align: center;
  margin-top: 1rem; /* 상단 그리드와 여백 */
  margin-bottom: 0.5rem; /* 카드 하단과 여백 */
  font-size: 0.9em;
  color: #666;
}

/* ... (섹션 공통 스타일) ... */
.mine-section {
  border-left-width: 5px;
  border-left-style: solid;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 15px;
}
.section-header h3 { margin: 0; font-size: 1.5rem; }
.section-description { font-size: 0.95rem; color: #555; margin-bottom: 20px; }

/* [수정] 자동 채굴 스타일 */
.mine-section.auto-mine { border-left-color: #6f42c1; }
.icon-auto { color: #6f42c1; }
.auto-mine-stats {
  display: grid;
  grid-template-columns: 1fr 1fr; /* 2열 유지 */
  gap: 1rem;
  margin-bottom: 20px;
  text-align: center;
}
.stat-item { background: #f9f9f9; padding: 1rem; border-radius: 8px; }
.stat-item strong { display: block; font-size: 0.9rem; color: #555; margin-bottom: 5px; }
.stat-item span { font-size: 1.3rem; font-weight: bold; color: #6f42c1; }

/* [★신규★] COBS 럭키 보상 아이템 스타일 */
.stat-item.lucky-cobs {
  grid-column: 1 / -1; /* 2열을 모두 차지하도록 */
  background: #fff8e1; /* 연한 노란색 배경 */
  border: 1px solid #ffe57f;
}
.stat-item.lucky-cobs strong { color: #f57f17; }
.stat-item.lucky-cobs span { color: #f9a825; font-size: 1.1rem; }


/* ... (나머지 스타일은 변경 없음) ... */
.fuel-status h4 { margin-bottom: 10px; font-size: 1.1rem; }
.fuel-status small { display: block; margin-top: 8px; font-size: 0.9rem; color: #777; }
.progress-bar-container { width: 100%; background-color: #e9ecef; border-radius: 20px; height: 10px; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #6f42c1, #8a2be2); border-radius: 20px; transition: width 0.5s ease; }

.auto-mine-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 20px;
}
.btn-fuel { background-color: #6f42c1; color: white; }
.btn-fuel:hover { background-color: #5a32a3; }
.mine-section.manual-mine { border-left-color: #007bff; }
.icon-manual { color: #007bff; }
.mine-status { text-align: center; padding-top: 1rem; }
.mine-action, .mine-progress { padding: 1rem 0; }
.mine-progress h4, .mine-action h4 { font-size: 1.2rem; margin-bottom: 10px; }
.icon-success { color: #28a745; font-size: 3rem; }
.icon-progress { color: #ffc107; font-size: 3rem; animation: spin 2s linear infinite; }
.icon-start { color: #007bff; font-size: 3rem; }
.countdown { font-size: 1.5rem; font-weight: bold; color: #333; margin: 0.5rem 0; }
.btn, .btn-fuel, .btn-claim, .btn-claim-manual, .btn-start, .btn-disabled {
  width: 100%;
  padding: 0.8rem 1rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.btn-start { background-color: #007bff; color: white; }
.btn-start:hover { background-color: #0056b3; }
.btn-claim { background-color: #28a745; color: white; }
.btn-claim:hover { background-color: #218838; }
.btn-claim-manual { background-color: #28a745; color: white; }
.btn-claim-manual:hover { background-color: #218838; }
.btn-disabled { background-color: #e9ecef; color: #6c757d; cursor: not-allowed; }
.btn:disabled, .btn-fuel:disabled, .btn-claim:disabled, .btn-claim-manual:disabled { opacity: 0.7; cursor: not-allowed; }
.error-message { color: #dc3545; margin-top: 1rem; text-align: center; font-weight: bold; }
.loading-spinner { 
  display: inline-block; 
  border: 4px solid rgba(0,0,0,0.1); 
  border-top-color: #007bff; 
  border-radius: 50%; 
  width: 40px; 
  height: 40px; 
  animation: spin 1s linear infinite; 
}
@keyframes spin { 
  to { transform: rotate(360deg); } 
}
</style>
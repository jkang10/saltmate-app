<template>
  <div class="token-mine-page" :style="pageStyle">
    
    <audio ref="audioPlayer" :src="pickaxeSound" loop preload="auto"></audio>

    <div class="mine-dashboard-card">
      
      <button @click="toggleSound" class="sound-toggle-btn">
        <i v-if="isSoundPlaying" class="fas fa-volume-up"></i>
        <i v-else class="fas fa-volume-mute"></i>
      </button>

      <h2><i class="fas fa-gem" style="color: #FFD700;"></i> 나의 소금 토큰 광산</h2>
      <p class="page-subtitle">이곳에서 당신의 가상 자산을 채굴하고 관리하세요.</p>

      <div class="balance-status">
        <h3><i class="fas fa-wallet"></i> 나의 금고</h3>
        <div class="balance-grid">
          <div class="balance-item">
            <span class="token-name">SaltMate (연료)</span>
            <span class="token-amount">{{ formatNumber(saltmatePoints) }} P</span>
          </div>
          <div class="balance-item">
            <span class="token-name">COBS</span>
            <span class="token-amount-cobs">{{ formatNumber(myTokens.cobs) }}</span>
          </div>
          <div class="balance-item">
            <span class="token-name">BND</span>
            <span class="token-amount-bnd">{{ formatNumber(myTokens.bnd) }}</span>
          </div>
        </div>
        <small class="token-note">(이 토큰은 Saltmate 금고에 보관되며, '출금' 메뉴에서 개인 지갑으로 전송할 수 있습니다.)</small>
      </div>

      <div class="mining-columns">
        
        <div class="mine-section auto-mine">
          <div class="section-header">
            <i class="fas fa-robot"></i>
            <h3>자동 채굴 (고급 채굴기)</h3>
          </div>
          <p class="section-description">
            SaltMate를 연료로 사용하여 광산을 24시간 가동합니다.
          </p>

          <div class="auto-mine-stats">
            
            <div class="stat-item"> 
              <strong>주간 연료 소모</strong>
              <span>4,000 SaltMate</span>
            </div> 
            <div class="stat-item">
              <strong>기본 획득량 (주간)</strong>
              <span class="highlight-bnd">{{ formatNumber(weeklyBndReward) }} BND</span>
            </div>

            <div class="stat-item meridian-bonus"> 
              <strong>메리디안 채굴기 <br>보너스 (주간)</strong> 
              <span class="highlight-bnd">+ {{ formatNumber(bonusBndReward) }} BND</span>
              <div class="flame-aura"></div> 
            </div>
            
            <div class="stat-item total-reward">
              <strong>총 주간 획득량</strong>
              <span class="highlight-total">{{ formatNumber(weeklyBndReward + bonusBndReward) }} BND</span>
            </div>
            
            <div class="stat-item lucky-cobs">
              <strong>럭키 보상 (COBS)</strong>
              <span class="highlight-cobs">(주간 1% 확률 / 0.1~1.0개)</span>
            </div>
            
          </div> <div class="fuel-status">
            <h4><i class="fas fa-gas-pump"></i> 현재 연료: <strong>{{ formatNumber(autoMineFuel, 2) }}</strong> / 4000 SaltMate</h4>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" :style="{ width: fuelPercentage + '%' }"></div>
            </div>
            <small v-if="autoMineFuel > 0">약 {{ formatNumber(remainingHours, 1) }} 시간 작동 가능</small>
            <small v-else>연료가 없습니다. 충전 후 자동 채굴이 시작됩니다.</small>
          </div>

          <div class="auto-mine-actions">
            <button @click="addFuel" :disabled="isProcessing || saltmatePoints < 4000" class="btn btn-premium">
              <span v-if="!isProcessing"><i class="fas fa-gas-pump"></i> 연료 충전 (4,000 P)</span>
              <span v-else>처리 중...</span>
            </button>
            <button @click="claimAutoReward" :disabled="isProcessing || calculatedAutoReward < 0.01" class="btn btn-premium-claim">
              <span v-if="!isProcessing"><i class="fas fa-gem"></i> 실시간 보상 수령 ({{ formatNumber(calculatedAutoReward, 4) }} BND)</span>
              <span v-else>정산 중...</span>
            </button>
          </div>
        </div>
        
        <div class="mine-section manual-mine">
          <div class="section-header">
            <i class="fas fa-tools"></i>
            <h3>주간 수동 채굴 (무료)</h3>
          </div>
          <p class="section-description">
            일주일에 한 번, 무료로 작업을 지시합니다. (주간 2 BND 고정)
          </p>

          <div class="mine-status">
            <div v-if="isLoading" class="loading-spinner"></div>
            <div v-else-if="canClaim" class="mine-action">
              <i class="fas fa-gem icon-success"></i>
              <h4>채굴 완료!</h4>
              <p>광부들이 일주일간의 작업을 마쳤습니다. 보상을 수령하세요.</p>
              <button @click="claimManualReward" :disabled="isProcessing" class="btn btn-premium-claim">
                <span v-if="!isProcessing">보상 받기 (BND +2)</span>
                <span v-else>처리 중...</span>
              </button>
            </div>
            <div v-else-if="isMining" class="mine-progress">
              <i class="fas fa-hourglass-half icon-progress"></i>
              <h4>채굴 진행 중...</h4>
              <p>남은 시간:</p>
              <div class="countdown">{{ countdown }}</div>
              <button class="btn btn-disabled" disabled>일주일 뒤 방문해주세요</button>
            </div>
            <div v-else class="mine-action">
              <i class="fas fa-play-circle icon-start"></i>
              <h4>광산이 쉬고 있습니다</h4>
              <p>광부들에게 주간 작업을 지시하여 BND 토큰 채굴을 시작하세요.</p>
              <button @click="startManualMining" :disabled="isProcessing" class="btn btn-premium">
                <span v-if="!isProcessing">주간 채굴 시작</span>
                <span v-else>처리 중...</span>
              </button>
            </div>
          </div>
        </div>

      </div>
      
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { db, auth, functions } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// [신규] 애셋 임포트
import mineBg from '@/assets/game_assets/saltmate_skin07.png';
import pickaxeSound from '@/assets/sounds/pickaxe01.mp3';

// [신규] 오디오 제어
const audioPlayer = ref(null);
const isSoundPlaying = ref(false);

const toggleSound = () => {
  if (audioPlayer.value) {
    if (isSoundPlaying.value) {
      audioPlayer.value.pause();
    } else {
      audioPlayer.value.play().catch(() => console.warn("오디오 자동재생이 차단되었습니다."));
    }
    isSoundPlaying.value = !isSoundPlaying.value;
  }
};

// [신규] 배경 이미지 스타일
const pageStyle = computed(() => ({
  backgroundImage: `url(${mineBg})`
}));

// --- (기존 setup() 로직) ---
const myTokens = reactive({ cobs: 0, bnd: 0 });
const saltmatePoints = ref(0);
const isLoading = ref(true);
const isProcessing = ref(false);
const errorMessage = ref(null);
const now = ref(new Date());
const manualMineState = reactive({ startTime: null, nextClaimTime: null });
const autoMineFuel = ref(0);
const autoMineLastChecked = ref(null);
const weeklyBndReward = ref(5); // 기본값

// ▼▼▼ [★신규★] 보너스 BND ref 추가 ▼▼▼
const bonusBndReward = ref(0);
// ▲▲▲ (추가 완료) ▲▲▲

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

const setupListeners = (uid) => {
  const userRef = doc(db, 'users', uid);
  userUnsubscribe = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const tokens = data.tokens || { bnd: 0, cobs: 0 };
      myTokens.bnd = tokens.bnd;
      myTokens.cobs = tokens.cobs;
      saltmatePoints.value = data.saltmatePoints || 0;
      
      // ▼▼▼ [★수정★] tokenMineStats에서 기본값과 보너스값 모두 가져오기 ▼▼▼
      if (data.tokenMineStats) {
        weeklyBndReward.value = data.tokenMineStats.weeklyBndReward || 5;
        bonusBndReward.value = data.tokenMineStats.bonusBnd || 0;
      } else {
        weeklyBndReward.value = 5;
        bonusBndReward.value = 0;
      }
      // ▲▲▲ (수정 완료) ▲▲▲
    }
  });
  // ... (mineUnsubscribe 리스너는 변경 없음)
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
  // ... (onMounted 로직 변경 없음) ...
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
  // ... (onUnmounted 로직 변경 없음) ...
  if (userUnsubscribe) userUnsubscribe();
  if (mineUnsubscribe) mineUnsubscribe();
  if (timerInterval) clearInterval(timerInterval);
  if (audioPlayer.value) audioPlayer.value.pause();
});

// ... (수동 채굴 computed: isMining, canClaim, countdown 변경 없음) ...
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

// --- [★수정★] 자동 채굴 Computed (bonusBndReward 반영) ---
const fuelPercentage = computed(() => {
  return Math.min((autoMineFuel.value / FUEL_COST_PER_WEEK) * 100, 100);
});
const remainingHours = computed(() => {
  if (autoMineFuel.value <= 0) return 0;
  const remainingSeconds = autoMineFuel.value / FUEL_RATE_PER_SECOND;
  return remainingSeconds / 3600;
});
const calculatedAutoReward = computed(() => {
  if (!autoMineLastChecked.value || autoMineFuel.value <= 0) return 0;
  
  const elapsedSeconds = (now.value.getTime() - autoMineLastChecked.value.getTime()) / 1000;
  if (elapsedSeconds <= 0) return 0;

  const maxFuelToConsume = elapsedSeconds * FUEL_RATE_PER_SECOND;
  const consumedFuel = Math.min(autoMineFuel.value, maxFuelToConsume);
  
  // [★수정★] 총 획득량(보너스 포함)으로 초당 획득률 계산
  const totalWeeklyReward = weeklyBndReward.value + bonusBndReward.value;
  const REWARD_RATE_PER_SECOND = totalWeeklyReward / SECONDS_PER_WEEK;
  const earnedBnd = (consumedFuel / FUEL_RATE_PER_SECOND) * REWARD_RATE_PER_SECOND;
  
  return earnedBnd;
});

// --- (Methods: startManualMining, claimManualReward, addFuel, claimAutoReward, formatNumber 변경 없음) ---
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
    await addAutoMineFuelFunc();
    alert("연료 4,000 SaltMate가 충전되었습니다. 자동 채굴이 즉시 시작/연장됩니다.");
  } catch (error) { errorMessage.value = error.message; } 
  finally { isProcessing.value = false; }
};

const claimAutoReward = async () => {
  if (calculatedAutoReward.value < 0.0001) {
    errorMessage.value = "정산할 보상이 없습니다.";
    return;
  }
  isProcessing.value = true;
  errorMessage.value = null;
  try {
    const result = await claimAutoRewardFunc();
    const { earnedBnd, consumedFuel, earnedCobs } = result.data;
    
    // ▼▼▼ [★핵심 수정★] 이 2줄을 추가하여 즉시 갱신합니다. ▼▼▼
    myTokens.bnd += earnedBnd;
    myTokens.cobs += (earnedCobs || 0);
    // ▲▲▲ (수정 완료) ▲▲▲

    let alertMsg = `자동 채굴 보상 수령 완료!\n\nBND: +${earnedBnd.toFixed(4)}\n연료 소모: -${consumedFuel.toFixed(2)} P`;
    if (earnedCobs && earnedCobs > 0) {
      alertMsg += `\n\n🎉🎉🎉\n축하합니다! 럭키 보상으로 COBS +${earnedCobs.toFixed(4)}를 추가 획득했습니다!`;
    }
    alert(alertMsg);
  } catch (error) { 
    errorMessage.value = error.message; 
  } finally { 
    isProcessing.value = false; 
  }
};

const formatNumber = (num, digits = 0) => {
  if (num == null) return 0;
  return num.toLocaleString(undefined, { 
    minimumFractionDigits: digits, 
    maximumFractionDigits: digits 
  });
}

</script>

<style scoped>
/* ▼▼▼ [★핵심 수정★] 새 디자인 CSS ▼▼▼ */

/* ( ... 페이지 전체 배경, 메인 글래스 패널, 헤더, 음소거 버튼 스타일 ... 변경 없음 ... ) */
.token-mine-page {
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
  min-height: calc(100vh - 70px);
  padding: 2rem;
  box-sizing: border-box;
  color: #f0f0f0;
}
.mine-dashboard-card {
  max-width: 1200px;
  margin: 0 auto;
  background: rgba(10, 0, 20, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 20px;
  border: 1px solid rgba(170, 70, 255, 0.4);
  padding: 2rem;
  box-shadow: 0 0 40px rgba(170, 70, 255, 0.3), 0 0 15px rgba(255, 193, 7, 0.2);
  position: relative;
}
.mine-dashboard-card h2 {
  font-size: 2.5rem;
  color: #ffffff;
  text-shadow: 0 0 10px #d09fff, 0 0 20px #d09fff;
  text-align: center;
  margin: 0;
}
.page-subtitle {
  text-align: center;
  font-size: 1rem;
  color: #bdc3c7;
  margin-top: 5px;
  margin-bottom: 2rem;
}
.sound-toggle-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}
.sound-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* ( ... 보유 자산 (금고) 스타일 ... 변경 없음 ... ) */
.balance-status {
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  border: 1px solid rgba(170, 70, 255, 0.2);
  margin-bottom: 2rem;
}
.balance-status h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.8rem;
  color: #f0f0f0;
  border-bottom: 1px solid rgba(170, 70, 255, 0.4);
  padding-bottom: 1rem;
}
.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1.5rem;
  margin: 1rem 0;
}
.balance-item {
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  padding: 1.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.token-name {
  display: block;
  font-weight: bold;
  color: #d09fff;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}
.token-amount, .token-amount-cobs, .token-amount-bnd {
  display: block;
  font-size: 2.2rem;
  font-weight: 700;
  color: #FFD700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  line-height: 1.1;
}
.token-amount-cobs { color: #3498db; text-shadow: 0 0 8px rgba(52, 152, 219, 0.5); }
.token-amount-bnd { color: #2ecc71; text-shadow: 0 0 8px rgba(46, 204, 113, 0.5); }
.token-note {
  display: block;
  text-align: center;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.9em;
  color: #bdc3c7;
}

/* ( ... 채굴 섹션 레이아웃 ... 변경 없음 ... ) */
.mining-columns {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
}
@media (max-width: 992px) {
  .mining-columns {
    grid-template-columns: 1fr;
  }
}
.mine-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 10px;
  margin-bottom: 15px;
}
.section-header h3 { margin: 0; font-size: 1.5rem; color: #fff; }
.section-header i { font-size: 1.5rem; color: #FFD700; }
.section-description { font-size: 0.95rem; color: #bdc3c7; margin-bottom: 20px; }

/* [★수정★] 자동 채굴 스탯 그리드 레이아웃 */
.auto-mine-stats {
  display: grid;
  /* [수정] 3열 그리드로 변경 */
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 20px;
  text-align: center;
}
.stat-item {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 8px;
}
.stat-item strong { display: block; font-size: 0.9rem; color: #bdc3c7; margin-bottom: 5px; }
.stat-item span { font-size: 1.3rem; font-weight: bold; color: #FFD700; }
.stat-item span.highlight-bnd { color: #2ecc71; }
/* [신규] 총 획득량 강조 */
.stat-item.total-reward {
  background: rgba(46, 204, 113, 0.1);
  border: 1px solid rgba(46, 204, 113, 0.3);
  /* [수정] 모바일에서 2열, PC에서 3열일 때 모두 꽉 차도록 */
  grid-column: 1 / -1; 
}
.stat-item.total-reward strong { color: #2ecc71; }
.stat-item.total-reward span.highlight-total { 
  color: #2ecc71; 
  font-size: 1.5rem;
  text-shadow: 0 0 8px rgba(46, 204, 113, 0.5);
}

.stat-item.lucky-cobs {
  grid-column: 1 / -1;
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
}
.stat-item.lucky-cobs strong { color: #FFD700; }
.stat-item.lucky-cobs span.highlight-cobs { color: #3498db; } /* COBS 파란색 */

/* ▼▼▼ [핵심 수정] 이 블록 전체를 추가하세요 ▼▼▼ */
.stat-item.meridian-bonus {
  position: relative; /* 불꽃 효과의 기준점 */
  background: rgba(220, 53, 69, 0.1); /* 붉은색 배경 */
  border: 1px solid rgba(220, 53, 69, 0.4);
  overflow: hidden; /* 불꽃이 박스 밖으로 나가지 않도록 */
}
.stat-item.meridian-bonus strong {
  color: #ffc107; /* 텍스트 강조 */
}
.stat-item.meridian-bonus span.highlight-bnd {
  color: #f8d7da; /* 밝은 붉은색 텍스트 */
  text-shadow: 0 0 8px rgba(220, 53, 69, 0.7);
  z-index: 2; /* 불꽃보다 위에 표시 */
}

/* 불꽃 애니메이션 */
.flame-aura {
  position: absolute;
  bottom: 0;
  left: -20%;
  width: 140%;
  height: 80%;
  background: linear-gradient(
    transparent, 
    rgba(255, 100, 0, 0.5), 
    rgba(255, 0, 0, 0.7)
  );
  border-radius: 50% 50% 0 0;
  filter: blur(10px);
  animation: flame-flicker 3s ease-in-out infinite alternate;
  z-index: 1; /* 텍스트보다 아래에 표시 */
}

@keyframes flame-flicker {
  0% {
    transform: scale(1, 0.8) translateY(10px);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.1, 1) translateY(0);
    opacity: 0.9;
  }
  100% {
    transform: scale(0.9, 0.9) translateY(5px);
    opacity: 0.7;
  }
}
/* ▲▲▲ (수정 완료) ▲▲▲ */

/* ( ... 나머지 스타일은 100% 동일 ... ) */
.fuel-status h4 { margin-bottom: 10px; font-size: 1.1rem; }
.fuel-status small { display: block; margin-top: 8px; font-size: 0.9rem; color: #999; }
.progress-bar-container { width: 100%; background-color: rgba(0,0,0,0.3); border-radius: 20px; height: 10px; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #FFC107, #FFD700); border-radius: 20px; }
.auto-mine-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: auto;
  padding-top: 20px;
}
.manual-mine {
  background: rgba(0, 0, 0, 0.2);
}
.manual-mine .section-header i { color: #95a5a6; }
.mine-status { text-align: center; padding-top: 1rem; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
.mine-action, .mine-progress { padding: 1rem 0; }
.mine-progress h4, .mine-action h4 { font-size: 1.2rem; margin-bottom: 10px; }
.icon-success { color: #2ecc71; font-size: 3rem; }
.icon-progress { color: #f1c40f; font-size: 3rem; animation: spin 2s linear infinite; }
.icon-start { color: #3498db; font-size: 3rem; }
.countdown { font-size: 1.5rem; font-weight: bold; color: #fff; margin: 0.5rem 0; }
.btn-premium, .btn-premium-claim {
  width: 100%;
  padding: 0.8rem 1rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #FFC107, #E0A800);
  color: #212529;
  box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3);
}
.btn-premium:hover:not(:disabled), .btn-premium-claim:hover:not(:disabled) {
  transform: scale(1.03);
  box-shadow: 0 6px 20px rgba(255, 193, 7, 0.5);
  filter: brightness(1.1);
}
.btn-premium-claim {
  background: linear-gradient(135deg, #2ecc71, #28a745);
  color: white;
  box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);
}
.btn-premium-claim:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(46, 204, 113, 0.5);
}
.btn-disabled {
  width: 100%;
  padding: 0.8rem 1rem;
  font-size: 1rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: not-allowed;
  background-color: #555;
  color: #999;
  box-shadow: none;
}
.btn-premium:disabled, .btn-premium-claim:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
  filter: grayscale(80%);
}
.error-message { color: #e74c3c; margin-top: 1.5rem; text-align: center; font-weight: bold; }
.loading-spinner {
  display: inline-block;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #FFD700;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
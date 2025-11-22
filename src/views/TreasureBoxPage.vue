<template>
  <div class="treasure-box-page" :class="{ 'fever-mode': isFeverTime }">
    <div class="game-container card glassmorphism">
      
      <div v-if="isFeverTime" class="fever-badge">
        <i class="fas fa-fire"></i> FEVER TIME (20:00 ~ 22:00) <i class="fas fa-fire"></i>
        <span class="fever-desc">보상 확률 대폭 상승!</span>
      </div>

      <header class="game-header">
        <h2><i class="fas fa-gem"></i> 전설의 황금 상자</h2>
        <p>매일 찾아오는 행운의 기회!</p>
      </header>

      <main class="game-content">
        <div class="chest-stage">
          <div
            class="chest-container"
            :class="{
              'is-opening': isOpening,
              'is-opened': isOpened,
              'is-idle': !isOpening && !isOpened,
              'tier-legendary': selectedTier === 'legendary',
              'tier-premium': selectedTier === 'premium'
            }"
            @click="handleChestClick"
          >
            <img v-show="!isOpened" src="@/assets/chest_closed.png" class="chest-image closed" />
            <img v-show="isOpened" src="@/assets/chest_open.png" class="chest-image open" />
            
            <div class="glow-effect"></div>
            <div v-if="isOpened" class="particles-container">
              <div v-for="n in 50" :key="n" class="particle"></div>
            </div>
          </div>
        </div>

        <div v-if="message" class="result-message" :class="{ success: reward > 0 }">
          <i v-if="reward > 0" class="fas fa-coins"></i>
          <span>{{ message }}</span>
        </div>

        <div class="tier-selector" v-if="!isOpened && !isOpening">
          <div 
            class="tier-card normal" 
            :class="{ active: selectedTier === 'normal', disabled: !canOpenNormal }"
            @click="selectTier('normal')"
          >
            <div class="tier-name">일반 상자</div>
            <div class="tier-cost">무료 (일 1회)</div>
            <div class="tier-reward">10 ~ 100 P</div>
          </div>

          <div 
            class="tier-card premium" 
            :class="{ active: selectedTier === 'premium', disabled: !canOpenPremium }"
            @click="selectTier('premium')"
          >
            <div class="tier-name">프리미엄</div>
            <div class="tier-cost"><i class="fas fa-coins"></i> 500</div>
            <div class="tier-reward">200 ~ 2,500 P</div>
          </div>

          <div 
            class="tier-card legendary" 
            :class="{ active: selectedTier === 'legendary', disabled: !canOpenLegendary }"
            @click="selectTier('legendary')"
          >
            <div class="tier-name">전설 상자</div>
            <div class="tier-cost"><i class="fas fa-coins"></i> 2,000</div>
            <div class="tier-reward">1,000 ~ 10,000 P</div>
          </div>
        </div>

        <div class="action-area" v-if="!isOpened && !isOpening">
          <button class="btn-open" :class="selectedTier" @click="handleChestClick" :disabled="isButtonDisabled">
            <span v-if="isButtonDisabled">내일 다시 오세요</span>
            <span v-else>
              {{ selectedTier === 'normal' ? '무료로 열기' : (selectedTier === 'premium' ? '500' : '2,000') + ' SaltMate로 열기' }}
            </span>
          </button>
        </div>
        
        <button v-if="isOpened" class="btn-reset" @click="resetGame">
          다른 상자 열기
        </button>

      </main>

      <footer class="game-footer">
        <p>보유 포인트: <strong>{{ (userPoints || 0).toLocaleString() }} P</strong></p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions, auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

const openSound = new Audio(require('@/assets/sounds/door-opening.mp3'));

const user = ref(null);
const userPoints = ref(0);

// [수정] 티어별 오픈 가능 여부 상태 변수
const canOpenNormal = ref(false);
const canOpenPremium = ref(false);
const canOpenLegendary = ref(false);

const isOpening = ref(false);
const isOpened = ref(false);
const reward = ref(0);
const message = ref('');
const selectedTier = ref('normal'); 
const isFeverTime = ref(false);

let unsubscribeUser = null;
let feverInterval = null;

const todayStr = computed(() => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().slice(0, 10);
});

const checkFeverTime = () => {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = kstNow.getUTCHours();
  isFeverTime.value = hour >= 20 && hour < 22;
};

// [핵심 수정] 모든 티어의 일일 참여 상태를 체크하는 함수
const checkDailyStatus = () => {
  if (!user.value) return;

  const checkTierStatus = (storageKey, serverField) => {
    const localLastOpened = localStorage.getItem(storageKey);
    let isOpenedLocally = localLastOpened === todayStr.value;

    if (user.value[serverField]) {
      const serverLastDate = user.value[serverField].toDate();
      const kstOffset = 9 * 60 * 60 * 1000;
      const serverLastDateStr = new Date(serverLastDate.getTime() + kstOffset).toISOString().slice(0, 10);
      
      if (serverLastDateStr === todayStr.value) {
        isOpenedLocally = true;
        localStorage.setItem(storageKey, todayStr.value);
      }
    }
    return !isOpenedLocally; // 오늘 안 열었으면 true
  };

  canOpenNormal.value = checkTierStatus(`lastTreasureOpen_Normal_${user.value.uid}`, 'lastTreasureBoxPlay');
  canOpenPremium.value = checkTierStatus(`lastTreasureOpen_Premium_${user.value.uid}`, 'lastTreasureBoxPlay_Premium');
  canOpenLegendary.value = checkTierStatus(`lastTreasureOpen_Legendary_${user.value.uid}`, 'lastTreasureBoxPlay_Legendary');

  // 현재 선택된 티어가 불가능하면 가능한 다른 티어로 자동 변경 (선택 사항)
  if (selectedTier.value === 'normal' && !canOpenNormal.value) {
      if (canOpenPremium.value) selectedTier.value = 'premium';
      else if (canOpenLegendary.value) selectedTier.value = 'legendary';
  }
};

// 현재 선택된 티어의 버튼 비활성화 여부 계산
const isButtonDisabled = computed(() => {
  if (selectedTier.value === 'normal') return !canOpenNormal.value;
  if (selectedTier.value === 'premium') return !canOpenPremium.value;
  if (selectedTier.value === 'legendary') return !canOpenLegendary.value;
  return true;
});

const selectTier = (tier) => {
  // 비활성화된 티어도 선택은 가능하게 하여 상태를 보여줌 (UX 선택)
  selectedTier.value = tier;
};

const resetGame = () => {
  isOpened.value = false;
  isOpening.value = false;
  message.value = '';
  reward.value = 0;
  checkDailyStatus();
};

const handleChestClick = async () => {
  if (!user.value) { alert('로그인이 필요합니다.'); return; }
  if (isOpening.value || isOpened.value) return;
  if (isButtonDisabled.value) return; // 이미 열었으면 중단

  const cost = selectedTier.value === 'premium' ? 500 : selectedTier.value === 'legendary' ? 2000 : 0;
  if (userPoints.value < cost) {
    alert('SaltMate 포인트가 부족합니다.');
    return;
  }

  isOpening.value = true;
  message.value = '전설의 보물을 확인하는 중...';

  if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 50]);

  try {
    const openTreasureBox = httpsCallable(functions, 'openTreasureBox');
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    openSound.currentTime = 0;
    openSound.play().catch(() => {});
    if (navigator.vibrate) navigator.vibrate(200);

    const result = await openTreasureBox({ tier: selectedTier.value });
    
    isOpening.value = false;
    isOpened.value = true;
    reward.value = result.data.reward;
    message.value = result.data.message;

    if (result.data.success) {
      // 로컬 스토리지 즉시 업데이트 (UI 반응성 향상)
      const storageKeyMap = {
        'normal': `lastTreasureOpen_Normal_${user.value.uid}`,
        'premium': `lastTreasureOpen_Premium_${user.value.uid}`,
        'legendary': `lastTreasureOpen_Legendary_${user.value.uid}`
      };
      localStorage.setItem(storageKeyMap[selectedTier.value], todayStr.value);
      
      // 상태 변수 즉시 업데이트
      if (selectedTier.value === 'normal') canOpenNormal.value = false;
      if (selectedTier.value === 'premium') canOpenPremium.value = false;
      if (selectedTier.value === 'legendary') canOpenLegendary.value = false;
    }
  } catch (error) {
    console.error('보물상자 오류:', error);
    message.value = error.message || '오류가 발생했습니다.';
    isOpening.value = false;
  }
};

onMounted(() => {
  checkFeverTime();
  feverInterval = setInterval(checkFeverTime, 60000);

  onAuthStateChanged(auth, (currentUser) => {
    if (unsubscribeUser) unsubscribeUser();
    if (currentUser) {
      user.value = currentUser;
      
      // 1. 초기 상태 체크 (user 객체만 있어도 로컬 스토리지 기반으로 체크 가능)
      checkDailyStatus();
      
      unsubscribeUser = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          userPoints.value = userData.saltmatePoints || 0;
          
          // [핵심] 사용자 정보 업데이트 (lastTreasureBoxPlay_Premium 등 포함)
          user.value = { ...user.value, ...userData }; 
          checkDailyStatus(); 
        }
      });
    } else {
      user.value = null;
      userPoints.value = 0;
    }
  });
});

onUnmounted(() => {
  if (unsubscribeUser) unsubscribeUser();
  if (feverInterval) clearInterval(feverInterval);
});
</script>

<style scoped>
/* (스타일은 이전과 동일) */
.treasure-box-page {
  padding: 20px;
  min-height: 100vh;
  background: radial-gradient(circle at center, #1a1a2e 0%, #0f0c29 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Noto Sans KR', sans-serif;
}

.treasure-box-page.fever-mode {
  background: radial-gradient(circle at center, #3a0000 0%, #1a0000 100%);
}

.game-container {
  width: 100%;
  max-width: 450px;
  background: rgba(20, 20, 20, 0.8);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 20px;
  padding: 20px;
  text-align: center;
  color: #fff;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
}

.fever-badge {
  background: linear-gradient(90deg, #ff4e50, #f9d423);
  color: #fff;
  padding: 8px;
  border-radius: 8px;
  font-weight: bold;
  margin-bottom: 15px;
  animation: pulse-fever 1s infinite;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
.fever-desc { display: block; font-size: 0.8rem; margin-top: 2px; opacity: 0.9; }

.game-header h2 {
  font-size: 1.5rem;
  color: #FFD700;
  margin: 0 0 5px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}
.game-header p { color: #bdc3c7; font-size: 0.9rem; margin: 0; }

.chest-stage {
  min-height: 220px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  margin: 20px 0;
}

.chest-container {
  position: relative;
  width: 200px;
  height: 200px;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.chest-container.tier-premium .glow-effect { background: radial-gradient(circle, rgba(0, 191, 255, 0.4) 0%, transparent 70%); }
.chest-container.tier-legendary .glow-effect { background: radial-gradient(circle, rgba(255, 0, 0, 0.4) 0%, transparent 70%); }

.chest-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));
}

.tier-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.tier-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 10px 5px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100px;
}

.tier-card:active { transform: scale(0.95); }
.tier-card.active { background: rgba(255, 215, 0, 0.1); border-color: #FFD700; box-shadow: 0 0 15px rgba(255, 215, 0, 0.2); }
.tier-card.disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }

.tier-name { font-size: 0.9rem; font-weight: bold; margin-bottom: 5px; color: #fff; }
.tier-card.premium .tier-name { color: #00bfff; }
.tier-card.legendary .tier-name { color: #ff4e50; }

.tier-cost { font-size: 0.8rem; color: #ddd; margin-bottom: 5px; }
.tier-reward { font-size: 0.7rem; color: #FFD700; }

.btn-open {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  color: #000;
  background: #FFD700;
  cursor: pointer;
  transition: background 0.3s;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}
.btn-open:disabled { background: #555; color: #888; cursor: not-allowed; box-shadow: none; }
.btn-open.premium { background: #00bfff; color: #fff; box-shadow: 0 4px 15px rgba(0, 191, 255, 0.3); }
.btn-open.legendary { background: #ff4e50; color: #fff; box-shadow: 0 4px 15px rgba(255, 78, 80, 0.3); }

.btn-reset {
  margin-top: 20px;
  padding: 10px 20px;
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  border-radius: 20px;
}

.result-message {
  font-size: 1.2rem;
  font-weight: bold;
  color: #FFD700;
  margin-bottom: 20px;
  min-height: 30px;
  animation: pop-text 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.game-footer { margin-top: 20px; color: #888; font-size: 0.9rem; }
.game-footer strong { color: #fff; }

.glow-effect {
  position: absolute; top: 50%; left: 50%; width: 120%; height: 120%;
  background: radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%);
  transform: translate(-50%, -50%) scale(0); border-radius: 50%; z-index: -1;
}
.chest-container.is-opening { animation: shake-hard 0.5s ease-in-out infinite; }
.chest-container.is-opening .glow-effect { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
.chest-container.is-opened { animation: pop-open 0.6s forwards; }
.chest-container.is-idle { animation: breathe 3s infinite; }

@keyframes shake-hard {
  0% { transform: rotate(0deg); } 25% { transform: rotate(-5deg) translate(-3px, 3px); } 75% { transform: rotate(5deg) translate(3px, -3px); } 100% { transform: rotate(0deg); }
}
@keyframes pop-open { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
@keyframes pulse-fever { 0% { transform: scale(1); } 50% { transform: scale(1.02); box-shadow: 0 0 15px rgba(255, 78, 80, 0.5); } 100% { transform: scale(1); } }
@keyframes pop-text { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.particles-container { position: absolute; top: 50%; left: 50%; width: 0; height: 0; }
.particle {
  position: absolute; width: 6px; height: 6px; background: #FFD700; border-radius: 50%;
  box-shadow: 0 0 10px #FFD700; animation: explode 1s ease-out forwards;
}
.particle:nth-child(2n) { background: #fff; box-shadow: 0 0 10px #fff; }
@for $i from 1 through 50 {
  .particle:nth-child(#{$i}) {
    --angle: #{$i * 7.2}deg;
    --dist: #{50 + random(100)}px;
    transform: rotate(var(--angle)) translateY(var(--dist));
  }
}
@keyframes explode {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
}
</style>
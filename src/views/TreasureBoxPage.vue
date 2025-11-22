<template>
  <div class="treasure-box-page" :class="{ 'fever-mode': isFeverTime }">
    <div class="game-container card glassmorphism">
      
      <!-- 피버 타임 배지 -->
      <div v-if="isFeverTime" class="fever-badge">
        <i class="fas fa-fire"></i> FEVER TIME (20:00 ~ 22:00) <i class="fas fa-fire"></i>
        <span class="fever-desc">보상 확률 대폭 상승!</span>
      </div>

      <header class="game-header">
        <h2><i class="fas fa-gem"></i> 전설의 황금 상자</h2>
        <p>매일 찾아오는 행운의 기회!</p>
      </header>

      <main class="game-content">
        <!-- 상자 스테이지 -->
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
            <!-- 상자 이미지 -->
            <img v-show="!isOpened" src="@/assets/chest_closed.png" class="chest-image closed" />
            <img v-show="isOpened" src="@/assets/chest_open.png" class="chest-image open" />
            
            <!-- 이펙트 -->
            <div class="glow-effect"></div>
            <div v-if="isOpened" class="particles-container">
              <div v-for="n in 50" :key="n" class="particle"></div>
            </div>
          </div>
        </div>

        <!-- 결과 메시지 -->
        <div v-if="message" class="result-message" :class="{ success: reward > 0 }">
          <i v-if="reward > 0" class="fas fa-coins"></i>
          <span>{{ message }}</span>
        </div>

        <!-- [신규] 등급 선택 UI -->
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
            :class="{ active: selectedTier === 'premium' }"
            @click="selectTier('premium')"
          >
            <div class="tier-name">프리미엄</div>
            <div class="tier-cost"><i class="fas fa-coins"></i> 500</div>
            <div class="tier-reward">200 ~ 2,500 P</div>
          </div>

          <div 
            class="tier-card legendary" 
            :class="{ active: selectedTier === 'legendary' }"
            @click="selectTier('legendary')"
          >
            <div class="tier-name">전설 상자</div>
            <div class="tier-cost"><i class="fas fa-coins"></i> 2,000</div>
            <div class="tier-reward">1,000 ~ 10,000 P</div>
          </div>
        </div>

        <div class="action-area" v-if="!isOpened && !isOpening">
          <button class="btn-open" :class="selectedTier" @click="handleChestClick" :disabled="selectedTier === 'normal' && !canOpenNormal">
            <span v-if="selectedTier === 'normal'">{{ canOpenNormal ? '무료로 열기' : '내일 다시 오세요' }}</span>
            <span v-else>
              {{ selectedTier === 'premium' ? '500' : '2,000' }} SaltMate로 열기
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

// [신규] 효과음 로드
const openSound = new Audio(require('@/assets/sounds/door-opening.mp3'));

const user = ref(null);
const userPoints = ref(0);
const canOpenNormal = ref(false);
const isOpening = ref(false);
const isOpened = ref(false);
const reward = ref(0);
const message = ref('');
const selectedTier = ref('normal'); // 'normal', 'premium', 'legendary'
const isFeverTime = ref(false);

let unsubscribeUser = null;
let feverInterval = null;

const todayStr = computed(() => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().slice(0, 10);
});

// 피버 타임 체크 (20:00 ~ 22:00)
const checkFeverTime = () => {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = kstNow.getUTCHours();
  isFeverTime.value = hour >= 20 && hour < 22;
};

const checkDailyStatus = () => {
  const lastOpenedDate = localStorage.getItem(`lastTreasureOpen_Normal_${user.value?.uid}`);
  canOpenNormal.value = lastOpenedDate !== todayStr.value;
  // 일반 상자를 이미 열었으면 자동으로 프리미엄 선택
  if (!canOpenNormal.value && selectedTier.value === 'normal') {
    selectedTier.value = 'premium';
  }
};

const selectTier = (tier) => {
  if (tier === 'normal' && !canOpenNormal.value) return;
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
  if (selectedTier.value === 'normal' && !canOpenNormal.value) return;

  // 포인트 확인 (프론트엔드 1차 검증)
  const cost = selectedTier.value === 'premium' ? 500 : selectedTier.value === 'legendary' ? 2000 : 0;
  if (userPoints.value < cost) {
    alert('SaltMate 포인트가 부족합니다.');
    return;
  }

  isOpening.value = true;
  message.value = '전설의 보물을 확인하는 중...';

  // [신규] 햅틱 피드백 (진동) - 덜컹거림
  if (navigator.vibrate) navigator.vibrate([50, 30, 50, 30, 50]);

  try {
    const openTreasureBox = httpsCallable(functions, 'openTreasureBox');
    
    // 1. 덜컹거리는 애니메이션 시간 (1.5초)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. 효과음 재생 및 강한 진동
    openSound.currentTime = 0;
    openSound.play().catch(() => {}); // 자동재생 정책 방어
    if (navigator.vibrate) navigator.vibrate(200); // 쾅!

    // 3. 서버 요청
    const result = await openTreasureBox({ tier: selectedTier.value });
    
    isOpening.value = false;
    isOpened.value = true;
    reward.value = result.data.reward;
    message.value = result.data.message;

    if (result.data.success && selectedTier.value === 'normal') {
      localStorage.setItem(`lastTreasureOpen_Normal_${user.value.uid}`, todayStr.value);
      canOpenNormal.value = false;
    }
  } catch (error) {
    console.error('보물상자 오류:', error);
    message.value = error.message || '오류가 발생했습니다.';
    isOpening.value = false;
  }
};

onMounted(() => {
  checkFeverTime();
  feverInterval = setInterval(checkFeverTime, 60000); // 1분마다 체크

  onAuthStateChanged(auth, (currentUser) => {
    if (unsubscribeUser) unsubscribeUser();
    if (currentUser) {
      user.value = currentUser;
      checkDailyStatus();
      unsubscribeUser = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          userPoints.value = docSnap.data().saltmatePoints || 0;
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
  background: radial-gradient(circle at center, #3a0000 0%, #1a0000 100%); /* 피버 타임 배경 */
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

/* 상자 스테이지 */
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

/* 등급별 상자 효과 (글로우 색상 변경) */
.chest-container.tier-premium .glow-effect { background: radial-gradient(circle, rgba(0, 191, 255, 0.4) 0%, transparent 70%); }
.chest-container.tier-legendary .glow-effect { background: radial-gradient(circle, rgba(255, 0, 0, 0.4) 0%, transparent 70%); }

.chest-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));
}

/* 등급 선택 UI */
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

/* 애니메이션 */
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

/* 파티클 */
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
/* 단순화된 파티클 애니메이션 (SCSS 대신 CSS 변수 활용 불가시 랜덤 효과 제한적임) */
@keyframes explode {
  0% { opacity: 1; transform: translate(0, 0) scale(1); }
  100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
}
</style>
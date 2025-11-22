<template>
  <div class="treasure-box-page">
    <div class="game-container card glassmorphism">
      <header class="game-header">
        <h2><i class="fas fa-gem"></i> 전설의 황금 상자</h2>
        <p>매일 한 번, 숨겨진 보물을 찾아보세요!</p>
      </header>

      <main class="game-content">
        <div class="chest-stage">
          <div
            class="chest-container"
            :class="{
              'is-opening': isOpening,
              'is-opened': isOpened,
              'is-idle': !isOpening && !isOpened
            }"
            @click="handleChestClick"
          >
            <img
              v-show="!isOpened"
              src="@/assets/chest_closed.png"
              alt="Closed Treasure Chest"
              class="chest-image closed"
            />
            <img
              v-show="isOpened"
              src="@/assets/chest_open.png"
              alt="Open Treasure Chest"
              class="chest-image open"
            />
            <div class="glow-effect"></div>
            <div v-if="isOpened" class="particles-container">
              <div v-for="n in 30" :key="n" class="particle"></div>
            </div>
          </div>
        </div>

        <div v-if="message" class="result-message" :class="{ success: reward > 0 }">
          <i v-if="reward > 0" class="fas fa-coins"></i>
          <span>{{ message }}</span>
        </div>
        <div v-else class="guide-message">
          <p v-if="canOpen">상자를 터치하여 열어보세요!</p>
          <p v-else>오늘은 이미 열었습니다. 내일 다시 도전하세요!</p>
        </div>
      </main>

      <footer class="game-footer">
        <p>
          내 포인트:
          <strong>{{ (userPoints || 0).toLocaleString() }} SaltMate</strong>
        </p>
      </footer>
    </div>
  </div>
</template>

<script setup>
// [수정 1] onUnmounted 추가
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions, auth, db } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

const user = ref(null);
const userPoints = ref(0);
const canOpen = ref(false);
const isOpening = ref(false);
const isOpened = ref(false);
const reward = ref(0);
const message = ref('');
// 이 변수가 사용되지 않았다는 오류였습니다.
let unsubscribeUser = null;

const todayStr = computed(() => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().slice(0, 10);
});

const checkDailyStatus = () => {
  const lastOpenedDate = localStorage.getItem(`lastTreasureOpen_${user.value.uid}`);
  canOpen.value = lastOpenedDate !== todayStr.value;
};

const handleChestClick = async () => {
  if (!user.value) {
    alert('로그인이 필요합니다.');
    return;
  }
  if (!canOpen.value || isOpening.value || isOpened.value) return;

  isOpening.value = true;
  message.value = '보물상자를 여는 중...';

  try {
    const openTreasureBox = httpsCallable(functions, 'openTreasureBox');
    
    // 1. 흔들림 애니메이션 시작 (1.5초 동안)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. 서버 요청 및 결과 수신
    const result = await openTreasureBox({ boxIndex: 0 });
    
    // 3. 열림 상태로 전환
    isOpening.value = false;
    isOpened.value = true;
    reward.value = result.data.reward;
    message.value = result.data.message;

    if (result.data.success) {
      localStorage.setItem(`lastTreasureOpen_${user.value.uid}`, todayStr.value);
      canOpen.value = false;
    }
  } catch (error) {
    console.error('보물상자 열기 오류:', error);
    message.value = error.message || '오류가 발생했습니다.';
    isOpening.value = false;
  }
};

onMounted(() => {
  onAuthStateChanged(auth, (currentUser) => {
    // 상태 변경 시 기존 리스너가 있다면 먼저 해제 (안전장치)
    if (unsubscribeUser) {
      unsubscribeUser();
      unsubscribeUser = null;
    }

    if (currentUser) {
      user.value = currentUser;
      checkDailyStatus();
      const userRef = doc(db, 'users', currentUser.uid);
      // 여기서 할당된 리스너 해제 함수를 unsubscribeUser에 저장합니다.
      unsubscribeUser = onSnapshot(userRef, (docSnap) => {
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

// [수정 2] 컴포넌트가 해제될 때 리스너 정리
onUnmounted(() => {
  if (unsubscribeUser) {
    unsubscribeUser();
  }
});
</script>

<style scoped>
/* 스타일은 기존과 동일합니다 */
.treasure-box-page {
  padding: 20px;
  min-height: 100vh;
  background: radial-gradient(circle at center, #2c3e50 0%, #1a1a2e 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  /* overflow: hidden; 제거: 스크롤이 필요할 수 있음 */
}

.game-container {
  width: 95%; /* [수정] 모바일에서 꽉 차지 않도록 여백 확보 */
  max-width: 500px;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 25px;
  padding: 25px; /* [수정] 패딩 약간 축소 */
  text-align: center;
  color: #fff;
  box-shadow: 0 0 30px rgba(255, 215, 0, 0.2);
}

.game-header h2 {
  font-size: 1.8rem; /* [수정] 모바일 고려하여 폰트 크기 약간 축소 */
  color: #FFD700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.game-header p {
  color: #bdc3c7;
  font-size: 1rem; /* [수정] 폰트 크기 축소 */
}

.game-content {
  margin: 30px 0; /* [수정] 마진 축소 */
}

.chest-stage {
  display: flex;
  justify-content: center;
  align-items: center;
  /* height: 350px; [삭제] 고정 높이 제거 */
  min-height: 250px; /* 최소 높이 확보 */
  position: relative;
  margin-bottom: 20px; /* 하단 여백 추가 */
}

.chest-container {
  position: relative;
  width: 80%; /* [수정] 반응형 너비 */
  max-width: 300px; /* 최대 너비 제한 */
  aspect-ratio: 1 / 1; /* [핵심] 정사각형 비율 유지 */
  cursor: pointer;
  transition: transform 0.3s ease;
  /* height: 300px; [삭제] 고정 높이 제거 */
}

/* 대기 상태: 숨쉬는 듯한 빛 효과 */
.chest-container.is-idle .chest-image.closed {
  animation: breathe 3s ease-in-out infinite;
}

.chest-container:hover.is-idle {
  transform: scale(1.05);
}

/* 여는 중: 격렬한 흔들림 */
.chest-container.is-opening {
  animation: shake-hard 0.5s ease-in-out infinite;
}

/* 열린 상태: 튀어오름 */
.chest-container.is-opened {
  animation: pop-open 0.6s cubic-bezier(0.25, 1.5, 0.5, 1) forwards;
  pointer-events: none;
}

.chest-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));
  position: absolute;
  top: 0;
  left: 0;
}

/* 빛 효과 오버레이 */
.glow-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%; /* 상자보다 약간 크게 */
  height: 120%;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%);
  transform: translate(-50%, -50%) scale(0);
  border-radius: 50%;
  pointer-events: none;
  transition: transform 0.5s ease-out, opacity 0.5s ease-out;
  opacity: 0;
  z-index: -1;
}

.chest-container.is-opening .glow-effect {
  transform: translate(-50%, -50%) scale(1.2);
  opacity: 1;
  animation: pulse-glow 0.5s infinite alternate;
}

.chest-container.is-opened .glow-effect {
  transform: translate(-50%, -50%) scale(3);
  opacity: 0;
  transition: transform 1s ease-out, opacity 1s ease-out;
}

.result-message {
  font-size: 1.3rem; /* [수정] 폰트 크기 축소 */
  font-weight: bold;
  color: #bdc3c7;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  animation: fade-in-up 0.5s ease-out;
  word-break: keep-all; /* 단어 단위 줄바꿈 */
  padding: 0 10px; /* 좌우 여백 */
}

.result-message.success {
  color: #2ecc71;
  text-shadow: 0 0 10px rgba(46, 204, 113, 0.5);
}

.guide-message {
  font-size: 1.1rem; /* [수정] 폰트 크기 축소 */
  color: #e67e22;
  font-weight: bold;
  animation: pulse-text 1.5s infinite alternate;
}

.game-footer {
  margin-top: 20px; /* [수정] 마진 축소 */
  font-size: 1rem;
  color: #bdc3c7;
}

.game-footer strong {
  color: #FFD700;
  font-size: 1.2rem;
}

/* --- 애니메이션 키프레임 (기존과 동일) --- */
@keyframes breathe {
  0%, 100% { filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5)) brightness(1); }
  50% { filter: drop-shadow(0 10px 30px rgba(255, 215, 0, 0.4)) brightness(1.2); }
}
@keyframes shake-hard {
  0% { transform: translate(0, 0) rotate(0deg); }
  10% { transform: translate(-5px, -5px) rotate(-3deg); }
  20% { transform: translate(5px, 5px) rotate(3deg); }
  30% { transform: translate(-7px, 3px) rotate(-5deg); }
  40% { transform: translate(7px, -3px) rotate(5deg); }
  50% { transform: translate(-5px, 5px) rotate(-3deg); }
  60% { transform: translate(5px, -5px) rotate(3deg); }
  70% { transform: translate(-3px, 7px) rotate(-2deg); }
  80% { transform: translate(3px, -7px) rotate(2deg); }
  90% { transform: translate(-2px, 2px) rotate(-1deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}
@keyframes pop-open {
  0% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.2) translateY(-30px); }
  100% { transform: scale(1) translateY(0); }
}
@keyframes pulse-glow {
  0% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-text {
  from { opacity: 0.8; transform: scale(1); }
  to { opacity: 1; transform: scale(1.05); }
}

/* --- 파티클 효과 (기존과 동일) --- */
.particles-container {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  pointer-events: none;
}
.particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 10px #FFD700;
  animation: explode 1.5s ease-out forwards;
}
.particle:nth-child(1) { --tx: -100px; --ty: -150px; --d: 0s; }
.particle:nth-child(2) { --tx: 80px; --ty: -180px; --d: 0.1s; }
.particle:nth-child(3) { --tx: -120px; --ty: -80px; --d: 0.2s; }
.particle:nth-child(4) { --tx: 150px; --ty: -100px; --d: 0.3s; }
.particle:nth-child(5) { --tx: -50px; --ty: -200px; --d: 0.1s; background: #fff; }
.particle:nth-child(odd) { background: #FFD700; }
.particle:nth-child(even) { background: #ffffff; box-shadow: 0 0 10px #ffffff; }
@keyframes explode {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
}

/* [신규] 작은 모바일 화면을 위한 미디어 쿼리 */
@media (max-width: 380px) {
  .game-container {
    padding: 20px;
  }
  .game-header h2 {
    font-size: 1.5rem;
  }
  .chest-container {
    width: 90%; /* 더 넓게 사용 */
  }
  .result-message {
    font-size: 1.1rem;
  }
}
</style>
<template>
  <div class="frog-game-page">
    
    <div class="game-stats-glass">
      <div class="stat-item">
        <span>점수</span>
        <strong>{{ score }}</strong>
      </div>
      <div class="stat-item">
        <span>남은 목숨</span>
        <div class="lives">
          <i v-for="n in lives" :key="n" class="fas fa-frog"></i>
        </div>
      </div>
    </div>

    <div 
      class="game-area-wrapper" 
      ref="gameAreaWrapper"
      @touchstart.prevent="handleTouchStart"
      @touchend.prevent="handleTouchEnd"
    >
      <div class="game-area" :style="gameAreaStyle">
        <div class="zone start-zone" :style="zoneStyle(14, 2)"></div>
        <div class="zone road-zone" :style="zoneStyle(8, 6)"></div>
        <div class="zone mid-zone" :style="zoneStyle(7, 1)"></div>
        <div class="zone water-zone" :style="zoneStyle(1, 6)"></div>
        <div class="zone goal-zone" :style="zoneStyle(0, 1)"></div>

        <div 
          v-for="(goal, index) in goals" 
          :key="'goal-' + index"
          class="goal"
          :style="goalStyle(index)"
        >
          <div v-if="goal.filled" class="goal-filled">💎</div>
        </div>

        <div 
          v-for="log in logs"
          :key="log.id"
          class="log"
          :class="log.type"
          :style="log.style"
        ></div>
        
        <div 
          v-for="cart in carts"
          :key="cart.id"
          class="cart"
          :class="cart.type"
          :style="cart.style"
        ></div>

        <div 
          class="frog" 
          :style="frogStyle"
          :class="{ 'squashed': isDead }"
        >
          🐸
        </div>
      </div>

    </div> <div v-if="gameStatus !== 'playing'" class="modal-overlay">
      <div class="modal-content">
        <h2 v-if="gameStatus === 'loading'">잠시만 기다려주세요</h2>
        <h2 v-if="gameStatus === 'lost'">게임 오버</h2>
        <h2 v-if="gameStatus === 'won'">모든 결정 획득!</h2>
        <p v-if="gameStatus === 'lost'">최종 점수: {{ score }}</p>
        <p v-if="gameStatus === 'won'">최종 점수 {{ score }}점 획득!</p>
        <div v-if="gameStatus === 'loading'" class="loading-spinner"></div>
        <button v-if="gameStatus === 'lost' || gameStatus === 'won'" @click="goToDashboard" class="btn-primary">
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { functions, auth } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- Firebase Functions ---
const startFrogGame = httpsCallable(functions, 'startFrogGame');
const endFrogGame = httpsCallable(functions, 'endFrogGame');
const router = useRouter();

// --- [★수정★] 동적 게임 설정 ---
const TILE_SIZE = ref(40); // 기본값, onMounted에서 재계산됨
const WIDTH_TILES = 9;
const HEIGHT_TILES = 16;
const GAME_WIDTH = computed(() => TILE_SIZE.value * WIDTH_TILES);
const GAME_HEIGHT = computed(() => TILE_SIZE.value * HEIGHT_TILES);

// --- 게임 상태 ---
const gameStatus = ref('loading');
const score = ref(0);
const lives = ref(3);
const frogPosition = reactive({ x: 4, y: 15 });
const isDead = ref(false);
const onLogId = ref(null);
let gameLoopId = null;
const goals = ref([
  { filled: false }, { filled: false }, { filled: false }, 
  { filled: false }, { filled: false }
]);
const logs = ref([]);
const carts = ref([]);
let lastTimestamp = 0;

// --- 스와이프(터치) 컨트롤 변수 ---
const gameAreaWrapper = ref(null);
const touchStartX = ref(0);
const touchStartY = ref(0);
const SWIPE_THRESHOLD = 30;
const moveLock = ref(false); // [★추가★] 한 번의 스와이프로 한 칸만 이동하도록

// --- 게임 루프 ---
const gameLoop = (timestamp) => {
  if (gameStatus.value !== 'playing') return;
  const deltaTime = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  moveObjects(logs.value, deltaTime);
  moveObjects(carts.value, deltaTime);
  checkOnLog(deltaTime); 
  checkCollisions();
  
  gameLoopId = requestAnimationFrame(gameLoop);
};

// --- 객체 이동 ---
const moveObjects = (objects, deltaTime) => {
  objects.forEach(obj => {
    obj.x += obj.speed * deltaTime;
    // [★수정★] GAME_WIDTH.value로 변경
    if (obj.speed > 0 && obj.x > GAME_WIDTH.value) {
      obj.x = -obj.width;
    } else if (obj.speed < 0 && obj.x < -obj.width) {
      obj.x = GAME_WIDTH.value;
    }
  });
};

// --- 충돌 및 뗏목 감지 ---
const checkOnLog = (deltaTime) => {
  // 강물 Y좌표: 1~6
  if (frogPosition.y >= 1 && frogPosition.y <= 6) { 
    const frogLeft = frogPosition.x * TILE_SIZE.value;
    const frogRight = frogLeft + TILE_SIZE.value;
    let isOnLog = false;
    for (const log of logs.value) {
      if (log.row === frogPosition.y) {
        if (frogLeft < (log.x + log.width) && frogRight > log.x) {
          onLogId.value = log.id;
          frogPosition.x += (log.speed * deltaTime) / TILE_SIZE.value; // [★수정★]
          isOnLog = true;
          break;
        }
      }
    }
    if (!isOnLog) {
      onLogId.value = null;
      handleDeath('염수에 빠졌습니다!');
    }
  } else {
    onLogId.value = null;
  }
};

const checkCollisions = () => {
  if (isDead.value) return;

  // 광산 수레 Y좌표: 8~13
  if (frogPosition.y >= 8 && frogPosition.y <= 13) { 
    const frogLeft = frogPosition.x * TILE_SIZE.value;
    const frogRight = frogLeft + TILE_SIZE.value;
    for (const cart of carts.value) {
      if (cart.row === frogPosition.y) {
        if (frogLeft < (cart.x + cart.width) && frogRight > cart.x) {
          handleDeath('광산 수레에 치였습니다!');
          return;
        }
      }
    }
  }
  
  if (frogPosition.x < 0 || frogPosition.x >= WIDTH_TILES || frogPosition.y < 0) {
    handleDeath('경계선을 이탈했습니다!');
    return;
  }
};

// --- 사망/골/리셋 ---
const resetFrog = () => {
  isDead.value = false;
  onLogId.value = null;
  frogPosition.x = 4;
  frogPosition.y = 15;
};
const handleDeath = (reason) => {
  if (isDead.value || gameStatus.value !== 'playing') return;
  console.log(reason);
  isDead.value = true;
  lives.value -= 1;
  setTimeout(() => {
    if (lives.value > 0) {
      resetFrog();
    } else {
      gameStatus.value = 'lost';
      cancelAnimationFrame(gameLoopId);
      handleEndGame(score.value);
    }
  }, 1000);
};
const handleGoal = (goalIndex) => {
  if (goals.value[goalIndex].filled) {
    handleDeath('이미 채워진 결정입니다!');
    return;
  }
  goals.value[goalIndex].filled = true;
  score.value += 300;
  resetFrog();
  if (goals.value.every(g => g.filled)) {
    score.value += 1000;
    gameStatus.value = 'won';
    cancelAnimationFrame(gameLoopId);
    handleEndGame(score.value);
  }
};

// --- 플레이어 조작 (점수 버그 수정됨) ---
const movePlayer = (dx, dy) => {
  if (isDead.value || gameStatus.value !== 'playing' || moveLock.value) return; // [★수정★] moveLock 추가
  
  moveLock.value = true; // [★추가★] 이동 시작 시 잠금
  
  const newX = frogPosition.x + dx;
  const newY = frogPosition.y + dy;
  if (newX < 0 || newX >= WIDTH_TILES || newY < 0 || newY > 15) {
    moveLock.value = false; // [★추가★] 잘못된 이동이면 잠금 해제
    return;
  }
  if (newY === 0) {
    if (newX % 2 !== 0) {
      const goalIndex = Math.floor(newX / 2);
      handleGoal(goalIndex);
    } else {
      handleDeath('결정 사이로 빠졌습니다!');
    }
  } else {
    frogPosition.x = newX;
    frogPosition.y = newY;
    if (dy < 0 && newY <= 13) {
      score.value += 10;
    }
  }
  
  // [★추가★] 0.1초 뒤에 잠금 해제 (연속 이동 방지)
  setTimeout(() => {
    moveLock.value = false;
  }, 100); 
};

// --- PC 키보드 핸들러 ---
const handleKeydown = (e) => {
  e.preventDefault();
  switch (e.key) {
    case 'ArrowUp': movePlayer(0, -1); break;
    case 'ArrowDown': movePlayer(0, 1); break;
    case 'ArrowLeft': movePlayer(-1, 0); break;
    case 'ArrowRight': movePlayer(1, 0); break;
  }
};

// --- 모바일 스와이프 핸들러 ---
const handleTouchStart = (e) => {
  if (gameStatus.value !== 'playing') return;
  touchStartX.value = e.changedTouches[0].clientX;
  touchStartY.value = e.changedTouches[0].clientY;
};

const handleTouchEnd = (e) => {
  if (gameStatus.value !== 'playing' || moveLock.value) return; // [★수정★] moveLock 추가
  
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const dx = touchEndX - touchStartX.value;
  const dy = touchEndY - touchStartY.value;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      movePlayer(dx > 0 ? 1 : -1, 0); // 좌/우
    }
  } else {
    if (Math.abs(dy) > SWIPE_THRESHOLD) {
      movePlayer(0, dy > 0 ? 1 : -1); // 상/하
    }
  }
};

// --- [★수정★] Computed 스타일 (동적 TILE_SIZE) ---
const gameAreaStyle = computed(() => ({
  width: `${GAME_WIDTH.value}px`,
  height: `${GAME_HEIGHT.value}px`,
  // [★수정★] Z-Fold 화면에 맞게 게임 보드를 축소
  transform: `scale(${TILE_SIZE.value / 40})`,
  
  // ▼▼▼ [핵심 수정] 'top left' -> 'center top' ▼▼▼
  transformOrigin: 'center top', 
  // ▲▲▲ (수정 완료) ▲▲▲
}));
const frogStyle = computed(() => ({
  transform: `translate(${frogPosition.x * TILE_SIZE.value}px, ${frogPosition.y * TILE_SIZE.value}px)`,
  width: `${TILE_SIZE.value}px`,
  height: `${TILE_SIZE.value}px`,
}));
// [★추가★] Zone 스타일 동적 계산
const zoneStyle = (topTile, heightTile) => ({
  top: `${topTile * TILE_SIZE.value}px`,
  height: `${heightTile * TILE_SIZE.value}px`,
});
// [★추가★] Goal 스타일 동적 계산
const goalStyle = (index) => ({
  left: `${(index * 2 + 1) * TILE_SIZE.value}px`,
  width: `${TILE_SIZE.value}px`,
  height: `${TILE_SIZE.value}px`,
});

// --- 객체 초기화 (맵 확장) ---
const initializeGameObjects = () => {
  // [★수정★] TILE_SIZE.value를 사용하도록 수정
  logs.value = [
    { id: 'l1', row: 1, x: 0, width: TILE_SIZE.value * 3, speed: 60, type: 'raft-120' },
    { id: 'l2', row: 2, x: GAME_WIDTH.value, width: TILE_SIZE.value * 2, speed: -90, type: 'raft-80' },
    { id: 'l3', row: 3, x: 0, width: TILE_SIZE.value * 4, speed: 40, type: 'raft-160' },
    { id: 'l4', row: 4, x: GAME_WIDTH.value, width: TILE_SIZE.value * 2, speed: -120, type: 'raft-80' },
    { id: 'l5', row: 5, x: 0, width: TILE_SIZE.value * 3, speed: 70, type: 'raft-120' },
    { id: 'l6', row: 6, x: TILE_SIZE.value * 3, width: TILE_SIZE.value * 3, speed: -50, type: 'raft-120' },
  ];
  carts.value = [
    { id: 'c1', row: 8, x: 0, width: TILE_SIZE.value * 2, speed: -100, type: 'cart-80' },
    { id: 'c2', row: 9, x: GAME_WIDTH.value, width: TILE_SIZE.value, speed: 80, type: 'cart-40' },
    { id: 'c3', row: 9, x: TILE_SIZE.value * 3, width: TILE_SIZE.value, speed: 80, type: 'cart-40' },
    { id: 'c4', row: 10, x: 0, width: TILE_SIZE.value * 3, speed: -150, type: 'cart-120' },
    { id: 'c5', row: 11, x: GAME_WIDTH.value, width: TILE_SIZE.value * 2, speed: 110, type: 'cart-80' },
    { id: 'c6', row: 12, x: 0, width: TILE_SIZE.value, speed: -70, type: 'cart-40' },
    { id: 'c7', row: 12, x: TILE_SIZE.value * 4, width: TILE_SIZE.value, speed: -70, type: 'cart-40' },
    { id: 'c8', row: 13, x: 0, width: TILE_SIZE.value * 2, speed: 130, type: 'cart-80' },
  ];
  
  [...logs.value, ...carts.value].forEach(obj => {
    obj.style = computed(() => ({
      transform: `translate(${obj.x}px, ${obj.row * TILE_SIZE.value}px)`,
      width: `${obj.width}px`,
      height: `${TILE_SIZE.value}px`,
    }));
  });
};

// --- 게임 시작/종료 ---
const handleStartGame = async () => {
  if (!auth.currentUser) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }
  try {
    await startFrogGame();
    score.value = 0;
    lives.value = 3;
    goals.value.forEach(g => g.filled = false);
    resetFrog();
    initializeGameObjects();
    gameStatus.value = 'playing';
    window.addEventListener('keydown', handleKeydown);
    lastTimestamp = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error("게임 시작 오류:", error);
    alert(`게임 시작 실패: ${error.message}`);
    router.push('/dashboard');
  }
};
const handleEndGame = async (finalScore) => {
  window.removeEventListener('keydown', handleKeydown);
  if (finalScore > 0) {
    try {
      await endFrogGame({ score: finalScore });
    } catch (error) {
      console.error("점수 저장 오류:", error);
      alert(`점수 저장 실패: ${error.message}`);
    }
  }
};
const goToDashboard = () => {
  router.push('/dashboard');
};

// --- [★수정★] 마운트 로직 (동적 TILE_SIZE 계산) ---
onMounted(async () => {
  // 1. Vue가 렌더링을 완료할 때까지 기다림
  await nextTick();
  
  // 2. 게임 래퍼의 실제 크기를 측정
  const wrapperEl = gameAreaWrapper.value;
  if (wrapperEl) {
    const wrapperWidth = wrapperEl.clientWidth;
    const wrapperHeight = wrapperEl.clientHeight;

    // 3. 가로(9) 기준, 세로(16) 기준 TILE_SIZE를 각각 계산
    const sizeFromWidth = wrapperWidth / WIDTH_TILES;
    const sizeFromHeight = wrapperHeight / HEIGHT_TILES;

    // 4. 두 값 중 *더 작은 값*을 최종 TILE_SIZE로 선택
    // (Z-Fold에서는 너비 기준, 일반 폰에서는 높이 기준이 됨)
    TILE_SIZE.value = Math.min(sizeFromWidth, sizeFromHeight);
    
    // 5. TILE_SIZE가 확정된 후 게임 시작
    handleStartGame();
  } else {
    // 래퍼를 찾지 못한 경우 (예외 처리)
    handleStartGame();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
  }
  if (gameStatus.value === 'playing') {
    handleEndGame(0);
  }
});
</script>

<style scoped>

/* ▼▼▼ [핵심 수정] CSS 전체 수정 ▼▼▼ */
.frog-game-page {
  /* [★수정★] 변수들을 CSS가 아닌 JS(Computed)에서 제어하므로 삭제 */
  --color-road: #78553a;
  --color-water: #3b82f6;
  --color-safe: #c7d2fe;
  --color-goal: #4a0e97;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start; /* [★수정★] 상단 정렬 */
  padding: 10px;
  background-color: #1a1a2e;
  width: 100%;
  min-height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
}

/* [★수정★] 게임 영역 래퍼 */
.game-area-wrapper {
  width: 100%;
  max-width: var(--game-width);
  max-height: calc(100dvh - 20px);

  /* aspect-ratio: 9 / 16; */

  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  flex-shrink: 0;
  position: relative;
  touch-action: none;
}

/* [★수정★] 점수판 (게임 영역 밖, 상단) */
.game-stats-glass {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 500px;
  padding: 12px 20px;
  background: rgba(44, 62, 80, 0.8);
  color: white;
  border-radius: 12px;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
  flex-shrink: 0; /* 줄어들지 않음 */
  margin-bottom: 10px; /* 게임 영역과 간격 */
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-item span {
  font-size: 0.9rem;
  color: #bdc3c7;
}
.stat-item strong {
  font-size: 1.5rem;
  color: #ffffff;
}
.lives {
  font-size: 1.2rem;
  color: #2ecc71;
}

/* [★수정★] 게임 맵 (JS가 크기를 제어) */
.game-area {
  position: relative;
  background-color: #ccc;
  overflow: hidden;
  /* width, height, transform은 JS의 :style 바인딩으로 제어됨 */
}

/* [★수정★] Zone 배경 (JS가 크기와 위치 제어) */
.zone {
  position: absolute;
  width: 100%;
  /* top, height는 JS의 :style 바인딩으로 제어됨 */
}
.start-zone { background-color: var(--color-safe); }
.road-zone { background-color: var(--color-road); }
.mid-zone { background-color: var(--color-safe); }
.water-zone { background-color: var(--color-water); }
.goal-zone { background-color: var(--color-goal); }

.goal {
  position: absolute;
  background-color: var(--color-water);
  /* top, left, width, height는 JS의 :style 바인딩으로 제어됨 */
}
.goal-filled {
  width: 100%;
  height: 100%;
  font-size: 1.5rem; /* 폰트 크기는 고정 */
  display: flex;
  justify-content: center;
  align-items: center;
  animation: goal-shine 0.5s ease;
}
@keyframes goal-shine {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
/* ▼▼▼ [핵심 수정] 이 미디어 쿼리 블록을 추가하세요 ▼▼▼ */
@media (min-width: 768px) {
  /* PC (768px 이상) 화면에서는 */
  .frog-game-page {
    justify-content: center; /* 세로 중앙 정렬로 변경 */
  }
}
/* ▲▲▲ (수정 완료) ▲▲▲ */
.log, .cart {
  position: absolute;
  will-change: transform;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  /* transform, width, height는 JS의 :style 바인딩으로 제어됨 */
}
.raft-80 { background-image: url('@/assets/game_assets/raft_80x40.png'); }
.raft-120 { background-image: url('@/assets/game_assets/raft_120x40.png'); }
.raft-160 { background-image: url('@/assets/game_assets/raft_160x40.png'); }
.cart-40 { background-image: url('@/assets/game_assets/card_40xx40.png'); }
.cart-80 { background-image: url('@/assets/game_assets/card_80xx40.png'); }
.cart-120 { background-image: url('@/assets/game_assets/card_120xx40.png'); }

/* 개구리 (JS가 크기와 위치 제어) */
.frog {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 1.8rem; /* 폰트 크기(이모지)는 고정 */
  will-change: transform;
  transition: transform 0.05s linear;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,0.4));
}
.frog.squashed {
  transform-origin: center;
  animation: squash 0.5s ease forwards;
}
@keyframes squash {
  0% { transform: scale(1); }
  50% { transform: scale(1.5, 0.2); }
  100% { transform: scale(0); }
}

/* [★삭제★] 조이스틱 CSS 모두 삭제 (스와이프로 대체) */
.joystick-controls,
.joy-middle,
.joy-btn {
  display: none;
}

/* 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}
.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.btn-primary {
  background-color: #007bff;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: bold;
  margin-top: 10px;
  transition: background-color 0.2s ease;
}
.btn-primary:hover {
  background-color: #0056b3;
}
.loading-spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
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
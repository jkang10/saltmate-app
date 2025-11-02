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

    <div class="game-area-wrapper">
      <div class="game-area" :style="gameAreaStyle">
        <div class="zone start-zone"></div>
        <div class="zone road-zone"></div>
        <div class="zone mid-zone"></div>
        <div class="zone water-zone"></div>
        <div class="zone goal-zone"></div>

        <div 
          v-for="(goal, index) in goals" 
          :key="'goal-' + index"
          class="goal"
          :style="{ left: `${(index * 2 + 1) * TILE_SIZE}px` }"
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
        >
          </div>

        <div 
          class="frog" 
          :style="frogStyle"
          :class="{ 'squashed': isDead }"
        >
          🐸
        </div>
      </div>

      <div class="joystick-controls">
        <button class="joy-btn joy-up" @touchstart.prevent="movePlayer(0, -1)" @click="movePlayer(0, -1)"><i class="fas fa-arrow-up"></i></button>
        <div class="joy-middle">
          <button class="joy-btn joy-left" @touchstart.prevent="movePlayer(-1, 0)" @click="movePlayer(-1, 0)"><i class="fas fa-arrow-left"></i></button>
          <button class="joy-btn joy-right" @touchstart.prevent="movePlayer(1, 0)" @click="movePlayer(1, 0)"><i class="fas fa-arrow-right"></i></button>
        </div>
        <button class="joy-btn joy-down" @touchstart.prevent="movePlayer(0, 1)" @click="movePlayer(0, 1)"><i class="fas fa-arrow-down"></i></button>
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
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { functions, auth } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- Firebase Functions ---
const startFrogGame = httpsCallable(functions, 'startFrogGame');
const endFrogGame = httpsCallable(functions, 'endFrogGame');
const router = useRouter();

// --- 게임 설정 (변경 없음) ---
const TILE_SIZE = 40;
const WIDTH_TILES = 9;
const HEIGHT_TILES = 13;
const GAME_WIDTH = TILE_SIZE * WIDTH_TILES;
const GAME_HEIGHT = TILE_SIZE * HEIGHT_TILES;

// --- 게임 상태 (변경 없음) ---
const gameStatus = ref('loading');
const score = ref(0);
const lives = ref(3);
const frogPosition = reactive({ x: 4, y: 12 }); // 출발 Y좌표 (12)
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

// --- 게임 루프 (변경 없음) ---
const gameLoop = (timestamp) => {
  if (gameStatus.value !== 'playing') return;
  const deltaTime = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  moveObjects(logs.value, deltaTime);
  moveObjects(carts.value, deltaTime);
  checkOnLog();
  checkCollisions();
  gameLoopId = requestAnimationFrame(gameLoop);
};

// --- 객체 이동 (변경 없음) ---
const moveObjects = (objects, deltaTime) => {
  objects.forEach(obj => {
    obj.x += obj.speed * deltaTime;
    if (obj.speed > 0 && obj.x > GAME_WIDTH) {
      obj.x = -obj.width;
    } else if (obj.speed < 0 && obj.x < -obj.width) {
      obj.x = GAME_WIDTH;
    }
  });
};

// --- [★수정★] 강물/충돌 Y좌표 수정 ---
const checkOnLog = () => {
  // [수정] 강물 Y좌표: 1~5 -> 1~4
  if (frogPosition.y >= 1 && frogPosition.y <= 4) { 
    const frogLeft = frogPosition.x * TILE_SIZE;
    const frogRight = frogLeft + TILE_SIZE;
    let isOnLog = false;
    for (const log of logs.value) {
      if (log.row === frogPosition.y) {
        if (frogLeft < (log.x + log.width) && frogRight > log.x) {
          onLogId.value = log.id;
          frogPosition.x += (log.speed / TILE_SIZE) * (1000/60 / 1000);
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

  // [수정] 광산 수레 Y좌표: 7~11 -> 6~10
  if (frogPosition.y >= 6 && frogPosition.y <= 10) { 
    const frogLeft = frogPosition.x * TILE_SIZE;
    const frogRight = frogLeft + TILE_SIZE;
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

// --- [★수정★] 개구리 리셋 Y좌표 수정 ---
const resetFrog = () => {
  isDead.value = false;
  onLogId.value = null;
  frogPosition.x = 4;
  frogPosition.y = 12; // 출발 Y좌표 (12)
};

// --- 사망/골 처리 (변경 없음) ---
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

// --- [★수정★] 플레이어 이동 Y좌표 제한 수정 ---
const movePlayer = (dx, dy) => {
  if (isDead.value || gameStatus.value !== 'playing') return;
  const newX = frogPosition.x + dx;
  const newY = frogPosition.y + dy;
  // [수정] Y좌표 하단 제한: 12
  if (newX < 0 || newX >= WIDTH_TILES || newY < 0 || newY > 12) {
    return;
  }
  // [수정] 목표 지점 Y좌표: 0
  if (newY === 0) {
    if (newX % 2 !== 0) {
      const goalIndex = Math.floor(newX / 2);
      handleGoal(goalIndex);
    } else {
      handleDeath('결정 사이로 빠졌습니다!');
    }
    return;
  }
  frogPosition.x = newX;
  frogPosition.y = newY;
  if (dy < 0) {
    score.value += 10;
  }
};

// --- 키보드 핸들러 (변경 없음) ---
const handleKeydown = (e) => {
  e.preventDefault();
  switch (e.key) {
    case 'ArrowUp': movePlayer(0, -1); break;
    case 'ArrowDown': movePlayer(0, 1); break;
    case 'ArrowLeft': movePlayer(-1, 0); break;
    case 'ArrowRight': movePlayer(1, 0); break;
  }
};

// --- Computed 스타일 (변경 없음) ---
const gameAreaStyle = computed(() => ({
  width: `${GAME_WIDTH}px`,
  height: `${GAME_HEIGHT}px`,
}));
const frogStyle = computed(() => ({
  transform: `translate(${frogPosition.x * TILE_SIZE}px, ${frogPosition.y * TILE_SIZE}px)`,
  width: `${TILE_SIZE}px`,
  height: `${TILE_SIZE}px`,
}));

// --- [★수정★] 객체 초기화 Y좌표(row) 수정 ---
const initializeGameObjects = () => {
  // 뗏목 설정 (y: 1~4)
  logs.value = [
    { id: 'l1', row: 1, x: 0, width: TILE_SIZE * 3, speed: 60, type: 'raft-120' },
    { id: 'l3', row: 2, x: GAME_WIDTH, width: TILE_SIZE * 2, speed: -90, type: 'raft-80' },
    { id: 'l4', row: 3, x: 0, width: TILE_SIZE * 4, speed: 40, type: 'raft-160' },
    { id: 'l5', row: 4, x: GAME_WIDTH, width: TILE_SIZE * 2, speed: -120, type: 'raft-80' },
  ];
  // 광산 수레 설정 (y: 6~10)
  carts.value = [
    { id: 'c1', row: 6, x: 0, width: TILE_SIZE * 2, speed: -100, type: 'cart-80' },
    { id: 'c2', row: 7, x: GAME_WIDTH, width: TILE_SIZE, speed: 80, type: 'cart-40' },
    { id: 'c3', row: 7, x: TILE_SIZE * 3, width: TILE_SIZE, speed: 80, type: 'cart-40' },
    { id: 'c4', row: 8, x: 0, width: TILE_SIZE * 3, speed: -150, type: 'cart-120' },
    { id: 'c5', row: 9, x: GAME_WIDTH, width: TILE_SIZE * 2, speed: 110, type: 'cart-80' },
    { id: 'c6', row: 10, x: 0, width: TILE_SIZE, speed: -70, type: 'cart-40' },
    { id: 'c7', row: 10, x: TILE_SIZE * 4, width: TILE_SIZE, speed: -70, type: 'cart-40' },
  ];
  
  [...logs.value, ...carts.value].forEach(obj => {
    obj.style = computed(() => ({
      transform: `translate(${obj.x}px, ${obj.row * TILE_SIZE}px)`,
      width: `${obj.width}px`,
      height: `${TILE_SIZE}px`,
    }));
  });
};

// --- 게임 시작/종료/마운트 (변경 없음) ---
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
onMounted(() => {
  handleStartGame();
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
.frog-game-page {
  --tile-size: 40px;
  --game-width: 360px;
  --game-height: 520px; /* 13 tiles */
  --color-road: #78553a; /* 광산 길 (갈색) */
  --color-water: #3b82f6; /* 염수 강 (파랑) */
  --color-safe: #c7d2fe; /* 안전 지대 (연보라) */
  --color-goal: #4a0e97; /* 목표 지대 (진보라) */

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 10px;
  background-color: #1a1a2e;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
}

.game-stats-glass {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 500px;
  padding: 12px 20px;
  background: linear-gradient(135deg, #2c3e50, #34495e);
  color: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  margin-bottom: 15px;
  box-sizing: border-box;
  flex-shrink: 0; 
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

.game-area-wrapper {
  width: 100%;
  max-width: var(--game-width);
  aspect-ratio: 9 / 13;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  flex-shrink: 0;
  position: relative;
}
.game-area {
  position: relative;
  background-color: #ccc;
  overflow: hidden;
}

/* ▼▼▼ [핵심 수정] Zone 배경 Y좌표 수정 ▼▼▼ */
.zone {
  position: absolute;
  width: 100%;
  height: var(--tile-size);
}
/* 출발 지점 (Y: 11~12) - 2칸 */
.start-zone { top: calc(var(--tile-size) * 11); height: calc(var(--tile-size) * 2); background-color: var(--color-safe); }
/* 광산 길 (Y: 6~10) - 5칸 */
.road-zone { top: calc(var(--tile-size) * 6); height: calc(var(--tile-size) * 5); background-color: var(--color-road); }
/* 중간 지점 (Y: 5) - 1칸 */
.mid-zone { top: calc(var(--tile-size) * 5); background-color: var(--color-safe); }
/* 염수 강 (Y: 1~4) - 4칸 */
.water-zone { top: calc(var(--tile-size) * 1); height: calc(var(--tile-size) * 4); background-color: var(--color-water); }
/* 목표 지점 (Y: 0) - 1칸 */
.goal-zone { top: 0; background-color: var(--color-goal); }
/* ▲▲▲ (수정 완료) ▲▲▲ */


.goal {
  position: absolute;
  top: 0;
  width: var(--tile-size);
  height: var(--tile-size);
  background-color: var(--color-water);
}
.goal-filled {
  width: 100%;
  height: 100%;
  font-size: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  animation: goal-shine 0.5s ease;
}
@keyframes goal-shine {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.log, .cart {
  position: absolute;
  will-change: transform;
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
.raft-80 { background-image: url('@/assets/game_assets/raft_80x40.png'); }
.raft-120 { background-image: url('@/assets/game_assets/raft_120x40.png'); }
.raft-160 { background-image: url('@/assets/game_assets/raft_160x40.png'); }
.cart-40 { background-image: url('@/assets/game_assets/card_40xx40.png'); }
.cart-80 { background-image: url('@/assets/game_assets/card_80xx40.png'); }
.cart-120 { background-image: url('@/assets/game_assets/card_120xx40.png'); }
.cart i {
  display: none;
}

.frog {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 1.8rem;
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

.joystick-controls {
  position: absolute;
  bottom: calc(15px + env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  -webkit-user-select: none;
  width: 210px;
}
.joy-middle {
  display: flex;
  width: 100%;
  justify-content: space-between;
}
.joy-btn {
  width: 65px;
  height: 65px;
  border: none;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-size: 1.8rem;
  color: #2c3e50;
  margin: 5px;
  cursor: pointer;
  transition: all 0.1s ease;
}
.joy-btn:active {
  background-color: rgba(255, 255, 255, 0.9);
  transform: scale(0.95);
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}
@media (min-width: 768px) {
  .joystick-controls {
    display: none;
  }
}

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
  z-index: 100;
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
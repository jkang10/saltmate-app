<template>
  <div class="frog-game-page">
    <div class="game-stats">
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
    </div>

    <div class="joystick-controls">
      <button class="joy-btn joy-up" @click="movePlayer(0, -1)"><i class="fas fa-arrow-up"></i></button>
      <div class="joy-middle">
        <button class="joy-btn joy-left" @click="movePlayer(-1, 0)"><i class="fas fa-arrow-left"></i></button>
        <button class="joy-btn joy-right" @click="movePlayer(1, 0)"><i class="fas fa-arrow-right"></i></button>
      </div>
      <button class="joy-btn joy-down" @click="movePlayer(0, 1)"><i class="fas fa-arrow-down"></i></button>
    </div>

    <div v-if="gameStatus !== 'playing'" class="modal-overlay">
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

// --- 게임 설정 ---
const TILE_SIZE = 40; // 타일 1칸의 픽셀 크기
const WIDTH_TILES = 9;
const HEIGHT_TILES = 13;

const GAME_WIDTH = TILE_SIZE * WIDTH_TILES;
const GAME_HEIGHT = TILE_SIZE * HEIGHT_TILES;

// --- 게임 상태 (Reactive) ---
const gameStatus = ref('loading'); // 'loading', 'playing', 'lost', 'won'
const score = ref(0);
const lives = ref(3);
const frogPosition = reactive({ x: 4, y: 12 }); // 타일 좌표 (중앙 하단)
const isDead = ref(false);
const onLogId = ref(null); // 개구리가 타고 있는 뗏목 ID
let gameLoopId = null;

// 목표 (소금 결정)
const goals = ref([
  { filled: false }, { filled: false }, { filled: false }, 
  { filled: false }, { filled: false }
]);

// 뗏목/통나무 (강물)
const logs = ref([]);
// 장애물 (광산 수레)
const carts = ref([]);

// --- 게임 루프 및 상태 관리 ---
let lastTimestamp = 0;

const gameLoop = (timestamp) => {
  if (gameStatus.value !== 'playing') return;

  const deltaTime = (timestamp - lastTimestamp) / 1000; // 초 단위
  lastTimestamp = timestamp;

  // 1. 장애물 및 뗏목 이동
  moveObjects(logs.value, deltaTime);
  moveObjects(carts.value, deltaTime);

  // 2. 개구리가 뗏목 위에 있는지 확인
  checkOnLog();

  // 3. 충돌 감지
  checkCollisions();

  // 4. 다음 프레임 요청
  gameLoopId = requestAnimationFrame(gameLoop);
};

const moveObjects = (objects, deltaTime) => {
  objects.forEach(obj => {
    obj.x += obj.speed * deltaTime;
    // 화면 밖으로 나가면 반대편에서 등장
    if (obj.speed > 0 && obj.x > GAME_WIDTH) {
      obj.x = -obj.width;
    } else if (obj.speed < 0 && obj.x < -obj.width) {
      obj.x = GAME_WIDTH;
    }
  });
};

const checkOnLog = () => {
  if (frogPosition.y > 5 && frogPosition.y < 11) { // 강물 영역
    const frogLeft = frogPosition.x * TILE_SIZE;
    const frogRight = frogLeft + TILE_SIZE;
    
    let isOnLog = false;
    for (const log of logs.value) {
      if (log.row === frogPosition.y) {
        if (frogLeft < (log.x + log.width) && frogRight > log.x) {
          onLogId.value = log.id;
          frogPosition.x += (log.speed / TILE_SIZE) * (1000/60 / 1000); // 뗏목 속도에 맞춰 개구리 이동
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

  // 1. 광산 수레 충돌 (y: 7~11)
  if (frogPosition.y >= 7 && frogPosition.y <= 11) {
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
  
  // 2. 화면 이탈 방지
  if (frogPosition.x < 0 || frogPosition.x >= WIDTH_TILES || frogPosition.y < 0) {
    handleDeath('경계선을 이탈했습니다!');
    return;
  }
};

const resetFrog = () => {
  isDead.value = false;
  onLogId.value = null;
  frogPosition.x = 4;
  frogPosition.y = 12;
};

const handleDeath = (reason) => {
  if (isDead.value || gameStatus.value !== 'playing') return; // 중복 사망 방지
  console.log(reason);
  isDead.value = true;
  lives.value -= 1;
  
  setTimeout(() => {
    if (lives.value > 0) {
      resetFrog();
    } else {
      // 게임 오버
      gameStatus.value = 'lost';
      cancelAnimationFrame(gameLoopId);
      handleEndGame(score.value);
    }
  }, 1000); // 1초 후 부활 또는 게임 오버
};

const handleGoal = (goalIndex) => {
  if (goals.value[goalIndex].filled) {
    handleDeath('이미 채워진 결정입니다!');
    return;
  }
  
  goals.value[goalIndex].filled = true;
  score.value += 300; // 성공 보상
  resetFrog();

  // 모든 목표 달성
  if (goals.value.every(g => g.filled)) {
    score.value += 1000; // 올 클리어 보너스
    gameStatus.value = 'won';
    cancelAnimationFrame(gameLoopId);
    handleEndGame(score.value);
  }
};

// --- 플레이어 조작 ---
const movePlayer = (dx, dy) => {
  if (isDead.value || gameStatus.value !== 'playing') return;

  const newX = frogPosition.x + dx;
  const newY = frogPosition.y + dy;

  // 1. 경계 체크 (y=12 이상은 못 내려감)
  if (newX < 0 || newX >= WIDTH_TILES || newY < 0 || newY > 12) {
    return;
  }

  // 2. 목표 지점 도달
  if (newY === 1) { // 목표 라인
    if (newX % 2 !== 0) { // 1, 3, 5, 7 칸만 목표 지점
      const goalIndex = Math.floor(newX / 2);
      handleGoal(goalIndex);
    } else {
      handleDeath('결정 사이로 빠졌습니다!');
    }
    return;
  }

  // 3. 이동
  frogPosition.x = newX;
  frogPosition.y = newY;

  // 4. 이동 직후 점수 (앞으로 갈 때만)
  if (dy < 0) {
    score.value += 10;
  }
};

const handleKeydown = (e) => {
  e.preventDefault();
  switch (e.key) {
    case 'ArrowUp': movePlayer(0, -1); break;
    case 'ArrowDown': movePlayer(0, 1); break;
    case 'ArrowLeft': movePlayer(-1, 0); break;
    case 'ArrowRight': movePlayer(1, 0); break;
  }
};

// --- computed 스타일 ---
const gameAreaStyle = computed(() => ({
  width: `${GAME_WIDTH}px`,
  height: `${GAME_HEIGHT}px`,
}));

const frogStyle = computed(() => ({
  transform: `translate(${frogPosition.x * TILE_SIZE}px, ${frogPosition.y * TILE_SIZE}px)`,
  width: `${TILE_SIZE}px`,
  height: `${TILE_SIZE}px`,
}));

// --- 초기화 및 백엔드 연동 ---
const initializeGameObjects = () => {
  // 뗏목 설정 (y: 2~6)
  logs.value = [
    // [★수정★] type을 파일명과 유사하게 변경
    { id: 'l1', row: 2, x: 0, width: TILE_SIZE * 3, speed: 60, type: 'raft-120' },
    { id: 'l2', row: 2, x: TILE_SIZE * 5, width: TILE_SIZE * 3, speed: 60, type: 'raft-120' },
    { id: 'l3', row: 3, x: GAME_WIDTH, width: TILE_SIZE * 2, speed: -90, type: 'raft-80' },
    { id: 'l4', row: 4, x: 0, width: TILE_SIZE * 4, speed: 40, type: 'raft-160' },
    { id: 'l5', row: 5, x: GAME_WIDTH, width: TILE_SIZE * 2, speed: -120, type: 'raft-80' },
    { id: 'l6', row: 6, x: 0, width: TILE_SIZE * 3, speed: 70, type: 'raft-120' },
  ];
  // 광산 수레 설정 (y: 7~11)
  carts.value = [
    // [★수정★] type을 파일명과 유사하게 변경
    { id: 'c1', row: 7, x: 0, width: TILE_SIZE * 2, speed: -100, type: 'cart-80' },
    { id: 'c2', row: 8, x: GAME_WIDTH, width: TILE_SIZE, speed: 80, type: 'cart-40' },
    { id: 'c3', row: 8, x: TILE_SIZE * 3, width: TILE_SIZE, speed: 80, type: 'cart-40' },
    { id: 'c4', row: 9, x: 0, width: TILE_SIZE * 3, speed: -150, type: 'cart-120' },
    { id: 'c5', row: 10, x: GAME_WIDTH, width: TILE_SIZE * 2, speed: 110, type: 'cart-80' },
    { id: 'c6', row: 11, x: 0, width: TILE_SIZE, speed: -70, type: 'cart-40' },
    { id: 'c7', row: 11, x: TILE_SIZE * 4, width: TILE_SIZE, speed: -70, type: 'cart-40' },
  ];
  
  // 객체 스타일에 미리 계산된 값 할당 (이 부분은 수정 없음)
  [...logs.value, ...carts.value].forEach(obj => {
    obj.style = computed(() => ({
      transform: `translate(${obj.x}px, ${obj.row * TILE_SIZE}px)`,
      width: `${obj.width}px`,
      height: `${TILE_SIZE}px`,
    }));
  });
};

const handleStartGame = async () => {
  if (!auth.currentUser) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }
  try {
    await startFrogGame(); //
    // 성공 시 게임 시작
    score.value = 0;
    lives.value = 3;
    goals.value.forEach(g => g.filled = false);
    resetFrog();
    initializeGameObjects();
    gameStatus.value = 'playing';
    
    // PC 키보드 리스너 추가
    window.addEventListener('keydown', handleKeydown);
    // 게임 루프 시작
    lastTimestamp = performance.now();
    gameLoopId = requestAnimationFrame(gameLoop);

  } catch (error) {
    console.error("게임 시작 오류:", error);
    alert(`게임 시작 실패: ${error.message}`);
    router.push('/dashboard');
  }
};

const handleEndGame = async (finalScore) => {
  // 리스너 제거
  window.removeEventListener('keydown', handleKeydown);
  
  if (finalScore > 0) {
    try {
      await endFrogGame({ score: finalScore }); //
      // 점수 저장 성공
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
  // 사용자가 페이지를 강제로 떠날 경우, 게임이 진행중이었다면 종료 처리 (점수 없음)
  if (gameStatus.value === 'playing') {
    handleEndGame(0);
  }
});

</script>

<style scoped>
:root {
  --tile-size: 40px;
  --game-width: 360px; /* 9 tiles */
  --game-height: 520px; /* 13 tiles */
  --color-road: #5a3a22;
  --color-water: #1e3a8a;
  --color-safe: #22c55e;
  --color-goal: #166534;
}

.frog-game-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background-color: #f0f2f5;
  height: 100vh;
  box-sizing: border-box;
}

.game-stats {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: var(--game-width);
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  margin-bottom: 10px;
  box-sizing: border-box;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-item span {
  font-size: 0.9rem;
  color: #555;
}
.stat-item strong {
  font-size: 1.5rem;
  color: #1e3a8a;
}
.lives {
  font-size: 1.2rem;
  color: var(--color-safe);
}

.game-area-wrapper {
  width: 100%;
  max-width: var(--game-width);
  aspect-ratio: 9 / 13;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

.game-area {
  position: relative;
  background-color: #ccc;
  overflow: hidden;
}

.zone {
  position: absolute;
  width: 100%;
  height: var(--tile-size);
}
.start-zone { top: calc(var(--tile-size) * 12); background-color: var(--color-safe); }
.road-zone { top: calc(var(--tile-size) * 7); height: calc(var(--tile-size) * 5); background-color: var(--color-road); }
.mid-zone { top: calc(var(--tile-size) * 6); background-color: var(--color-safe); }
.water-zone { top: calc(var(--tile-size) * 1); height: calc(var(--tile-size) * 5); background-color: var(--color-water); }
.goal-zone { top: 0; background-color: var(--color-goal); }

.goal {
  position: absolute;
  top: var(--tile-size);
  width: var(--tile-size);
  height: var(--tile-size);
  background-color: #000; /* 물에 빠지는 공간 */
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
}
.log, .cart {
  position: absolute;
  will-change: transform;
  /* 공통 이미지 스타일 */
  background-size: 100% 100%; /* 이미지가 타일에 꽉 차도록 */
  background-repeat: no-repeat;
}

/* 1. 소금 결정 뗏목 (Rafts) */
.raft-80 {
  background-image: url('@/assets/game_assets/raft_80x40.png'); /* */
}
.raft-120 {
  background-image: url('@/assets/game_assets/raft_120x40.png'); /* */
}
.raft-160 {
  background-image: url('@/assets/game_assets/raft_160x40.png'); /* */
}

/* 2. 광산 수레 (Carts) */
.cart-40 {
  background-image: url('@/assets/game_assets/card_40xx40.png'); /* */
}
.cart-80 {
  background-image: url('@/assets/game_assets/card_80xx40.png'); /* */
}
.cart-120 {
  background-image: url('@/assets/game_assets/card_120xx40.png'); /* */
}
/* ▲▲▲ [신규 추가] ▲▲▲ */

.frog {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 1.8rem;
  will-change: transform;
  transition: transform 0.1s linear;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
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

/* --- 모바일 조이스틱 --- */
.joystick-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 15px;
  user-select: none;
  -webkit-user-select: none;
}
.joy-middle {
  display: flex;
  width: 180px;
  justify-content: space-between;
}
.joy-btn {
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 50%;
  background-color: #fff;
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  font-size: 1.5rem;
  color: #333;
  margin: 5px;
  cursor: pointer;
}
.joy-btn:active {
  background-color: #e0e0e0;
  transform: scale(0.95);
}

/* PC에서는 조이스틱 숨기기 */
@media (min-width: 768px) {
  .joystick-controls {
    display: none;
  }
}

/* --- 모달 --- */
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
}
.btn-primary {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 10px;
}
.loading-spinner { /* */
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
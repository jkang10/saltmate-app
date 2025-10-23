<template>
  <div class="snake-game-container">
    <header class="page-header">
      <h1><i class="fas fa-worm"></i> 지렁이 게임</h1>
      <p class="description">소금 결정을 먹고 꼬리를 길게 만드세요. 꼬리나 벽에 닿으면 끝!</p>
    </header>

    <div class="game-wrapper card">
      <div class="game-ui">
        <div class="score">점수: <strong>{{ score }}</strong></div>
        <button @click="toggleMute" class="mute-button">
          <i :class="isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up'"></i>
        </button>
        <div class="high-score">최고 기록: {{ highScore }}</div>
      </div>

      <div class="canvas-wrapper" 
           @touchstart.prevent="handleTouchStart"
           @touchmove.prevent="handleTouchMove"
           @touchend="handleTouchEnd">
        <canvas ref="gameCanvas" width="600" height="600"></canvas>
        <div v-if="gameState === 'ready'" class="game-overlay">
          <h2>준비</h2>
          <button @click="startGame" class="game-button" :disabled="isLoading">
            <span v-if="isLoading">입장 중...</span>
            <span v-else>시작하기 (100 SaltMate)</span>
          </button>
        </div>
        <div v-if="gameState === 'ended'" class="game-overlay">
          <h2>게임 종료!</h2>
          <p>점수: <strong>{{ score.toLocaleString() }}</strong></p>
          <p v-if="awardedPoints > 0">획득 보상: {{ awardedPoints.toLocaleString() }} SaltMate</p>
          <div class="button-group">
            <button @click="startGame" class="game-button">다시하기</button>
            <router-link to="/dashboard" class="game-button secondary">돌아가기</router-link>
          </div>
        </div>
      </div>

      <div class="mobile-controls">
        <button @mousedown.prevent @touchstart.prevent="changeDirection('up')"><i class="fas fa-arrow-up"></i></button>
        <div>
          <button @mousedown.prevent @touchstart.prevent="changeDirection('left')"><i class="fas fa-arrow-left"></i></button>
          <button @mousedown.prevent @touchstart.prevent="changeDirection('down')"><i class="fas fa-arrow-down"></i></button>
          <button @mousedown.prevent @touchstart.prevent="changeDirection('right')"><i class="fas fa-arrow-right"></i></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '@/firebaseConfig';

// ▼▼▼ [신규] 사운드 파일 import ▼▼▼
import soundBgm1 from '@/assets/sounds/SnakeGame_BB01.mp3';
import soundBgm2 from '@/assets/sounds/SnakeGame_BB02.mp3';
import soundBgm3 from '@/assets/sounds/SnakeGame_BB03.mp3';
import soundEatFile from '@/assets/sounds/SnakeGame_IN.mp3';
import soundGameOverFile from '@/assets/sounds/SnakeGame_EN.mp3';
// ▲▲▲

const functionsInSeoul = getFunctions(app, 'asia-northeast3');
const gameCanvas = ref(null);
const ctx = ref(null);
const score = ref(0);
const highScore = ref(localStorage.getItem('snakeHighScore') || 0);
const gameState = ref('ready'); // ready, playing, ended
const isLoading = ref(false);
const awardedPoints = ref(0);

const mapSize = 600;
const gridSize = 20;

let snake = [];
let food = {};
let direction = 'right';
let nextDirection = 'right';
let gameLoopId = null;

const touchStartPos = ref({ x: 0, y: 0 });
const touchEndPos = ref({ x: 0, y: 0 });
const minSwipeDistance = 30;

// ▼▼▼ [신규] 사운드 객체 및 상태 변수 ▼▼▼
const bgmFiles = [soundBgm1, soundBgm2, soundBgm3];
const selectedBgmFile = bgmFiles[Math.floor(Math.random() * bgmFiles.length)];
const backgroundMusic = new Audio(selectedBgmFile);
backgroundMusic.loop = true;
backgroundMusic.volume = 0.3;

const soundEat = new Audio(soundEatFile);
const soundGameOver = new Audio(soundGameOverFile);

const isMuted = ref(false);
let audioContextStarted = false;
// ▲▲▲

const initGame = () => {
  snake = [ { x: 15, y: 15 } ]; // 중앙에서 시작
  direction = 'right';
  nextDirection = 'right';
  score.value = 0;
  awardedPoints.value = 0;
  placeFood();
};

const placeFood = () => {
  food = {
    x: Math.floor(Math.random() * (mapSize / gridSize)),
    y: Math.floor(Math.random() * (mapSize / gridSize))
  };
  if (snake.some(segment => segment.x === food.x && segment.y === food.y)) {
    placeFood();
  }
};

// ▼▼▼ [신규] 사운드 재생 헬퍼 함수 ▼▼▼
const initAudioContext = () => {
  if (audioContextStarted) return;
  audioContextStarted = true;
};

const playSound = (audioElement) => {
  if (!isMuted.value && audioContextStarted) {
    audioElement.currentTime = 0;
    audioElement.play().catch(e => console.error("SFX 재생 오류:", e));
  }
};

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  backgroundMusic.muted = isMuted.value;
  soundEat.muted = isMuted.value;
  soundGameOver.muted = isMuted.value;
};
// ▲▲▲

const startGame = async () => {
  if (isLoading.value) return;
  isLoading.value = true;
  
  // ▼▼▼ [수정] 오디오 컨텍스트 초기화 및 BGM 재생 ▼▼▼
  initAudioContext();
  if (!isMuted.value) {
    backgroundMusic.play().catch(e => console.error("BGM 재생 오류:", e));
  }
  // ▲▲▲

  try {
    const startFunc = httpsCallable(functionsInSeoul, 'startSnakeGame');
    await startFunc();
    
    initGame();
    gameState.value = 'playing';
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();
  } catch (error) {
    alert(`게임 시작 실패: ${error.message}`);
    // [수정] 실패 시 BGM 정지
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  } finally {
    isLoading.value = false;
  }
};

const endGame = async () => {
  if (gameState.value === 'ended') return; // 중복 실행 방지
  
  // ▼▼▼ [수정] BGM 정지 및 게임 오버 사운드 재생 ▼▼▼
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  playSound(soundGameOver);
  // ▲▲▲

  gameState.value = 'ended';
  cancelAnimationFrame(gameLoopId);
  gameLoopId = null;

  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('snakeHighScore', score.value);
  }
  
  try {
    const endFunc = httpsCallable(functionsInSeoul, 'endSnakeGame');
    const result = await endFunc({ score: score.value });
    awardedPoints.value = result.data.awardedPoints;
  } catch (error) {
    console.error("결과 전송 실패:", error);
    alert(`결과 전송 실패: ${error.message}`);
  }
};

const gameLoop = () => { /* ... (기존과 동일) ... */ };

const update = () => {
  direction = nextDirection;
  const head = { ...snake[0] };
  
  if (direction === 'right') head.x++;
  else if (direction === 'left') head.x--;
  else if (direction === 'down') head.y++;
  else if (direction === 'up') head.y--;

  if (head.x < 0 || head.x >= mapSize / gridSize || head.y < 0 || head.y >= mapSize / gridSize) {
    return endGame();
  }
  if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
    return endGame();
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score.value += 10;
    // ▼▼▼ [수정] 먹이 사운드 재생 ▼▼▼
    playSound(soundEat);
    // ▲▲▲
    placeFood();
  } else {
    snake.pop();
  }
};

const draw = () => {
  if (!ctx.value) return;
  ctx.value.fillStyle = '#2c3e50';
  ctx.value.fillRect(0, 0, mapSize, mapSize);

  snake.forEach((segment, index) => {
    ctx.value.fillStyle = index === 0 ? '#2ecc71' : '#27ae60';
    ctx.value.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize - 1, gridSize - 1);
  });

  ctx.value.fillStyle = '#f1c40f';
  ctx.value.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 1, gridSize - 1);
};

const changeDirection = (newDir) => {
  if (newDir === 'up' && direction !== 'down') nextDirection = 'up';
  else if (newDir === 'down' && direction !== 'up') nextDirection = 'down';
  else if (newDir === 'left' && direction !== 'right') nextDirection = 'left';
  else if (newDir === 'right' && direction !== 'left') nextDirection = 'right';
};

const handleKeydown = (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') changeDirection('up');
  else if (e.key === 'ArrowDown' || e.key === 's') changeDirection('down');
  else if (e.key === 'ArrowLeft' || e.key === 'a') changeDirection('left');
  else if (e.key === 'ArrowRight' || e.key === 'd') changeDirection('right');
};

const handleTouchStart = (e) => {
  touchStartPos.value = { x: e.touches[0].clientX, y: e.touches[0].clientY };
};

const handleTouchMove = (e) => {
  touchEndPos.value = { x: e.touches[0].clientX, y: e.touches[0].clientY };
};

const handleTouchEnd = () => {
  const dx = touchEndPos.value.x - touchStartPos.value.x;
  const dy = touchEndPos.value.y - touchStartPos.value.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    // 수평 스와이프
    if (Math.abs(dx) > minSwipeDistance) {
      changeDirection(dx > 0 ? 'right' : 'left');
    }
  } else {
    // 수직 스와이프
    if (Math.abs(dy) > minSwipeDistance) {
      changeDirection(dy > 0 ? 'down' : 'up');
    }
  }
};

onMounted(() => {
  ctx.value = gameCanvas.value.getContext('2d');
  window.addEventListener('keydown', handleKeydown);
  draw();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  
  // ▼▼▼ [수정] 페이지 이탈 시 모든 사운드 정지 ▼▼▼
  backgroundMusic.pause();
  backgroundMusic.src = '';
  soundEat.src = '';
  soundGameOver.src = '';
  // ▲▲▲
});

</script>

<style scoped>
.snake-game-container {
  max-width: 600px;
  margin: 90px auto 20px;
  padding: 0 10px;
  color: #ecf0f1;
}

/* ▼▼▼ [핵심 수정] 헤더 글씨 색상 변경 ▼▼▼ */
.page-header { 
  text-align: center; 
  margin-bottom: 30px; 
}
.page-header h1 { 
  font-size: 2.8em; 
  color: #ecf0f1; /* 어두운 배경에 맞춰 밝은 색으로 */
}
.page-header p { 
  font-size: 1.1em; 
  color: #bdc3c7; /* 어두운 배경에 맞춰 밝은 색으로 */
}
/* ▲▲▲ */

.game-wrapper {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 25px;
}
.game-ui {
  display: flex;
  justify-content: space-between;
  font-size: 1.5em;
  padding: 0 10px 15px 10px;
  border-bottom: 2px solid rgba(255,255,255,0.2);
  margin-bottom: 20px;
}
.score strong { color: #f1c40f; }
.high-score { color: #95a5a6; }

.canvas-wrapper {
  position: relative;
  width: 600px;
  height: 600px;
  margin: 0 auto;
  touch-action: none;
}
canvas {
  background-color: #2c3e50;
  border-radius: 8px;
}
.game-overlay {
  position: absolute;
  inset: 0;
  background: rgba(44, 62, 80, 0.9);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  border-radius: 8px;
}
.game-overlay h2 { font-size: 3em; margin-bottom: 10px; }
.game-overlay p { font-size: 1.5em; }
.game-button {
  padding: 12px 30px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  border-radius: 8px;
  border: none;
  background: linear-gradient(145deg, #f1c40f, #e67e22);
  color: white;
  text-decoration: none;
}
.button-group { display: flex; gap: 15px; margin-top: 20px; }
.game-button.secondary { background: #6c757d; }

.mobile-controls {
  display: none;
  width: 150px;
  margin: 20px auto 0;
  text-align: center;
}
.mobile-controls button {
  width: 50px;
  height: 50px;
  font-size: 1.4em;
  margin: 2px;
  border: none;
  border-radius: 50%;
  background-color: #4e6a85;
  color: white;
}
@media (max-width: 768px) {
  .snake-game-container {
    padding: 0 10px;
    margin-top: 70px;
  }
  .game-wrapper {
    padding: 15px;
  }
  .canvas-wrapper { 
    width: 100%; 
    height: auto; 
    aspect-ratio: 1 / 1; 
  }
  canvas { width: 100%; height: 100%; }
  .mobile-controls { display: block; }
  .game-ui { font-size: 1.2em; }
}
/* ▼▼▼ [신규] 음소거 버튼 스타일 추가 ▼▼▼ */
.game-ui {
  align-items: center; /* 아이콘 세로 중앙 정렬 */
}
.mute-button {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #ecf0f1;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color 0.2s;
}
.mute-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
/* ▲▲▲ */
</style>
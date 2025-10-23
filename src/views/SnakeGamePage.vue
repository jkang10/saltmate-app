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

      <div class="game-area-wrapper">
        <div class="canvas-wrapper" 
             @touchstart.prevent="handleTouchStart"
             @touchmove.prevent="handleTouchMove"
             @touchend="handleTouchEnd">
          <canvas ref="gameCanvas" width="600" height="600"></canvas>
        </div>
        
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
      </div>

    <div v-if="gameState === 'playing'" class="mobile-controls" :style="{ bottom: `${dpadPosition.y}px`, right: `${dpadPosition.x}px` }">
      <div class="dpad-drag-handle"
           @touchstart.prevent="handleDpadTouchStart"
           @touchmove.prevent="handleDpadTouchMove"
           @touchend="handleDpadTouchEnd">
        <i class="fas fa-arrows-alt"></i>
      </div>
      <button @click="changeDirection('up')" class="control-btn up"><i class="fas fa-arrow-up"></i></button>
      <button @click="changeDirection('left')" class="control-btn left"><i class="fas fa-arrow-left"></i></button>
      <button @click="changeDirection('down')" class="control-btn down"><i class="fas fa-arrow-down"></i></button>
      <button @click="changeDirection('right')" class="control-btn right"><i class="fas fa-arrow-right"></i></button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '@/firebaseConfig';

// 사운드 파일 import
import soundBgm1 from '@/assets/sounds/SnakeGame_BB01.mp3';
import soundBgm2 from '@/assets/sounds/SnakeGame_BB02.mp3';
import soundBgm3 from '@/assets/sounds/SnakeGame_BB03.mp3';
import soundEatFile from '@/assets/sounds/SnakeGame_IN.mp3';
import soundGameOverFile from '@/assets/sounds/SnakeGame_EN.mp3';

const functionsInSeoul = getFunctions(app, 'asia-northeast3');
const gameCanvas = ref(null);
const ctx = ref(null);
const score = ref(0);
const highScore = ref(localStorage.getItem('snakeHighScore') || 0);
const gameState = ref('ready');
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

const bgmFiles = [soundBgm1, soundBgm2, soundBgm3];
const selectedBgmFile = bgmFiles[Math.floor(Math.random() * bgmFiles.length)];
const backgroundMusic = new Audio(selectedBgmFile);
backgroundMusic.loop = true;
backgroundMusic.volume = 0.3;

const soundEat = new Audio(soundEatFile);
const soundGameOver = new Audio(soundGameOverFile);

const isMuted = ref(false);
let audioContextStarted = false;

const dpadPosition = reactive({
  x: 30, // right
  y: 30, // bottom
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  dpadStartX: 0,
  dpadStartY: 0
});

const initGame = () => {
  snake = [ { x: 15, y: 15 } ];
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

const startGame = async () => {
  if (isLoading.value) return;
  isLoading.value = true;
  
  initAudioContext();
  if (!isMuted.value) {
    backgroundMusic.play().catch(e => console.error("BGM 재생 오류:", e));
  }

  try {
    const startFunc = httpsCallable(functionsInSeoul, 'startSnakeGame');
    await startFunc();
    
    initGame();
    gameState.value = 'playing';
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();
  } catch (error) {
    alert(`게임 시작 실패: ${error.message}`);
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
  } finally {
    isLoading.value = false;
  }
};

const endGame = async () => {
  if (gameState.value === 'ended') return;
  
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  playSound(soundGameOver);

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

const gameLoop = () => {
  if (gameState.value !== 'playing') return;

  setTimeout(() => {
    gameLoopId = requestAnimationFrame(gameLoop);
    draw();
    update();
  }, 100);
};

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
    playSound(soundEat);
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
  if (gameState.value !== 'playing') return;
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
  if (e.target.closest('.mobile-controls')) return;
  touchStartPos.value = { x: e.touches[0].clientX, y: e.touches[0].clientY };
};
const handleTouchMove = (e) => {
  if (e.target.closest('.mobile-controls')) return;
  touchEndPos.value = { x: e.touches[0].clientX, y: e.touches[0].clientY };
};
const handleTouchEnd = (e) => {
  if (e.target.closest('.mobile-controls')) return;
  const dx = touchEndPos.value.x - touchStartPos.value.x;
  const dy = touchEndPos.value.y - touchStartPos.value.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (Math.abs(dx) > minSwipeDistance) changeDirection(dx > 0 ? 'right' : 'left');
  } else {
    if (Math.abs(dy) > minSwipeDistance) changeDirection(dy > 0 ? 'down' : 'up');
  }
};

const handleDpadTouchStart = (e) => {
  dpadPosition.isDragging = true;
  dpadPosition.dragStartX = e.touches[0].clientX;
  dpadPosition.dragStartY = e.touches[0].clientY;
  dpadPosition.dpadStartX = dpadPosition.x;
  dpadPosition.dpadStartY = dpadPosition.y;
};

const handleDpadTouchMove = (e) => {
  if (!dpadPosition.isDragging) return;
  const deltaX = e.touches[0].clientX - dpadPosition.dragStartX;
  const deltaY = e.touches[0].clientY - dpadPosition.dragStartY;

  // 화면 경계(10px 여백)를 넘지 않도록 최대/최소값 설정
  const maxX = window.innerWidth - 160; // D-pad 너비(150) + 여백(10)
  const maxY = window.innerHeight - 160; // D-pad 높이(150) + 여백(10)

  // X (right) 위치 업데이트
  dpadPosition.x = Math.max(10, Math.min(maxX, dpadPosition.dpadStartX - deltaX));
  // Y (bottom) 위치 업데이트
  dpadPosition.y = Math.max(10, Math.min(maxY, dpadPosition.dpadStartY - deltaY));
};

const handleDpadTouchEnd = () => {
  dpadPosition.isDragging = false;
};

onMounted(() => {
  ctx.value = gameCanvas.value.getContext('2d');
  window.addEventListener('keydown', handleKeydown);
  draw();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  
  backgroundMusic.pause();
  backgroundMusic.src = '';
  soundEat.src = '';
  soundGameOver.src = '';
});
</script>

<style scoped>
.snake-game-container {
  max-width: 600px;
  margin: 90px auto 20px;
  padding: 0 10px;
  color: #ecf0f1;
  background: linear-gradient(135deg, #2c3e50, #34495e);
  min-height: calc(100vh - 70px);
}
.page-header { 
  text-align: center; 
  margin-bottom: 30px; 
}
.page-header h1 { 
  font-size: 2.8em; 
  color: #ecf0f1;
}
.page-header p { 
  font-size: 1.1em; 
  color: #bdc3c7; 
}
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
  align-items: center;
  font-size: 1.5em;
  padding: 0 10px 15px 10px;
  border-bottom: 2px solid rgba(255,255,255,0.2);
  margin-bottom: 20px;
}
.score strong { color: #f1c40f; }
.high-score { color: #95a5a6; }
.game-area-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
}
.canvas-wrapper {
  position: absolute;
  inset: 0;
  touch-action: none;
}
canvas {
  width: 100%;
  height: 100%;
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
  z-index: 10;
  touch-action: auto;
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
  position: fixed;
  width: 150px;
  height: 150px;
  z-index: 100;
  transition: opacity 0.2s;
}
.mobile-controls[style*="bottom"] {
  display: block;
}
.mobile-controls button {
  position: absolute;
  width: 50px;
  height: 50px;
  font-size: 1.4em;
  margin: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.5);
  color: white;
  backdrop-filter: blur(5px);
  cursor: pointer;
}
.control-btn.up { top: 0; left: 50px; }
.control-btn.left { top: 50px; left: 0; }
.control-btn.down { top: 100px; left: 50px; }
.control-btn.right { top: 50px; left: 100px; }
.dpad-drag-handle {
  position: absolute;
  top: 50px;
  left: 50px;
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  cursor: grab;
  z-index: 101;
}
.dpad-drag-handle:active {
  cursor: grabbing;
  background: rgba(255, 255, 255, 0.5);
}
@media (max-width: 768px) {
  .snake-game-container {
    padding: 0 10px;
    margin-top: 70px;
  }
  .game-wrapper {
    padding: 15px;
  }
  .game-ui { font-size: 1.2em; }
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
</style>
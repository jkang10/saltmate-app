<template>
  <div class="maze-page-container">
    <div v-if="gameState === 'ready'" class="game-state-screen">
      <div class="intro-content">
        <i class="fas fa-dungeon intro-icon"></i>
        <h2>수정 동굴 탈출</h2>
        <p>매일 구조가 바뀌는 미로를 탐험하고 숨겨진 보물을 찾아 탈출하세요! 방향키로 움직일 수 있습니다.</p>
        <div class="entry-fee">
          <label>입장료</label>
          <span>100 SaltMate</span>
        </div>
        <button @click="startGame" class="action-button" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-small"></span>
          <span v-else>게임 시작</span>
        </button>
      </div>
    </div>

    <div v-if="gameState === 'loading'" class="game-state-screen">
      <div class="spinner"></div><p>미로 생성 중...</p>
    </div>
    <div v-else-if="gameState === 'error'" class="game-state-screen">
      <p class="error-message">{{ error }}</p>
      <router-link to="/dashboard" class="action-button">돌아가기</router-link>
    </div>

    <div v-else-if="gameState === 'playing'" class="game-play-area">
      <div class="game-hud">
        <div class="hud-item">
          <i class="fas fa-clock"></i> {{ timeRemaining }}초
        </div>
        <div class="hud-item">
          <i class="fas fa-gem"></i> {{ collectedTreasures.length }} / {{ treasures.length }}
        </div>
      </div>
      <div class="maze-area" :style="mazeAreaStyle">
        <div class="maze-grid" :style="gridStyle">
          <template v-for="(row, y) in maze" :key="y">
            <div
              v-for="(cell, x) in row"
              :key="`${y}-${x}`"
              :class="getCellClass(cell, y, x)"
            >
              <div v-if="isTreasure(y, x)" class="treasure-item"></div>
            </div>
          </template>
        </div>
        <div class="player" :style="playerStyle"></div>
      </div>
    </div>

    <div v-if="gameState === 'cleared'" class="game-state-screen">
      <div class="result-content">
        <h2>{{ finalResult.reward > 0 ? '🎉 탈출 성공! 🎉' : '시간 초과!' }}</h2>
        <p>걸린 시간: {{ finalResult.time }}초</p>
        <p>총 점수: {{ finalResult.score.toLocaleString() }}점</p>
        <p v-if="finalResult.reward > 0" class="reward-text">획득 보상: {{ finalResult.reward.toLocaleString() }} SaltMate</p>
        <router-link to="/dashboard" class="action-button">대시보드로 돌아가기</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const isLoading = ref(false);
const error = ref(null);
const gameState = ref('ready');
const maze = ref([]);
const playerPos = ref({ y: 1, x: 1 });
const treasures = ref([]);
const collectedTreasures = ref([]);
const exit = ref(null);
const finalResult = ref(null);
const timeRemaining = ref(300);
let timerInterval = null;

const CELL_SIZE = 25;

const mazeDimensions = computed(() => ({
  width: maze.value[0]?.length || 0,
  height: maze.value.length || 0,
}));

const mazeAreaStyle = computed(() => ({
  width: `${mazeDimensions.value.width * CELL_SIZE}px`,
  height: `${mazeDimensions.value.height * CELL_SIZE}px`,
}));

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${mazeDimensions.value.width}, 1fr)`,
  gridTemplateRows: `repeat(${mazeDimensions.value.height}, 1fr)`,
}));

const playerStyle = computed(() => ({
  top: `${playerPos.value.y * CELL_SIZE}px`,
  left: `${playerPos.value.x * CELL_SIZE}px`,
  width: `${CELL_SIZE}px`,
  height: `${CELL_SIZE}px`,
}));

const getCellClass = (cell, y, x) => {
  const isExit = exit.value && exit.value.y === y && exit.value.x === x;
  return { wall: cell === 1, path: cell === 0, exit: isExit };
};
const isTreasure = (y, x) => {
  return treasures.value.some(t => t.y === y && t.x === x && !collectedTreasures.value.includes(t.id));
};

const handleKeyDown = (e) => {
  if (gameState.value !== 'playing') return;
  e.preventDefault();
  const { y, x } = playerPos.value;
  let newY = y, newX = x;

  if (e.key === 'ArrowUp') newY--;
  if (e.key === 'ArrowDown') newY++;
  if (e.key === 'ArrowLeft') newX--;
  if (e.key === 'ArrowRight') newX++;

  if (maze.value[newY]?.[newX] === 0) {
    playerPos.value = { y: newY, x: newX };
    checkInteractions(newY, newX);
  }
};

const checkInteractions = (y, x) => {
  const treasure = treasures.value.find(t => t.y === y && t.x === x);
  if (treasure && !collectedTreasures.value.includes(treasure.id)) {
    collectedTreasures.value.push(treasure.id);
  }
  if (exit.value && exit.value.y === y && exit.value.x === x) {
    endGame(true);
  }
};

const startGame = async () => {
  isLoading.value = true;
  gameState.value = 'loading';
  error.value = null;
  try {
    const startMazeGame = httpsCallable(functions, 'startMazeGame');
    const result = await startMazeGame();
    const { maze: receivedMaze, treasures: receivedTreasures, exit: receivedExit } = result.data;
    
    maze.value = receivedMaze;
    treasures.value = receivedTreasures;
    exit.value = receivedExit;
    
    playerPos.value = { y: 1, x: 1 };
    collectedTreasures.value = [];
    timeRemaining.value = 300;
    gameState.value = 'playing';

    timerInterval = setInterval(() => {
      timeRemaining.value--;
      if (timeRemaining.value <= 0) {
        endGame(false);
      }
    }, 1000);

  } catch (e) {
    error.value = e.message;
    gameState.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

const endGame = async (isSuccess) => {
  if (timerInterval) clearInterval(timerInterval);
  if (gameState.value !== 'playing') return;

  gameState.value = 'loading';
  isLoading.value = true;
  
  if (!isSuccess) {
    finalResult.value = { time: 300, score: 0, reward: 0 };
    gameState.value = 'cleared';
    isLoading.value = false;
    return;
  }

  try {
    const endMazeGame = httpsCallable(functions, 'endMazeGame');
    const result = await endMazeGame({ treasuresCollected: collectedTreasures.value });
    finalResult.value = result.data;
    gameState.value = 'cleared';
  } catch (e) {
    error.value = e.message;
    gameState.value = 'error';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  if (timerInterval) clearInterval(timerInterval);
});
</script>

<style scoped>
.maze-page-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: calc(100vh - 70px);
  background: #2c3e50;
  padding: 20px;
  overflow: hidden;
}
.game-state-screen {
  text-align: center;
  color: white;
  background-color: rgba(0,0,0,0.3);
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
}
.intro-icon { font-size: 4em; color: #f1c40f; margin-bottom: 20px; }
.intro-content h2, .result-content h2 { font-size: 2.5em; margin-bottom: 10px; }
.intro-content p, .result-content p { font-size: 1.1em; color: #ecf0f1; line-height: 1.6; max-width: 400px; }
.entry-fee { margin: 20px 0; font-size: 1.2em; }
.entry-fee label { opacity: 0.8; margin-right: 10px; }
.entry-fee span { font-weight: bold; color: #f1c40f; }
.reward-text { font-size: 1.5em !important; font-weight: bold; color: #2ecc71 !important; }
.action-button {
  display: inline-block;
  margin-top: 20px;
  padding: 12px 30px;
  background-color: #3498db;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-size: 1.2em;
  font-weight: bold;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-button:hover { background-color: #2980b9; transform: translateY(-2px); }
.action-button:disabled { background-color: #95a5a6; cursor: not-allowed; }
.spinner, .spinner-small {
  display: inline-block;
  border: 4px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.spinner { width: 50px; height: 50px; margin-bottom: 15px; }
.spinner-small { width: 18px; height: 18px; border-width: 2px; vertical-align: middle; margin-right: 8px;}
.game-play-area { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.game-hud {
  display: flex; gap: 30px; color: white; background: rgba(0,0,0,0.4); padding: 10px 20px;
  border-radius: 10px; font-size: 1.5em; font-weight: bold;
  border: 1px solid rgba(255,255,255,0.2);
}
.hud-item { display: flex; align-items: center; gap: 10px; }
.maze-area { position: relative; }
.maze-grid { 
  display: grid;
  background-color: #bdc3c7;
  border: 3px solid #7f8c8d; 
  box-shadow: 0 0 20px rgba(0,0,0,0.5); 
  /* [핵심 오류 수정] 그리드가 부모 영역을 100% 채우도록 설정 */
  width: 100%;
  height: 100%;
}
.wall { background-color: #34495e; box-shadow: inset 2px 2px 5px rgba(0,0,0,0.5); }
.path { background-color: transparent; }
.exit {
  background-color: #2ecc71;
  animation: glow-exit 1.5s infinite alternate;
}
.treasure-item {
  width: 100%; height: 100%; display: flex; justify-content: center; align-items: center;
  font-size: 1.2em; animation: glow-treasure 2s infinite alternate;
  background-image: radial-gradient(circle, #f1c40f 20%, transparent 70%);
}
.treasure-item::before { 
  content: '💎';
  text-shadow: 0 0 10px #fff;
}
@keyframes glow-exit { from { box-shadow: 0 0 5px #2ecc71; } to { box-shadow: 0 0 20px #fff, 0 0 30px #2ecc71; } }
@keyframes glow-treasure { from { opacity: 0.7; } to { opacity: 1; transform: scale(1.1); } }

.player {
  position: absolute;
  background-color: #e74c3c;
  border-radius: 50%;
  box-shadow: 0 0 10px #c0392b;
  transition: top 0.1s linear, left 0.1s linear;
  animation: player-spawn 0.5s ease-out;
}
@keyframes player-spawn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.error-message { color: #e74c3c; font-size: 1.2em; }
</style>
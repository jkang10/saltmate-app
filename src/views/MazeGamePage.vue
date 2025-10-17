<template>
  <div class="maze-page-container">
    <div v-if="gameState === 'ready'" class="game-state-screen">
      <div class="intro-content">
        <i class="fas fa-dungeon intro-icon"></i>
        <h2>수정 동굴 탈출</h2>
        <p>매일 구조가 바뀌는 미로를 탐험하고 숨겨진 보물을 찾아 탈출하세요! PC에서는 방향키, 모바일에서는 화면의 조이스틱으로 움직일 수 있습니다.</p>
        <div class="entry-fee">
          <label>입장료</label>
          <span>100 SaltMate</span>
        </div>
        <button @click="startGame" class="action-button" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-small"></span>
          <span v-else>도전하기 (일일 5회)</span>
        </button>
      </div>
    </div>

    <div v-if="gameState === 'loading'" class="game-state-screen">
      <div class="spinner"></div>
      <p>미로 생성 중...</p>
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
      <div class="maze-area" :style="mazeAreaStyle" :class="{ 'torch-active': isTorchActive }">
        <div class="maze-grid" :style="gridStyle">
          <template v-for="(row, y) in maze" :key="y">
            <div
              v-for="(cell, x) in row"
              :key="`${y}-${x}`"
              :class="getCellClass(cell, y, x)"
            >
              <div v-if="isTreasure(y, x)" class="treasure-item"></div>
              <div v-if="isTrap(y, x)" :class="`trap-item ${getTrapType(y,x)}`"></div>
            </div>
          </template>
        </div>
        <div class="player" :style="playerStyle" :class="{'is-stunned': isPlayerStunned}"></div>
        <div v-if="isCompassActive" class="compass-arrow" :style="compassStyle"></div>
      </div>

      <transition name="fade">
        <div v-if="allTreasuresFound" class="exit-unlocked-message">
          <i class="fas fa-check-circle"></i> 모든 보물을 찾았습니다! 출구가 열렸습니다!
        </div>
      </transition>

      <div class="tools-hud">
          <div class="tool-item" :class="{ 'is-drilling': isDrilling }" @click="activateDrillMode">
              <button :disabled="tools.drill.used || isDrilling">
                  <i class="fas fa-tools"></i>
              </button>
              <span>드릴</span>
          </div>
          <div class="tool-item" @click="useCompass">
              <button :disabled="tools.compass.used">
                  <i class="fas fa-compass"></i>
              </button>
              <span>나침반</span>
          </div>
          <div class="tool-item" @click="useTorch">
              <button :disabled="tools.torch.used">
                  <i class="fas fa-fire"></i>
              </button>
              <span>횃불</span>
          </div>
      </div>
      <div v-if="isDrilling" class="drill-message">
          <i class="fas fa-exclamation-circle"></i> 파괴할 방향을 선택하세요!
      </div>

      <div class="mobile-controls">
        <button 
          @mousedown="startContinuousMove('ArrowUp')" @touchstart.prevent="startContinuousMove('ArrowUp')" 
          @mouseup="stopContinuousMove" @mouseleave="stopContinuousMove" @touchend="stopContinuousMove" 
          class="control-btn up"><i class="fas fa-arrow-up"></i>
        </button>
        <button 
          @mousedown="startContinuousMove('ArrowLeft')" @touchstart.prevent="startContinuousMove('ArrowLeft')" 
          @mouseup="stopContinuousMove" @mouseleave="stopContinuousMove" @touchend="stopContinuousMove" 
          class="control-btn left"><i class="fas fa-arrow-left"></i>
        </button>
        <button 
          @mousedown="startContinuousMove('ArrowDown')" @touchstart.prevent="startContinuousMove('ArrowDown')" 
          @mouseup="stopContinuousMove" @mouseleave="stopContinuousMove" @touchend="stopContinuousMove" 
          class="control-btn down"><i class="fas fa-arrow-down"></i>
        </button>
        <button 
          @mousedown="startContinuousMove('ArrowRight')" @touchstart.prevent="startContinuousMove('ArrowRight')" 
          @mouseup="stopContinuousMove" @mouseleave="stopContinuousMove" @touchend="stopContinuousMove" 
          class="control-btn right"><i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>

    <div v-if="gameState === 'cleared'" class="game-state-screen">
      <div class="result-content">
        <h2>{{ finalResult.reward > 0 ? '🎉 탈출 성공! 🎉' : '시간 초과!' }}</h2>
        <p>걸린 시간: {{ finalResult.time }}초</p>
        <p>총 점수: {{ finalResult.score.toLocaleString() }}점</p>
        <p v-if="finalResult.reward > 0" class="reward-text">획득 보상: {{ finalResult.reward.toLocaleString() }} SaltMate</p>
        
        <div class="button-group">
          <button @click="startGame" class="action-button">다시하기</button>
          <router-link to="/dashboard" class="action-button secondary">대시보드로 돌아가기</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, reactive } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- 상태 변수 (State Variables) ---
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
const movementInterval = ref(null);

const traps = ref([]);
const isPlayerStunned = ref(false);
const tools = reactive({
  compass: { used: false },
  drill: { used: false },
  torch: { used: false },
});
const isCompassActive = ref(false);
const isTorchActive = ref(false);
const isDrilling = ref(false);

const CELL_SIZE = 25;

// --- 계산된 속성 (Computed Properties) ---
const allTreasuresFound = computed(() => {
  return treasures.value.length > 0 && collectedTreasures.value.length === treasures.value.length;
});

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

const compassStyle = computed(() => {
  if (!exit.value) return {};
  const dy = exit.value.y - playerPos.value.y;
  const dx = exit.value.x - playerPos.value.x;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return {
    top: `${playerPos.value.y * CELL_SIZE + CELL_SIZE / 2}px`,
    left: `${playerPos.value.x * CELL_SIZE + CELL_SIZE / 2}px`,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
  };
});

// --- 렌더링 헬퍼 함수 ---
const getCellClass = (cell, y, x) => {
  const isExitCell = exit.value && exit.value.y === y && exit.value.x === x;
  return { 
    wall: cell === 1, 
    path: cell === 0, 
    exit: isExitCell && allTreasuresFound.value 
  };
};

const isTreasure = (y, x) => treasures.value.some(t => t.y === y && t.x === x && !collectedTreasures.value.includes(t.id));
const isTrap = (y, x) => traps.value.some(t => t.y === y && t.x === x);
const getTrapType = (y, x) => traps.value.find(t => t.y === y && t.x === x)?.type;

// --- 게임 로직 함수 ---
const movePlayer = (direction) => {
  const event = { key: direction, preventDefault: () => {} };
  handleKeyDown(event);
};

const handleKeyDown = (e) => {
  if (gameState.value !== 'playing' || isPlayerStunned.value) return;
  e.preventDefault();

  if (isDrilling.value) {
    executeDrill(e.key);
    return;
  }
  
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

const startContinuousMove = (direction) => {
  if (movementInterval.value) return;
  movePlayer(direction);
  movementInterval.value = setInterval(() => {
    movePlayer(direction);
  }, 120);
};

const stopContinuousMove = () => {
  if (movementInterval.value) {
    clearInterval(movementInterval.value);
    movementInterval.value = null;
  }
};

const checkInteractions = (y, x) => {
  const treasure = treasures.value.find(t => t.y === y && t.x === x);
  if (treasure && !collectedTreasures.value.includes(treasure.id)) {
    collectedTreasures.value.push(treasure.id);
  }

  const trap = traps.value.find(t => t.y === y && t.x === x);
  if (trap) {
    isPlayerStunned.value = true;
    setTimeout(() => {
      isPlayerStunned.value = false;
    }, 1500);
  }

  if (allTreasuresFound.value && exit.value && exit.value.y === y && exit.value.x === x) {
    endGame(true);
  }
};

const useCompass = () => {
  if (tools.compass.used) return;
  tools.compass.used = true;
  isCompassActive.value = true;
  setTimeout(() => {
    isCompassActive.value = false;
  }, 3000);
};

const useTorch = () => {
  if (tools.torch.used) return;
  tools.torch.used = true;
  isTorchActive.value = true;
  setTimeout(() => {
    isTorchActive.value = false;
  }, 5000);
};

const activateDrillMode = () => {
  if (tools.drill.used) return;
  isDrilling.value = !isDrilling.value;
};

const executeDrill = async (direction) => {
  const { y, x } = playerPos.value;
  let wallY = y, wallX = x;

  if (direction === 'ArrowUp') wallY--;
  else if (direction === 'ArrowDown') wallY++;
  else if (direction === 'ArrowLeft') wallX--;
  else if (direction === 'ArrowRight') wallX++;
  else return;

  if (maze.value[wallY]?.[wallX] !== 1) {
    alert("벽이 아닌 곳에는 드릴을 사용할 수 없습니다.");
    isDrilling.value = false;
    return;
  }
  
  isLoading.value = true;
  isDrilling.value = false;
  tools.drill.used = true;

  try {
    const useDrillFunc = httpsCallable(functions, 'useDrill');
    await useDrillFunc({ y: wallY, x: wallX });
    maze.value[wallY][wallX] = 0;
  } catch (err) {
    error.value = err.message;
    tools.drill.used = false;
  } finally {
    isLoading.value = false;
  }
};

const startGame = async () => {
  isLoading.value = true;
  gameState.value = 'loading';
  error.value = null;
  isPlayerStunned.value = false;
  Object.assign(tools, { compass: { used: false }, drill: { used: false }, torch: { used: false } });

  try {
    const startMazeGame = httpsCallable(functions, 'startMazeGame');
    const result = await startMazeGame();
    const { maze: receivedMaze, treasures: receivedTreasures, traps: receivedTraps, exit: receivedExit } = result.data;
    
    maze.value = receivedMaze;
    treasures.value = receivedTreasures;
    traps.value = receivedTraps;
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
  if (movementInterval.value) clearInterval(movementInterval.value);
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
  box-sizing: border-box;
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
  max-width: 90vw;
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
.game-play-area { 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: 20px;
  position: relative; 
  width: 100%;
}
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
  width: 100%;
  height: 100%;
}
.wall { background-color: #34495e; box-shadow: inset 2px 2px 5px rgba(0,0,0,0.5); transition: opacity 0.5s; }
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
.player.is-stunned {
  animation: shake 0.5s infinite;
  background-color: #f39c12 !important;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
.compass-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-bottom: 30px solid #e74c3c;
  z-index: 10;
  transition: transform 0.5s ease;
  filter: drop-shadow(0 0 5px #000);
}
.maze-area.torch-active .wall {
  opacity: 0.3;
}
.trap-item {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
.trap-item.rockfall::before {
  content: '🪨';
  font-size: 1.2em;
  opacity: 0.5;
}
.trap-item.ice_patch {
  background: rgba(173, 216, 230, 0.4);
  border-radius: 50%;
}
.tools-hud {
  display: flex;
  gap: 15px;
  margin-top: 15px;
  padding: 10px;
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
}
.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  gap: 5px;
  cursor: pointer;
}
.tool-item button {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid white;
  background-color: #3498db;
  color: white;
  font-size: 1.5em;
  cursor: pointer;
  transition: all 0.2s;
}
.tool-item button:hover:not(:disabled) {
  background-color: #2980b9;
}
.tool-item button:disabled {
  background-color: #7f8c8d;
  opacity: 0.6;
  cursor: not-allowed;
}
.tool-item.is-drilling button {
  background-color: #e67e22;
  animation: pulse-orange 1s infinite;
}
@keyframes pulse-orange {
  0% { box-shadow: 0 0 0 0 rgba(230, 126, 34, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(230, 126, 34, 0); }
  100% { box-shadow: 0 0 0 0 rgba(230, 126, 34, 0); }
}
.drill-message {
  color: #f1c40f;
  font-weight: bold;
  margin-top: 10px;
  animation: blink-text 1.5s infinite;
}
@keyframes blink-text {
  50% { opacity: 0.5; }
}
@keyframes player-spawn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.error-message { color: #e74c3c; font-size: 1.2em; }
@keyframes spin { to { transform: rotate(360deg); } }
.mobile-controls {
  display: none;
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 150px;
  height: 150px;
  z-index: 100;
}
.control-btn {
  position: absolute;
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.5);
  color: white;
  font-size: 1.5em;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  backdrop-filter: blur(5px);
}
.control-btn:active {
  background: rgba(255, 255, 255, 0.4);
}
.control-btn.up { top: 0; left: 50px; }
.control-btn.left { top: 50px; left: 0; }
.control-btn.down { top: 100px; left: 50px; }
.control-btn.right { top: 50px; left: 100px; }
@media (max-width: 768px) {
  .mobile-controls {
    display: block;
  }
  .game-play-area {
    padding-bottom: 180px; 
  }
  .game-hud {
    font-size: 1.2em;
    padding: 8px 15px;
  }
}
.button-group {
  margin-top: 30px;
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
}
.action-button.secondary {
  background-color: transparent;
  border: 2px solid #bdc3c7;
  color: #bdc3c7;
}
.action-button.secondary:hover {
  background-color: #bdc3c7;
  color: #2c3e50;
}
.exit-unlocked-message {
  position: absolute;
  top: 80px;
  background-color: #2ecc71;
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  font-weight: bold;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  z-index: 50;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s, transform 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
<template>
  <div class="maze-container">
    <div v-if="isLoading" class="game-state">
      <div class="spinner"></div><p>미로 생성 중...</p>
    </div>
    <div v-else-if="error" class="game-state">
      <p class="error-message">{{ error }}</p>
      <router-link to="/dashboard" class="back-button">돌아가기</router-link>
    </div>
    <div v-else-if="gameState === 'playing'" class="game-area">
      <div class="maze-grid" :style="gridStyle">
        <div v-for="(cell, index) in flatMaze" :key="index" :class="getCellClass(cell, index)"></div>
      </div>
      <div class="player" :style="playerStyle"></div>
    </div>
     <div v-if="gameState === 'cleared'" class="game-state">
      <h2>🎉 탈출 성공! 🎉</h2>
      <p>걸린 시간: {{ finalResult.time }}초</p>
      <p>총 점수: {{ finalResult.score.toLocaleString() }}점</p>
      <p>획득 보상: {{ finalResult.reward.toLocaleString() }} SaltMate</p>
      <router-link to="/dashboard" class="back-button">대시보드로 돌아가기</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const isLoading = ref(true);
const error = ref(null);
const gameState = ref('loading');
const maze = ref([]); // 이 변수는 2차원 배열을 저장합니다.
const playerPos = ref({ y: 1, x: 1 });
const treasures = ref([]);
const collectedTreasures = ref([]);
const exit = ref(null);
const finalResult = ref(null);
const mazeDimensions = ref({ width: 15, height: 15 }); // [핵심 추가] 미로 크기 저장

const CELL_SIZE = 25;

const flatMaze = computed(() => maze.value.flat());
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${mazeDimensions.value.width}, ${CELL_SIZE}px)`,
}));
const playerStyle = computed(() => ({
  top: `${playerPos.value.y * CELL_SIZE}px`,
  left: `${playerPos.value.x * CELL_SIZE}px`,
  width: `${CELL_SIZE}px`,
  height: `${CELL_SIZE}px`,
}));

const getCellClass = (cell, index) => {
  const y = Math.floor(index / mazeDimensions.value.width);
  const x = index % mazeDimensions.value.width;
  const isTreasure = treasures.value.some(t => t.y === y && t.x === x && !collectedTreasures.value.includes(t.id));
  const isExit = exit.value && exit.value.y === y && exit.value.x === x;
  return {
    wall: cell === 1,
    path: cell === 0,
    treasure: isTreasure,
    exit: isExit,
  };
};

const handleKeyDown = (e) => {
  if (gameState.value !== 'playing') return;
  const { y, x } = playerPos.value;
  let newY = y, newX = x;

  if (e.key === 'ArrowUp') newY--;
  if (e.key === 'ArrowDown') newY++;
  if (e.key === 'ArrowLeft') newX--;
  if (e.key === 'ArrowRight') newX++;

  // 2차원 배열을 사용하여 충돌 감지
  if (maze.value[newY]?.[newX] === 0) {
    playerPos.value = { y: newY, x: newX };
    checkInteractions(newY, newX);
  }
};

const checkInteractions = (y, x) => {
  const treasure = treasures.value.find(t => t.y === y && t.x === x);
  if (treasure && !collectedTreasures.value.includes(treasure.id)) {
    collectedTreasures.value.push(treasure.id);
    // [수정] alert 대신 console.log 사용 또는 더 나은 UI로 교체 권장
    console.log(`'${treasure.name}'을(를) 획득했습니다! (+${treasure.value}점)`);
  }
  if (exit.value && exit.value.y === y && exit.value.x === x) {
    endGame();
  }
};

const startGame = async () => {
  try {
    const startMazeGame = httpsCallable(functions, 'startMazeGame');
    const result = await startMazeGame();

    // [핵심 수정] 서버에서 받은 2차원 maze 배열을 직접 사용합니다.
    const { maze: receivedMaze, treasures: receivedTreasures, exit: receivedExit } = result.data;
    
    // 2차원 배열로부터 직접 가로, 세로 길이를 계산합니다.
    const mazeHeight = receivedMaze.length;
    const mazeWidth = receivedMaze[0]?.length || 0;
    
    mazeDimensions.value = { width: mazeWidth, height: mazeHeight };
    maze.value = receivedMaze; // 2차원 배열을 그대로 할당

    treasures.value = receivedTreasures;
    exit.value = receivedExit;
    gameState.value = 'playing';

  } catch (e) {
    error.value = e.message;
    gameState.value = 'error'; // 에러 상태 추가
  } finally {
    isLoading.value = false;
  }
};

const endGame = async () => {
  gameState.value = 'loading';
  isLoading.value = true;
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
  startGame();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.maze-container {
  display: flex; justify-content: center; align-items: center;
  min-height: 80vh; background-color: #34495e;
}
.game-state {
  text-align: center; color: white; background-color: #2c3e50;
  padding: 40px; border-radius: 15px;
}
.game-area { position: relative; }
.maze-grid {
  display: grid; border: 2px solid #95a5a6;
}
.wall { background-color: #7f8c8d; }
.path { background-color: #ecf0f1; }
.treasure { background-color: #f1c40f; }
.exit { background-color: #2ecc71; }
.player {
  position: absolute; background-color: #e74c3c;
  border-radius: 50%; transition: top 0.1s linear, left 0.1s linear;
}
.error-message { color: #e74c3c; }
.back-button {
  display: inline-block; margin-top: 20px; padding: 10px 20px;
  background-color: #3498db; color: white; text-decoration: none; border-radius: 5px;
}
</style>
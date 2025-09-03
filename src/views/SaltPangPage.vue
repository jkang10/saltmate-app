<template>
  <div class="salt-pang-page">
    <header class="page-header">
      <h1>💎 솔트팡</h1>
      <p>같은 모양의 소금 결정을 3개 이상 맞춰보세요!</p>
    </header>

    <main class="game-container card">
      <div v-if="gameState === 'ready'" class="game-intro">
        <h2>게임 준비</h2>
        <p>입장료: <strong>10 SaltMate</strong></p>
        <p>60초 동안 최대한 높은 점수를 획득하세요!</p>
        <button @click="startGame" class="game-button" :disabled="isStarting">
           <span v-if="isStarting">입장 중...</span>
           <span v-else>게임 시작</span>
        </button>
      </div>

      <div v-if="gameState === 'playing' || gameState === 'ended'" class="game-area">
        <div class="game-stats">
          <div class="stat-item">시간: <strong>{{ timer }}</strong></div>
          <div class="stat-item">점수: <strong>{{ score.toLocaleString() }}</strong></div>
        </div>
        <div class="game-board" :style="{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }">
          <div
            v-for="(cell, index) in board"
            :key="index"
            class="cell"
            @click="selectCell(index)"
            :class="{ selected: selectedCell === index }"
          >
            <transition name="pop">
              <span v-if="cell" class="gem" :style="{ color: gemColors[cell] }">
                {{ gemIcons[cell] }}
              </span>
            </transition>
          </div>
        </div>
      </div>
      
      <div v-if="gameState === 'ended'" class="game-overlay">
        <div class="end-modal">
          <h2>게임 종료!</h2>
          <p>최종 점수: <strong>{{ score.toLocaleString() }}</strong></p>
          <p>획득 보상: <strong>{{ awardedPoints.toLocaleString() }} SaltMate</strong></p>
          <button @click="resetGame" class="game-button">다시하기</button>
        </div>
      </div>
    </main>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import { getFunctions, httpsCallable } from 'firebase/functions';

// --- 게임 상수 ---
const BOARD_SIZE = 8;
const NUM_GEM_TYPES = 5;
const GAME_DURATION = 60; // 초

const gemIcons = ['💎', '🟡', '🟢', '🔵', '🟣', '🔴'];
const gemColors = ['#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e74c3c', '#e67e22'];

// --- [신규] 사운드 객체 ---
const sounds = {
  match: new Audio(require('@/assets/sounds/match.mp3')),
  background: new Audio(require('@/assets/sounds/bgm.mp3')),
};
sounds.background.loop = true;
sounds.background.volume = 0.3;

// --- 상태 변수 ---
const gameState = ref('ready'); // ready, playing, ended
const board = ref([]);
const score = ref(0);
const timer = ref(GAME_DURATION);
const selectedCell = ref(null);
const isProcessing = ref(false);
const isStarting = ref(false);
const error = ref('');
const awardedPoints = ref(0);

let timerInterval = null;
let sessionId = null;

// --- 게임 보드 생성 로직 ---
const createBoard = () => {
  const newBoard = [];
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    newBoard.push(Math.floor(Math.random() * NUM_GEM_TYPES) + 1);
  }
  return newBoard;
};

// --- 게임 시작/종료 ---
const startGame = async () => {
  isStarting.value = true;
  error.value = '';
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const startSession = httpsCallable(functions, 'startSaltPangSession');
    const result = await startSession();
    sessionId = result.data.sessionId;

    score.value = 0;
    awardedPoints.value = 0;
    timer.value = GAME_DURATION;
    board.value = createBoard();
    // 초기 매치 제거 (단순화를 위해 여기선 생략, 실제 구현 시 필요)
    gameState.value = 'playing';
    
    // [수정] 사운드 재생 추가
    sounds.background.play();

    timerInterval = setInterval(() => {
      timer.value--;
      if (timer.value <= 0) {
        endGame();
      }
    }, 1000);
  } catch (err) {
    console.error("게임 시작 오류:", err);
    error.value = `게임 시작 실패: ${err.message}`;
  } finally {
    isStarting.value = false;
  }
};

const endGame = async () => {
  clearInterval(timerInterval);
  gameState.value = 'ended';
  
  // [수정] 사운드 정지 추가
  sounds.background.pause();
  sounds.background.currentTime = 0;

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const endSession = httpsCallable(functions, 'endSaltPangSession');
    const result = await endSession({ sessionId, score: score.value });
    awardedPoints.value = result.data.awardedPoints;
  } catch (err) {
    console.error("게임 종료 오류:", err);
    error.value = `결과 처리 실패: ${err.message}`;
  }
};

const resetGame = () => {
  gameState.value = 'ready';
  sessionId = null;
};

// --- 셀 선택 및 스왑 로직 ---
const selectCell = (index) => {
  if (isProcessing.value || gameState.value !== 'playing') return;

  if (selectedCell.value === null) {
    selectedCell.value = index;
  } else {
    // 인접 셀인지 확인 (가로, 세로)
    const row1 = Math.floor(selectedCell.value / BOARD_SIZE);
    const col1 = selectedCell.value % BOARD_SIZE;
    const row2 = Math.floor(index / BOARD_SIZE);
    const col2 = index % BOARD_SIZE;

    const isAdjacent = Math.abs(row1 - row2) + Math.abs(col1 - col2) === 1;
    
    if (isAdjacent) {
      swapAndCheck(selectedCell.value, index);
    }
    selectedCell.value = null;
  }
};

const swapAndCheck = async (index1, index2) => {
  isProcessing.value = true;
  
  [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];

  // 잠시 후 매치 확인 (애니메이션 시간 고려)
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const hasMatches = await checkAndClearMatches();

  // 만약 스왑 후 매치가 없다면, 다시 원위치
  if (!hasMatches) {
    await new Promise(resolve => setTimeout(resolve, 150));
    [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  } else {
    // 매치가 있다면, 연쇄 반응 처리
    while (await processBoard()) {}
  }

  isProcessing.value = false;
};

// --- 매치 확인 및 보드 정리 로직 ---
const processBoard = async () => {
  const hasCleared = await checkAndClearMatches();
  if (hasCleared) {
    await new Promise(resolve => setTimeout(resolve, 300));
    dropDownGems();
    fillEmptyCells();
    await new Promise(resolve => setTimeout(resolve, 300));
    return true; // 연쇄 반응이 있었음
  }
  return false; // 더 이상 반응 없음
}

const checkAndClearMatches = async () => {
  const matches = new Set();
  // 가로 매치
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const i = r * BOARD_SIZE + c;
      if (board.value[i] && board.value[i] === board.value[i + 1] && board.value[i] === board.value[i + 2]) {
        for (let k = 0; k < 3; k++) matches.add(i + k);
      }
    }
  }
  // 세로 매치
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const i = r * BOARD_SIZE + c;
      if (board.value[i] && board.value[i] === board.value[i + BOARD_SIZE] && board.value[i] === board.value[i + 2 * BOARD_SIZE]) {
        for (let k = 0; k < 3; k++) matches.add(i + k * BOARD_SIZE);
      }
    }
  }
  
  if (matches.size > 0) {
    // [수정] 사운드 재생 추가
    sounds.match.currentTime = 0;
    sounds.match.play();
    score.value += matches.size * 10;
    matches.forEach(index => (board.value[index] = null));
    return true;
  }
  return false;
};

const dropDownGems = () => {
  for (let c = 0; c < BOARD_SIZE; c++) {
    let emptyRow = -1;
    for (let r = BOARD_SIZE - 1; r >= 0; r--) {
      const i = r * BOARD_SIZE + c;
      if (board.value[i] === null && emptyRow === -1) {
        emptyRow = r;
      } else if (board.value[i] !== null && emptyRow !== -1) {
        const emptyIndex = emptyRow * BOARD_SIZE + c;
        board.value[emptyIndex] = board.value[i];
        board.value[i] = null;
        emptyRow--;
      }
    }
  }
};

const fillEmptyCells = () => {
  for (let i = 0; i < board.value.length; i++) {
    if (board.value[i] === null) {
      board.value[i] = Math.floor(Math.random() * NUM_GEM_TYPES) + 1;
    }
  }
};

onUnmounted(() => {
  clearInterval(timerInterval);
  // [수정] 사운드 정지 추가
  sounds.background.pause();
});
</script>

<style scoped>
/* (기존 스타일과 동일) */
.salt-pang-page { max-width: 500px; margin: 70px auto; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.game-container { padding: 20px; }
.game-intro { text-align: center; }
.game-stats { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 1.2em; }
.game-board { display: grid; gap: 4px; border: 2px solid #ccc; padding: 5px; border-radius: 8px; }
.cell { width: 50px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: #f0f0f0; border-radius: 4px; cursor: pointer; }
.cell.selected { background-color: #a0a0a0; }
.gem { font-size: 2em; user-select: none; transition: transform 0.2s; }
.game-button { padding: 12px 25px; font-size: 1.1em; cursor: pointer; }
.game-overlay { position: absolute; inset: 0; background-color: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; border-radius: 12px; }
.end-modal { background-color: white; padding: 30px; border-radius: 8px; text-align: center; color: #333; }
.error-message { margin-top: 15px; color: red; text-align: center; }
.pop-enter-active, .pop-leave-active { transition: transform 0.3s; }
.pop-enter-from, .pop-leave-to { transform: scale(0); }
</style>
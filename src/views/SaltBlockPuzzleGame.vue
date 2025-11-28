<template>
  <div 
    class="block-puzzle-page"
    @mouseup="handleDragEnd"
    @touchend="handleDragEnd"
    @touchcancel="handleDragEnd"
    @mousemove.prevent="handleDragMove"
    @touchmove.prevent="handleDragMove"
  >
    <div class="game-header-area">
      <div class="stat-card">
        <span class="label">최고</span>
        <span class="value gold">{{ highScore.toLocaleString() }}</span>
      </div>
      <div class="stat-card main-score">
        <span class="label">점수</span>
        <span class="value cyan">{{ score.toLocaleString() }}</span>
      </div>
      <div class="stat-card">
        <span class="label">가루</span>
        <span class="value white">{{ alchemyDust }} 💎</span>
      </div>
    </div>

    <div class="game-board-container">
      <div class="board-aspect-ratio-box" ref="gameBoardRef">
        <div class="game-board">
          <div
            v-for="(cell, index) in board.flat()"
            :key="index"
            class="game-cell"
            :class="{ 
              'filled': cell === 1,
              'preview': previewCells.includes(index),
              'invalid': invalidDrop && previewCells.includes(index),
              'clearing': clearingCells.includes(index)
            }"
          ></div>
        </div>
        
        <transition name="pop">
          <div v-if="comboMessage" class="combo-popup">
            {{ comboMessage }}
          </div>
        </transition>
      </div>
    </div>

    <div class="block-spawner-area">
      <div class="block-spawner">
        <div
          v-for="(block, index) in blocks"
          :key="block.uid || index"
          class="spawn-slot"
          :class="{ 'is-empty': !block.shape, 'is-dragging': isDragging && dragged.index === index }"
        >
          <div 
            v-if="block.shape" 
            class="block-preview" 
            :style="getBlockGridStyle(block)"
            @mousedown.prevent="handleDragStart($event, block, index)"
            @touchstart.prevent="handleDragStart($event, block, index)"
          >
            <div
              v-for="(cell, cIndex) in block.shape.flat()"
              :key="cIndex"
              class="block-cell"
              :class="{ 'filled': cell === 1 }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div 
      v-if="dragged.block && isDragging" 
      class="floating-block-container" 
      :style="floatingBlockStyle"
    >
      <div class="block-shape" :style="getBlockGridStyle(dragged.block)">
        <div
          v-for="(cell, cIndex) in dragged.block.shape.flat()"
          :key="cIndex"
          class="block-cell"
          :class="{ 'filled': cell === 1, 'invalid': invalidDrop }"
        ></div>
      </div>
    </div>

    <div v-if="gameStatus !== 'playing'" class="modal-overlay">
      <div class="modal-content glass-panel">
        <h2 v-if="gameStatus === 'loading'" class="loading-text"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</h2>
        
        <div v-if="gameStatus === 'lost'">
          <h2 class="game-over-title">GAME OVER</h2>
          <div class="result-stats">
            <div class="result-row">
              <span>최종 점수</span>
              <strong class="cyan">{{ score.toLocaleString() }}</strong>
            </div>
            <div class="result-row">
              <span>획득 가루</span>
              <strong>{{ alchemyDust }} 💎</strong>
            </div>
            <div class="result-row highlight">
              <span>획득 SaltMate</span>
              <strong class="gold">+{{ finalPointsAwarded.toLocaleString() }} P</strong>
            </div>
          </div>
          
          <div class="modal-actions">
            <button @click="restartGame" class="btn-restart">다시 도전</button>
            <button @click="goToDashboard" class="btn-exit">나가기</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { functions, auth } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- Firebase ---
const startGameFunc = httpsCallable(functions, 'startBlockPuzzleGame');
const endGameFunc = httpsCallable(functions, 'endBlockPuzzleGame');
const router = useRouter();

// --- 상수 ---
const BOARD_SIZE = 10;
const TOUCH_OFFSET_Y = 80; 
const COMBO_SCORES = { 1: 100, 2: 300, 3: 600, 4: 1000, 5: 2000, 6: 5000 };

// --- 블록 정의 ---
const BLOCK_DEFINITIONS = {
  '1x1': { shape: [[1]] },
  '1x2': { shape: [[1, 1]] },
  '2x1': { shape: [[1], [1]] },
  '1x3': { shape: [[1, 1, 1]] },
  '3x1': { shape: [[1], [1], [1]] },
  '1x4': { shape: [[1, 1, 1, 1]] },
  '4x1': { shape: [[1], [1], [1], [1]] },
  '1x5': { shape: [[1, 1, 1, 1, 1]] },
  '5x1': { shape: [[1], [1], [1], [1], [1]] },
  '2x2': { shape: [[1, 1], [1, 1]] },
  '3x3': { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
  'L1': { shape: [[1, 0], [1, 0], [1, 1]] }, 
  'L2': { shape: [[1, 1, 1], [1, 0, 0]] },   
  'L3': { shape: [[1, 1], [0, 1], [0, 1]] }, 
  'L4': { shape: [[0, 0, 1], [1, 1, 1]] },   
};
const blockTypes = Object.keys(BLOCK_DEFINITIONS);

// --- 상태 변수 ---
const gameStatus = ref('loading');
const board = reactive(Array(BOARD_SIZE * BOARD_SIZE).fill(0));
const blocks = ref([{uid: 1, shape: null}, {uid: 2, shape: null}, {uid: 3, shape: null}]);
const score = ref(0);
const highScore = ref(Number(localStorage.getItem('blockPuzzleHighScore') || 0));
const alchemyDust = ref(0);
const comboMessage = ref('');
const finalPointsAwarded = ref(0);
const clearingCells = ref([]);

// --- 드래그 관련 ---
const gameBoardRef = ref(null);
const isDragging = ref(false);
const dragged = reactive({ block: null, index: -1 });
const pointerPosition = reactive({ x: 0, y: 0 });
const previewCells = ref([]);
const invalidDrop = ref(false);
const boardMetrics = reactive({ left: 0, top: 0, width: 0, cellSize: 0 });

// --- 초기화 ---
onMounted(() => {
  startGameLogic();
  window.addEventListener('resize', updateBoardMetrics);
});

const updateBoardMetrics = () => {
  if (gameBoardRef.value) {
    const rect = gameBoardRef.value.getBoundingClientRect();
    boardMetrics.left = rect.left;
    boardMetrics.top = rect.top;
    boardMetrics.width = rect.width;
    boardMetrics.cellSize = rect.width / BOARD_SIZE; 
  }
};

const startGameLogic = async () => {
  if (!auth.currentUser) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }
  gameStatus.value = 'loading';
  try {
    await startGameFunc(); 
    initGame();
    gameStatus.value = 'playing';
    nextTick(() => updateBoardMetrics());
  } catch (error) {
    console.error(error);
    gameStatus.value = 'lost';
  }
};

const initGame = () => {
  board.fill(0);
  score.value = 0;
  alchemyDust.value = 0;
  spawnBlocks();
};

const spawnBlocks = () => {
  for (let i = 0; i < 3; i++) {
    const type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
    blocks.value[i] = { ...BLOCK_DEFINITIONS[type], uid: Date.now() + i };
  }
  checkGameOver();
};

// --- 드래그 핸들러 ---
const handleDragStart = (e, block, index) => {
  if (gameStatus.value !== 'playing') return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  isDragging.value = true;
  dragged.block = block;
  dragged.index = index;
  pointerPosition.x = clientX;
  pointerPosition.y = clientY;

  updateBoardMetrics();
};

const handleDragMove = (e) => {
  if (!isDragging.value || !dragged.block) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  pointerPosition.x = clientX;
  pointerPosition.y = clientY;

  const visualX = clientX;
  const visualY = clientY - TOUCH_OFFSET_Y;

  const relX = visualX - boardMetrics.left;
  const relY = visualY - boardMetrics.top;

  const colIndex = Math.floor((relX / boardMetrics.width) * BOARD_SIZE);
  const rowIndex = Math.floor((relY / boardMetrics.width) * BOARD_SIZE);

  if (rowIndex >= 0 && rowIndex < BOARD_SIZE && colIndex >= 0 && colIndex < BOARD_SIZE) {
    const blockRows = dragged.block.shape.length;
    const blockCols = dragged.block.shape[0].length;
    const adjustedRow = rowIndex - Math.floor(blockRows / 2);
    const adjustedCol = colIndex - Math.floor(blockCols / 2);

    if (canPlace(dragged.block, adjustedRow, adjustedCol)) {
      previewCells.value = getPlacementCells(dragged.block, adjustedRow, adjustedCol);
      invalidDrop.value = false;
    } else {
      previewCells.value = getPlacementCells(dragged.block, adjustedRow, adjustedCol, true); 
      invalidDrop.value = true;
    }
  } else {
    previewCells.value = [];
    invalidDrop.value = false;
  }
};

const handleDragEnd = () => {
  if (!isDragging.value) return;

  if (!invalidDrop.value && previewCells.value.length > 0) {
    previewCells.value.forEach(idx => {
      if (idx >= 0 && idx < board.length) board[idx] = 1;
    });

    const cellsCount = dragged.block.shape.flat().filter(x => x).length;
    score.value += cellsCount;

    checkLines();

    blocks.value[dragged.index] = { uid: null, shape: null };
    if (blocks.value.every(b => !b.shape)) {
      spawnBlocks();
    } else {
      checkGameOver();
    }
  }

  isDragging.value = false;
  dragged.block = null;
  dragged.index = -1;
  previewCells.value = [];
  invalidDrop.value = false;
};

// --- 게임 로직 헬퍼 ---
const canPlace = (block, r, c) => {
  const shape = block.shape;
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j] === 1) {
        const nr = r + i;
        const nc = c + j;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr * BOARD_SIZE + nc] === 1) {
          return false;
        }
      }
    }
  }
  return true;
};

const getPlacementCells = (block, r, c, ignoreCollision = false) => {
  const cells = [];
  const shape = block.shape;
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j] === 1) {
        const nr = r + i;
        const nc = c + j;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          cells.push(nr * BOARD_SIZE + nc);
        } else if (!ignoreCollision) {
            return []; 
        }
      }
    }
  }
  return cells;
};

const checkLines = () => {
  let lines = 0;
  const rowsToClear = [];
  const colsToClear = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r * BOARD_SIZE + c] === 0) { full = false; break; }
    }
    if (full) rowsToClear.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r * BOARD_SIZE + c] === 0) { full = false; break; }
    }
    if (full) colsToClear.push(c);
  }

  const allIndices = new Set();
  rowsToClear.forEach(r => { for(let c=0; c<BOARD_SIZE; c++) allIndices.add(r*BOARD_SIZE + c); });
  colsToClear.forEach(c => { for(let r=0; r<BOARD_SIZE; r++) allIndices.add(r*BOARD_SIZE + c); });

  if (allIndices.size > 0) {
    clearingCells.value = Array.from(allIndices);
    lines = rowsToClear.length + colsToClear.length;
    const points = COMBO_SCORES[lines] || (lines * 100);
    const dust = lines >= 2 ? lines : 0;
    
    score.value += points;
    alchemyDust.value += dust;
    
    if (lines >= 2) {
      comboMessage.value = `${lines} 콤보! +${points}`;
      setTimeout(() => comboMessage.value = '', 1500);
    }

    setTimeout(() => {
      clearingCells.value.forEach(idx => board[idx] = 0);
      clearingCells.value = [];
    }, 300);
  }
};

const checkGameOver = () => {
  const availableBlocks = blocks.value.filter(b => b.shape);
  if (availableBlocks.length === 0) return;

  let canMove = false;
  for (const block of availableBlocks) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlace(block, r, c)) {
          canMove = true;
          break;
        }
      }
      if (canMove) break;
    }
    if (canMove) break;
  }

  if (!canMove) handleGameOverProcess();
};

const handleGameOverProcess = async () => {
  gameStatus.value = 'lost';
  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('blockPuzzleHighScore', score.value);
  }
  try {
    const res = await endGameFunc({ score: score.value, alchemyDust: alchemyDust.value });
    finalPointsAwarded.value = res.data.awardedPoints;
  } catch (e) { console.error(e); }
};

const restartGame = () => { startGameLogic(); };
const goToDashboard = () => router.push('/dashboard');

// --- 스타일 헬퍼 ---
const getBlockGridStyle = (block) => {
  if (!block || !block.shape) return {};
  const rows = block.shape.length;
  const cols = block.shape[0].length;
  return {
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    width: `${cols * 22}px`, 
    gap: '2px'
  };
};

const floatingBlockStyle = computed(() => {
  return {
    position: 'fixed',
    left: `${pointerPosition.x}px`,
    top: `${pointerPosition.y - TOUCH_OFFSET_Y}px`,
    transform: 'translate(-50%, -50%) scale(1.2)', 
    pointerEvents: 'none',
    zIndex: 9999
  };
});
</script>

<style scoped>
/* 페이지 기본 설정: 100dvh로 화면 꽉 채움, 스크롤 방지 */
.block-puzzle-page {
  display: flex;
  flex-direction: column;
  height: 100dvh; /* Dynamic Viewport Height */
  width: 100vw;
  background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
  /* [수정] 상단 패딩 최소화 */
  padding-top: env(safe-area-inset-top, 5px); 
  padding-bottom: env(safe-area-inset-bottom, 5px);
  box-sizing: border-box;
  overflow: hidden; /* 전체 스크롤 방지 */
  touch-action: none;
  font-family: 'Noto Sans KR', sans-serif;
  color: white;
  
  /* [핵심] 콘텐츠를 수직 중앙 정렬하되, 위아래 여백을 자동으로 배분 */
  justify-content: center;
  align-items: center;
  gap: 15px; /* 요소 사이 간격 */
}

/* 1. 상단 스탯 영역 */
.game-header-area {
  flex-shrink: 0; 
  display: flex;
  justify-content: space-around;
  width: 95%;
  max-width: 450px;
  /* 마진 제거 (gap으로 제어) */
  margin: 0; 
  gap: 8px;
}

.stat-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  border-radius: 10px;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.stat-card.main-score {
  background: rgba(0, 0, 0, 0.3);
  border-color: rgba(0, 255, 255, 0.3);
  transform: scale(1.05);
}

.label { font-size: 0.7rem; color: #ccc; margin-bottom: 2px; }
.value { font-size: 1rem; font-weight: bold; white-space: nowrap; }
.gold { color: #ffd700; }
.cyan { color: #00ffff; text-shadow: 0 0 5px rgba(0,255,255,0.5); }
.white { color: #fff; }

/* 2. 게임 보드 컨테이너 */
.game-board-container {
  /* [핵심] flex-grow를 제거하여 하단 블록을 밀어내지 않게 함 */
  flex: 0 1 auto; 
  
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  position: relative;
  overflow: visible; /* 그림자 등 잘림 방지 */
  padding: 0 10px;
  box-sizing: border-box;
}

/* 보드 비율 유지 박스 */
.board-aspect-ratio-box {
  width: 100%;
  max-width: 450px;
  aspect-ratio: 1 / 1; 
  
  /* [핵심] 높이를 50vh로 제한하여 PC/모바일 모두 하단 공간 확보 */
  max-height: 50vh; 
  
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  padding: 6px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
  position: relative;
  box-sizing: border-box;
}

/* 실제 그리드 */
.game-board {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  grid-template-rows: repeat(10, 1fr);
  gap: 2px;
  width: 100%;
  height: 100%;
}

.game-cell {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  transition: background-color 0.1s;
}
.game-cell.filled {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  box-shadow: inset 0 0 5px rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.2);
}
.game-cell.preview {
  background: rgba(255, 255, 255, 0.3);
  border: 1px dashed rgba(255,255,255,0.5);
}
.game-cell.invalid {
  background: rgba(255, 80, 80, 0.4) !important;
}
.game-cell.clearing {
  animation: flash 0.3s forwards;
}
@keyframes flash {
  0% { background: #fff; transform: scale(1); }
  100% { background: transparent; transform: scale(0); }
}

.combo-popup {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.85);
  color: #ffd700;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 1.5rem;
  font-weight: bold;
  border: 2px solid #ffd700;
  z-index: 20;
  pointer-events: none;
  white-space: nowrap;
}
.pop-enter-active { animation: popAnim 0.4s ease-out; }
@keyframes popAnim {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

/* 3. 하단 블록 스포너 (위로 올림) */
.block-spawner-area {
  flex-shrink: 0;
  /* [수정] 높이 축소 (120px -> 100px) */
  height: 100px;
  width: 100%;
  max-width: 450px; /* 보드와 너비 맞춤 */
  display: flex;
  justify-content: center;
  align-items: center;
  /* [수정] 배경/테두리 제거하여 보드와 일체감 형성 */
  background: transparent;
  border: none;
  padding-bottom: 0;
}

.block-spawner {
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  height: 100%;
  /* [수정] 살짝 어두운 배경 추가로 영역 구분 */
  background: rgba(0,0,0,0.2);
  border-radius: 15px;
}

.spawn-slot {
  width: 30%;
  height: 80%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.spawn-slot.is-dragging { opacity: 0.3; }

.block-preview, .block-shape {
  display: grid;
  gap: 2px;
}
.block-cell {
  width: 20px;
  height: 20px;
  border-radius: 2px;
  background: transparent;
}
.block-cell.filled {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.block-cell.filled.invalid {
  background: #ff4b4b; 
}

.floating-block-container {
  pointer-events: none;
  z-index: 9999;
}

.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.85); z-index: 1000;
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(4px);
}
.glass-panel {
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 30px; border-radius: 20px; width: 85%; max-width: 320px;
  text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
}
.game-over-title { color: #ff4b4b; font-size: 2rem; margin: 0 0 20px; text-shadow: 0 0 10px rgba(255,0,0,0.5); }
.result-stats { display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px; }
.result-row { display: flex; justify-content: space-between; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; }
.result-row.highlight { font-size: 1.3rem; color: #ffd700; border: none; margin-top: 5px; }

.modal-actions { display: flex; gap: 10px; }
.btn-restart, .btn-exit {
  flex: 1; padding: 12px; border: none; border-radius: 10px;
  font-weight: bold; font-size: 1rem; cursor: pointer;
}
.btn-restart { background: linear-gradient(90deg, #00c6ff, #0072ff); color: white; box-shadow: 0 4px 15px rgba(0,114,255,0.4); }
.btn-exit { background: #444; color: #ccc; }

.loading-text { color: #00c6ff; font-size: 1.2rem; }
</style>
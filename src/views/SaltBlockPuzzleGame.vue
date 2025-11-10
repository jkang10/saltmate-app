<template>
  <div class="block-puzzle-page">
    <div class="game-stats-glass">
      <div class="stat-item">
        <span>최고 점수</span>
        <strong>{{ highScore }}</strong>
      </div>
      <div class="stat-item">
        <span>현재 점수</span>
        <strong>{{ score }}</strong>
      </div>
      <div class="stat-item">
        <span>연금술 가루</span>
        <strong>{{ alchemyDust }} 💎</strong>
      </div>
    </div>

    <div class="game-area-wrapper">
      
      <div 
        class="game-board"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <div
          v-for="(cell, index) in board.flat()"
          :key="index"
          class="game-cell"
          :class="{ 
            'filled': cell === 1,
            'preview': previewCells.includes(index),
            'invalid': invalidDrop
          }"
          :data-index="index"
        ></div>
      </div>

      <div v-if="comboMessage" class="combo-popup">
        {{ comboMessage }}
      </div>

    </div>

    <div class="block-spawner">
      <div
        v-for="(block, index) in blocks"
        :key="block.id"
        class="block-preview-wrapper"
        :class="{ 'is-empty': !block.shape }"
        :draggable="!!block.shape"
        @dragstart="handleDragStart($event, block, index)"
      >
        <div v-if="block.shape" class="block-preview" :style="getBlockGridStyle(block)">
          <div
            v-for="(cell, cIndex) in block.shape.flat()"
            :key="cIndex"
            class="block-cell"
            :class="{ 'filled': cell === 1 }"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="gameStatus !== 'playing'" class="modal-overlay">
      <div class="modal-content">
        <h2 v-if="gameStatus === 'loading'">게임 준비 중...</h2>
        <h2 v-if="gameStatus === 'lost'">게임 오버</h2>
        <p v-if="gameStatus === 'lost'">
          최종 점수: {{ score }}<br />
          획득한 가루: {{ alchemyDust }} 💎<br />
          <strong>획득한 SaltMate: {{ finalPointsAwarded }} P</strong>
        </p>
        <div v-if="gameStatus === 'loading'" class="loading-spinner"></div>
        <button v-if="gameStatus === 'lost'" @click="restartGame" class="btn-primary">
          다시하기
        </button>
        <button v-if="gameStatus === 'lost'" @click="goToDashboard" class="btn-secondary">
          대시보드로 나가기
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { functions, auth } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- Firebase 연동 ---
// [★핵심★] 이전 단계에서 index.js에 추가한 새 함수들을 호출합니다.
const startGameFunc = httpsCallable(functions, 'startBlockPuzzleGame');
const endGameFunc = httpsCallable(functions, 'endBlockPuzzleGame');
const router = useRouter();

// --- 게임 기본 상수 ---
const BOARD_SIZE = 10;
const COMBO_SCORES = { 1: 100, 2: 400, 3: 900, 4: 1600, 5: 2500, 6: 3600 };
const COMBO_DUST = { 1: 0, 2: 1, 3: 3, 4: 5, 5: 10, 6: 15 };

// --- 블록 정의 (1010! 표준 세트) ---
const BLOCK_DEFINITIONS = {
  // 1x1
  '1x1': { shape: [[1]], id: '1x1' },
  // 1x2, 2x1
  '1x2': { shape: [[1, 1]], id: '1x2' },
  '2x1': { shape: [[1], [1]], id: '2x1' },
  // 1x3, 3x1
  '1x3': { shape: [[1, 1, 1]], id: '1x3' },
  '3x1': { shape: [[1], [1], [1]], id: '3x1' },
  // 1x4, 4x1
  '1x4': { shape: [[1, 1, 1, 1]], id: '1x4' },
  '4x1': { shape: [[1], [1], [1], [1]], id: '4x1' },
  // 1x5, 5x1
  '1x5': { shape: [[1, 1, 1, 1, 1]], id: '1x5' },
  '5x1': { shape: [[1], [1], [1], [1], [1]], id: '5x1' },
  // 2x2
  '2x2': { shape: [[1, 1], [1, 1]], id: '2x2' },
  // 3x3
  '3x3': { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], id: '3x3' },
  // L (4종류)
  'L1': { shape: [[1, 0], [1, 0], [1, 1]], id: 'L1' },
  'L2': { shape: [[1, 1, 1], [1, 0, 0]], id: 'L2' },
  'L3': { shape: [[1, 1], [0, 1], [0, 1]], id: 'L3' },
  'L4': { shape: [[0, 0, 1], [1, 1, 1]], id: 'L4' },
};
const blockTypes = Object.keys(BLOCK_DEFINITIONS);

// --- Vue 반응형 게임 상태 ---
const gameStatus = ref('loading');
const board = reactive(Array(BOARD_SIZE * BOARD_SIZE).fill(0));
const blocks = ref([{id: null, shape: null}, {id: null, shape: null}, {id: null, shape: null}]);
const score = ref(0);
const highScore = ref(localStorage.getItem('blockPuzzleHighScore') || 0);
const alchemyDust = ref(0);
const comboMessage = ref('');
const finalPointsAwarded = ref(0);

// --- 드래그앤드롭 상태 ---
const dragged = reactive({ block: null, index: -1 });
const previewCells = ref([]);
const invalidDrop = ref(false);

// --- 1. 게임 시작 및 재시작 ---
const startGameLogic = async () => {
  if (!auth.currentUser) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }
  gameStatus.value = 'loading';
  try {
    await startGameFunc(); //
    initGame();
    gameStatus.value = 'playing';
  } catch (error) {
    console.error("게임 시작 오류:", error);
    alert(`게임 시작 실패: ${error.message}`);
    gameStatus.value = 'lost';
  }
};

const initGame = () => {
  board.fill(0);
  score.value = 0;
  alchemyDust.value = 0;
  finalPointsAwarded.value = 0;
  spawnBlocks();
};

const restartGame = () => {
  cleanupGame();
  startGameLogic();
};

const cleanupGame = () => {
  // (Matter.js가 없으므로 정리가 간단함)
};

const goToDashboard = () => {
  router.push('/dashboard');
};

// --- 2. 블록 스폰 및 게임 오버 로직 ---
const spawnBlocks = () => {
  let allSlotsEmpty = true;
  for (let i = 0; i < 3; i++) {
    if (blocks.value[i].shape) {
      allSlotsEmpty = false;
      break;
    }
  }
  
  if (allSlotsEmpty) {
    for (let i = 0; i < 3; i++) {
      const randomType = blockTypes[Math.floor(Math.random() * blockTypes.length)];
      blocks.value[i] = { ...BLOCK_DEFINITIONS[randomType], uid: Date.now() + i };
    }
  }
  
  // [★핵심★] 게임 오버 체크
  if (!canAnyBlockBePlaced()) {
    handleGameOver();
  }
};

const canAnyBlockBePlaced = () => {
  for (const block of blocks.value) {
    if (!block.shape) continue;
    // 100개의 모든 칸을 대상으로 놓을 수 있는지 검사
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlace(block, r, c)) {
          return true; // 놓을 수 있는 칸이 하나라도 있으면
        }
      }
    }
  }
  return false; // 3개 블록 모두 놓을 곳이 없음
};

// --- 3. 드래그앤드롭 핸들러 ---
const handleDragStart = (e, block, index) => {
  dragged.block = block;
  dragged.index = index;
  e.dataTransfer.effectAllowed = 'move';
  // (드래그 시 반투명 이미지 제거 - 선택사항)
  const empty = document.createElement('div');
  e.dataTransfer.setDragImage(empty, 0, 0);
};

const handleDragOver = (e) => {
  e.preventDefault(); // 필수
  const targetIndex = e.target.dataset.index;
  if (targetIndex) {
    const r = Math.floor(targetIndex / BOARD_SIZE);
    const c = targetIndex % BOARD_SIZE;
    
    if (canPlace(dragged.block, r, c)) {
      previewCells.value = getPlacementCells(dragged.block, r, c);
      invalidDrop.value = false;
    } else {
      previewCells.value = [];
      invalidDrop.value = true;
    }
  }
};

const handleDragLeave = () => {
  previewCells.value = [];
  invalidDrop.value = false;
};

const handleDrop = (e) => {
  e.preventDefault();
  const targetIndex = e.target.dataset.index;
  if (!targetIndex || !dragged.block) return;

  const r = Math.floor(targetIndex / BOARD_SIZE);
  const c = targetIndex % BOARD_SIZE;

  if (canPlace(dragged.block, r, c)) {
    // 1. 블록 놓기
    placeBlock(dragged.block, r, c);
    // 2. 블록 놓기 점수 추가
    const cellsPlaced = dragged.block.shape.flat().filter(c => c === 1).length;
    score.value += cellsPlaced;
    
    // 3. 줄 제거 및 콤보 점수
    const linesCleared = clearLines();
    if (linesCleared > 0) {
      updateScore(linesCleared);
    }
    
    // 4. 사용한 블록 제거
    blocks.value[dragged.index] = { id: null, shape: null };
    
    // 5. 다음 턴 (블록 스폰 또는 게임 오버 체크)
    spawnBlocks();
  }
  
  // 드래그 상태 초기화
  previewCells.value = [];
  invalidDrop.value = false;
  dragged.block = null;
  dragged.index = -1;
};

// --- 4. 핵심 게임 로직 (CanPlace, Place, Clear) ---
const canPlace = (block, r, c) => {
  const shape = block.shape;
  for (let dr = 0; dr < shape.length; dr++) {
    for (let dc = 0; dc < shape[dr].length; dc++) {
      if (shape[dr][dc] === 1) {
        const nr = r + dr;
        const nc = c + dc;
        // 1. 보드 밖으로 나가는가?
        if (nr >= BOARD_SIZE || nc >= BOARD_SIZE) return false;
        // 2. 다른 블록과 겹치는가?
        if (board[nr * BOARD_SIZE + nc] === 1) return false;
      }
    }
  }
  return true;
};

const getPlacementCells = (block, r, c) => {
  const cells = [];
  const shape = block.shape;
  for (let dr = 0; dr < shape.length; dr++) {
    for (let dc = 0; dc < shape[dr].length; dc++) {
      if (shape[dr][dc] === 1) {
        cells.push((r + dr) * BOARD_SIZE + (c + dc));
      }
    }
  }
  return cells;
};

const placeBlock = (block, r, c) => {
  const shape = block.shape;
  for (let dr = 0; dr < shape.length; dr++) {
    for (let dc = 0; dc < shape[dr].length; dc++) {
      if (shape[dr][dc] === 1) {
        board[(r + dr) * BOARD_SIZE + (c + dc)] = 1;
      }
    }
  }
};

const clearLines = () => {
  let linesToClear = [];
  // 가로줄 검사
  for (let r = 0; r < BOARD_SIZE; r++) {
    let isRowFull = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r * BOARD_SIZE + c] === 0) {
        isRowFull = false;
        break;
      }
    }
    if (isRowFull) linesToClear.push(...Array(BOARD_SIZE).fill(0).map((_, i) => r * BOARD_SIZE + i));
  }
  
  // 세로줄 검사
  for (let c = 0; c < BOARD_SIZE; c++) {
    let isColFull = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r * BOARD_SIZE + c] === 0) {
        isColFull = false;
        break;
      }
    }
    if (isColFull) linesToClear.push(...Array(BOARD_SIZE).fill(0).map((_, i) => i * BOARD_SIZE + c));
  }
  
  const uniqueCells = [...new Set(linesToClear)];
  if (uniqueCells.length === 0) return 0;
  
  // 실제 줄 수 계산 (10칸=1줄, 20칸=2줄, 19칸=2줄...?) -> 10x10이므로 19칸은 2줄이 맞음.
  const linesCleared = Math.floor(uniqueCells.length / BOARD_SIZE) + (uniqueCells.length % BOARD_SIZE > 0 ? 1 : 0);
  
  // 셀 비우기
  uniqueCells.forEach(index => {
    board[index] = 0;
  });
  
  return linesCleared;
};

// --- 5. 보상 및 게임 오버 처리 ---
const updateScore = (linesCleared) => {
  const points = COMBO_SCORES[linesCleared] || COMBO_SCORES[6];
  const dust = COMBO_DUST[linesCleared] || COMBO_DUST[6];
  
  score.value += points;
  alchemyDust.value += dust;

  // 콤보 메시지 표시
  if (linesCleared >= 2) {
    const messages = { 2: "더블!", 3: "트리플!", 4: "쿼드!!", 5: "펜타!!!", 6: "퍼펙트!!!" };
    comboMessage.value = `${messages[linesCleared]} +${points}점` + (dust > 0 ? ` / +${dust} 가루💎` : '');
    setTimeout(() => { comboMessage.value = ''; }, 1500);
  }
};

const handleGameOver = async () => {
  if (gameStatus.value !== 'playing') return;
  gameStatus.value = 'lost';

  // 최고 점수 갱신
  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('blockPuzzleHighScore', score.value);
  }

  // 백엔드에 결과 전송
  try {
    const result = await endGameFunc({ 
      score: score.value,
      alchemyDust: alchemyDust.value 
    });
    // [★핵심★] 백엔드가 계산해준 최종 지급액을 모달에 표시
    finalPointsAwarded.value = result.data.awardedPoints || 0;
  } catch (error) {
    console.error("게임 결과 전송 실패:", error);
  }
};

// --- 6. 기타 헬퍼 ---
const getBlockGridStyle = (block) => {
  const shape = block.shape;
  return {
    gridTemplateRows: `repeat(${shape.length}, 1fr)`,
    gridTemplateColumns: `repeat(${shape[0].length}, 1fr)`,
  };
};

// --- 7. 생명주기 ---
onMounted(() => {
  startGameLogic();
});
</script>

<style scoped>
/* 페이지 기본 */
.block-puzzle-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background-color: #1a1a2e; /* 어두운 배경 */
  min-height: 100dvh;
  box-sizing: border-box;
}

/* 상단 스탯바 (솔트 알케미와 동일) */
.game-stats-glass {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  max-width: 380px;
  padding: 10px 20px;
  background: rgba(44, 62, 80, 0.8);
  color: white;
  border-radius: 12px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 10px;
}
.stat-item { text-align: center; }
.stat-item span { font-size: 0.8rem; color: #bdc3c7; }
.stat-item strong { font-size: 1.2rem; color: #ffffff; }

/* 게임 영역 */
.game-area-wrapper {
  position: relative;
  /* (30px * 10) + (4px * 10) + (2px * 2) = 344px */
  width: 344px;
  margin-bottom: 20px;
}

/* 10x10 보드 */
.game-board {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  grid-template-rows: repeat(10, 1fr);
  gap: 4px;
  background-color: #34495e; /* 어두운 그리드 배경 */
  border: 2px solid #2c3e50;
  border-radius: 8px;
  padding: 4px;
}

.game-cell {
  width: 30px;
  height: 30px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  transition: all 0.1s ease;
}

/* 채워진 셀 (소금 결정 테마) */
.game-cell.filled {
  background-color: #3498db;
  border: 1px solid #85c1e9;
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.5);
}

/* 드래그 미리보기 */
.game-cell.preview {
  background-color: rgba(46, 204, 113, 0.5); /* 초록색 미리보기 */
}
.game-cell.invalid {
  background-color: rgba(231, 76, 60, 0.5); /* 빨간색 (놓을 수 없음) */
}

/* 콤보 알림 */
.combo-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(241, 196, 15, 0.9);
  color: #2c3e50;
  padding: 15px 30px;
  border-radius: 10px;
  font-size: 1.5rem;
  font-weight: bold;
  z-index: 100;
  animation: fadeOut 1.5s ease forwards;
}
@keyframes fadeOut {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -100%) scale(0.9); }
}

/* 하단 블록 스포너 */
.block-spawner {
  display: flex;
  justify-content: space-around;
  align-items: center;
  width: 100%;
  max-width: 380px;
  height: 120px;
  background: rgba(44, 62, 80, 0.8);
  border-radius: 12px;
  padding: 10px;
  box-sizing: border-box;
}

.block-preview-wrapper {
  width: 100px;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: grab;
}
.block-preview-wrapper.is-empty {
  cursor: default;
}
.block-preview-wrapper:active {
  cursor: grabbing;
}

.block-preview {
  display: grid;
  gap: 3px;
}

.block-cell {
  width: 20px;
  height: 20px;
  background-color: transparent;
  border-radius: 2px;
}
.block-cell.filled {
  background-color: #3498db;
  border: 1px solid #85c1e9;
}

/* 모달 (솔트 알케미와 동일) */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center; z-index: 200;
}
.modal-content {
  background: white; padding: 30px; border-radius: 12px;
  text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.modal-content p {
  font-size: 1.2rem;
  line-height: 1.6;
}
.btn-primary {
  background-color: #007bff; color: white; padding: 12px 25px;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1.1rem; font-weight: bold; margin-top: 10px;
  transition: background-color 0.2s ease; width: 100%; box-sizing: border-box;
}
.btn-primary:hover { background-color: #0056b3; }

.btn-secondary {
  background-color: #6c757d; color: white; padding: 12px 25px;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1.1rem; font-weight: bold; margin-top: 10px;
  transition: background-color 0.2s ease; width: 100%; box-sizing: border-box;
}
.btn-secondary:hover { background-color: #5a6268; }

.loading-spinner {
  display: inline-block; border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff; border-radius: 50%;
  width: 40px; height: 40px; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
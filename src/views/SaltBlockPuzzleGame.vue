<template>
  <div 
    class="block-puzzle-page"
    @mouseup="handleDragEnd"
    @mouseleave="handleDragEnd"
    @touchend="handleDragEnd"
    @mousemove.prevent="handleDragMove"
    @touchmove.prevent="handleDragMove"
  >
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
        ref="gameBoardRef"
      >
        <div
          v-for="(cell, index) in board.flat()"
          :key="index"
          class="game-cell"
          :class="{ 
            'filled': cell === 1,
            'preview': previewCells.includes(index),
            'invalid': invalidDrop,
            'clearing': clearingCells.includes(index) /* [★수정★] 애니메이션 클래스 추가 */
          }"
          :data-index="index"
        ></div>
      </div>

      <div v-if="comboMessage" class="combo-popup">
        {{ comboMessage }}
      </div>

      <div 
        v-if="dragged.block && isDragging" 
        class="block-preview floating-block" 
        :style="floatingBlockStyle"
      >
        <div
          v-for="(cell, cIndex) in dragged.block.shape.flat()"
          :key="cIndex"
          class="block-cell"
          :class="{ 'filled': cell === 1 }"
        ></div>
      </div>
      </div>

    <div class="block-spawner">
      <div
        v-for="(block, index) in blocks"
        :key="block.uid"
        class="block-preview-wrapper"
        :class="{ 'is-empty': !block.shape, 'is-dragging': isDragging && dragged.index === index }"
      >
        <div 
          v-if="block.shape" 
          class="block-preview" 
          :style="getBlockGridStyle(block)"
        >
          <div
            v-for="(cell, cIndex) in block.shape.flat()"
            :key="cIndex"
            class="block-cell"
            :class="{ 'filled': cell === 1 }"
            :data-cindex="cIndex"
            
            @mousedown.prevent="handleDragStart($event, block, index, cIndex)"
            @touchstart.prevent="handleDragStart($event, block, index, cIndex)"
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
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { functions, auth } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- Firebase 연동 ---
const startGameFunc = httpsCallable(functions, 'startBlockPuzzleGame');
const endGameFunc = httpsCallable(functions, 'endBlockPuzzleGame');
const router = useRouter();

// --- 게임 기본 상수 ---
const BOARD_SIZE = 10;
const COMBO_SCORES = { 1: 100, 2: 400, 3: 900, 4: 1600, 5: 2500, 6: 3600 };
const COMBO_DUST = { 1: 0, 2: 1, 3: 3, 4: 5, 5: 10, 6: 15 };
const CELL_SIZE = 30; // .game-cell width
const CELL_GAP = 4;   // .game-board gap
const BOARD_PADDING = 4; // .game-board padding

// --- 블록 정의 (1010! 표준 세트) ---
const BLOCK_DEFINITIONS = {
  '1x1': { shape: [[1]], id: '1x1' },
  '1x2': { shape: [[1, 1]], id: '1x2' },
  '2x1': { shape: [[1], [1]], id: '2x1' },
  '1x3': { shape: [[1, 1, 1]], id: '1x3' },
  '3x1': { shape: [[1], [1], [1]], id: '3x1' },
  '1x4': { shape: [[1, 1, 1, 1]], id: '1x4' },
  '4x1': { shape: [[1], [1], [1], [1]], id: '4x1' },
  '1x5': { shape: [[1, 1, 1, 1, 1]], id: '1x5' },
  '5x1': { shape: [[1], [1], [1], [1], [1]], id: '5x1' },
  '2x2': { shape: [[1, 1], [1, 1]], id: '2x2' },
  '3x3': { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], id: '3x3' },
  'L1': { shape: [[1, 0], [1, 0], [1, 1]], id: 'L1' },
  'L2': { shape: [[1, 1, 1], [1, 0, 0]], id: 'L2' },
  'L3': { shape: [[1, 1], [0, 1], [0, 1]], id: 'L3' },
  'L4': { shape: [[0, 0, 1], [1, 1, 1]], id: 'L4' },
};
const blockTypes = Object.keys(BLOCK_DEFINITIONS);

// --- Vue 반응형 게임 상태 ---
const gameStatus = ref('loading');
const board = reactive(Array(BOARD_SIZE * BOARD_SIZE).fill(0));
const blocks = ref([{uid: null, shape: null}, {uid: null, shape: null}, {uid: null, shape: null}]);
const score = ref(0);
const highScore = ref(localStorage.getItem('blockPuzzleHighScore') || 0);
const alchemyDust = ref(0);
const comboMessage = ref('');
const finalPointsAwarded = ref(0);
const gameBoardRef = ref(null); 

// --- [★수정★] 애니메이션 상태 추가 ---
const clearingCells = ref([]); // 애니메이션 중인 셀
const isClearing = ref(false); // 애니메이션/로직 처리 중 입력 방지

// --- 드래그앤드롭 상태 ---
const isDragging = ref(false); 
const dragged = reactive({ block: null, index: -1, offset: { dr: 0, dc: 0 } });
const previewCells = ref([]);
const invalidDrop = ref(false);
const pointerPosition = reactive({ x: 0, y: 0 }); 
const blockStartPos = reactive({ x: 0, y: 0 }); 

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

const cleanupGame = () => {};

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
  
  if (!canAnyBlockBePlaced()) {
    handleGameOver();
  }
};

const canAnyBlockBePlaced = () => {
  for (const block of blocks.value) {
    if (!block.shape) continue;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (canPlace(block, r, c)) {
          return true;
        }
      }
    }
  }
  return false;
};

// --- 3. [★핵심 수정★] 커스텀 드래그앤드롭 핸들러 ---

const handleDragStart = (e, block, index, cIndex) => {
  if (isClearing.value) return; // [★수정★] 애니메이션 중 입력 방지

  if (cIndex === undefined && e.target) {
    const targetCell = e.target.closest('.block-cell');
    cIndex = Number(targetCell?.dataset.cindex || 0);
  }
  
  // 0, 0 칸을 클릭해도 cIndex가 0이 되어야 함
  cIndex = cIndex || 0; 

  isDragging.value = true;
  dragged.block = block;
  dragged.index = index;

  const shapeWidth = block.shape[0].length;
  dragged.offset.dr = Math.floor(cIndex / shapeWidth);
  dragged.offset.dc = cIndex % shapeWidth;
  
  const pos = (e.touches ? e.touches[0] : e);
  pointerPosition.x = pos.clientX;
  pointerPosition.y = pos.clientY;
  
  const blockRect = e.target.closest('.block-preview').getBoundingClientRect();
  blockStartPos.x = blockRect.left;
  blockStartPos.y = blockRect.top;
};

const handleDragMove = (e) => {
  if (!isDragging.value || !dragged.block) return;

  const pos = (e.touches ? e.touches[0] : e);
  pointerPosition.x = pos.clientX;
  pointerPosition.y = pos.clientY;

  // ▼▼▼ [★핵심 수정★] elementFromPoint 대신 수학적 계산으로 변경 (붉은색 오류 해결) ▼▼▼
  const boardRect = gameBoardRef.value.getBoundingClientRect();
  
  // 1. 보드 내부의 상대 좌표 계산 (보드 패딩 4px 보정)
  const relX = pointerPosition.x - boardRect.left - BOARD_PADDING;
  const relY = pointerPosition.y - boardRect.top - BOARD_PADDING;
  
  // 2. 셀 + 갭 크기로 나누어 현재 그리드 (r, c) 계산
  const cellPlusGap = CELL_SIZE + CELL_GAP;
  const target_c = Math.floor(relX / cellPlusGap);
  const target_r = Math.floor(relY / cellPlusGap);

  // 3. 보드 범위(0~9) 내에 있는지 확인
  if (target_r >= 0 && target_r < BOARD_SIZE && target_c >= 0 && target_c < BOARD_SIZE) {
    // 4. Offset 보정 및 유효성 검사
    const place_r = target_r - dragged.offset.dr;
    const place_c = target_c - dragged.offset.dc;

    if (canPlace(dragged.block, place_r, place_c)) {
      previewCells.value = getPlacementCells(dragged.block, place_r, place_c);
      invalidDrop.value = false;
    } else {
      previewCells.value = [];
      invalidDrop.value = true;
    }
  } else {
    // 포인터가 보드 밖으로 나감
    previewCells.value = [];
    invalidDrop.value = false;
  }
  // ▲▲▲ (수정 완료) ▲▲▲
};

const handleDragEnd = () => {
  if (!isDragging.value || !dragged.block) return;
  
  let isValidDrop = false;
  let place_r = 0;
  let place_c = 0;

  // ▼▼▼ [★핵심 수정★] handleDragMove와 동일한 수학적 계산으로 최종 위치 결정 ▼▼▼
  const boardRect = gameBoardRef.value.getBoundingClientRect();
  const relX = pointerPosition.x - boardRect.left - BOARD_PADDING;
  const relY = pointerPosition.y - boardRect.top - BOARD_PADDING;
  const cellPlusGap = CELL_SIZE + CELL_GAP;
  const target_c = Math.floor(relX / cellPlusGap);
  const target_r = Math.floor(relY / cellPlusGap);

  if (target_r >= 0 && target_r < BOARD_SIZE && target_c >= 0 && target_c < BOARD_SIZE) {
    place_r = target_r - dragged.offset.dr;
    place_c = target_c - dragged.offset.dc;
    
    if (canPlace(dragged.block, place_r, place_c)) {
      isValidDrop = true;
    }
  }
  // ▲▲▲ (수정 완료) ▲▲▲

  if (isValidDrop) {
    placeBlock(dragged.block, place_r, place_c);
    
    const cellsPlaced = dragged.block.shape.flat().filter(c => c === 1).length;
    score.value += cellsPlaced;
    
    // ▼▼▼ [★핵심 수정★] 애니메이션 로직 추가 ▼▼▼
    isClearing.value = true; // 입력 방지
    const linesToClear = getLinesToClear(); // 1. 지울 셀 목록만 가져옴
    
    if (linesToClear.cells.length > 0) {
      // 2. 애니메이션 클래스 적용
      clearingCells.value = linesToClear.cells;
      
      // 3. 콤보 메시지 (즉시 표시)
      updateScore(linesToClear.count);
      
      // 4. 애니메이션 시간 (300ms) 후 실제 데이터 처리
      setTimeout(() => {
        linesToClear.cells.forEach(index => { board[index] = 0; }); // 5. 데이터에서 삭제
        clearingCells.value = []; // 6. 애니메이션 클래스 제거
        isClearing.value = false; // 7. 입력 방지 해제
        spawnBlocks(); // 8. 다음 블록 스폰
      }, 300);
      
    } else {
      // 콤보 없음
      isClearing.value = false;
      spawnBlocks();
    }
    // ▲▲▲ (수정 완료) ▲▲▲
    
    blocks.value[dragged.index] = { uid: null, shape: null };
  }

  // 드래그 상태 완전 초기화
  isDragging.value = false;
  dragged.block = null;
  dragged.index = -1;
  dragged.offset = { dr: 0, dc: 0 };
  previewCells.value = [];
  invalidDrop.value = false;
};


// --- 4. 핵심 게임 로직 (CanPlace, Place, Clear) ---
const canPlace = (block, r, c) => {
  const shape = block.shape;
  for (let dr = 0; dr < shape.length; dr++) {
    for (let dc = 0; dc < shape[dr].length; dc++) {
      if (shape[dr][dc] === 1) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) return false;
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
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            cells.push(nr * BOARD_SIZE + nc);
        }
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

// ▼▼▼ [★핵심 수정★] clearLines -> getLinesToClear (데이터를 지우지 않고 반환) ▼▼▼
const getLinesToClear = () => {
  let fullRows = [];
  let fullCols = [];

  // 가로줄 검사
  for (let r = 0; r < BOARD_SIZE; r++) {
    let isRowFull = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r * BOARD_SIZE + c] === 0) {
        isRowFull = false;
        break;
      }
    }
    if (isRowFull) fullRows.push(r);
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
    if (isColFull) fullCols.push(c);
  }
  
  const cellsToClear = new Set();
  fullRows.forEach(r => {
    for (let c = 0; c < BOARD_SIZE; c++) cellsToClear.add(r * BOARD_SIZE + c);
  });
  fullCols.forEach(c => {
    for (let r = 0; r < BOARD_SIZE; r++) cellsToClear.add(r * BOARD_SIZE + c);
  });

  const linesCleared = fullRows.length + fullCols.length;
  
  // [★수정★] board[index] = 0 로직 제거
  
  return { cells: [...cellsToClear], count: linesCleared };
};
// ▲▲▲ (수정 완료) ▲▲▲

// --- 5. 보상 및 게임 오버 처리 ---
const updateScore = (linesCleared) => {
  const points = COMBO_SCORES[linesCleared] || COMBO_SCORES[6];
  const dust = COMBO_DUST[linesCleared] || COMBO_DUST[6];
  
  score.value += points;
  alchemyDust.value += dust;

  if (linesCleared >= 1) { // [★수정★] 1줄만 터져도 메시지 표시
    const messages = { 1: "싱글!", 2: "더블!", 3: "트리플!", 4: "쿼드!!", 5: "펜타!!!", 6: "퍼펙트!!!" };
    comboMessage.value = `${messages[linesCleared]} +${points}점` + (dust > 0 ? ` / +${dust} 가루💎` : '');
    setTimeout(() => { comboMessage.value = ''; }, 1500);
  }
};

const handleGameOver = async () => {
  if (gameStatus.value !== 'playing') return;
  gameStatus.value = 'lost';

  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('blockPuzzleHighScore', score.value);
  }

  try {
    const result = await endGameFunc({ 
      score: score.value,
      alchemyDust: alchemyDust.value 
    });
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

const floatingBlockStyle = computed(() => {
  if (!dragged.block) return {};
  
  const style = getBlockGridStyle(dragged.block);
  const cellWidth = 20 + 3; 
  const offsetX = dragged.offset.dc * cellWidth;
  const offsetY = dragged.offset.dr * cellWidth;
  
  return {
    ...style,
    position: 'fixed', 
    left: `${pointerPosition.x - offsetX - 10}px`, 
    top: `${pointerPosition.y - offsetY - 10}px`,
    zIndex: 1000,
    pointerEvents: 'none', 
    opacity: 0.8,
  };
});

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
  user-select: none;
  -webkit-user-select: none;
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
  position: relative;
  z-index: 10;
}

.game-cell {
  width: 30px;
  height: 30px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  transition: all 0.1s ease;
}
.game-cell.filled {
  background-color: #3498db;
  border: 1px solid #85c1e9;
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.5);
}
.game-cell.preview {
  background-color: rgba(46, 204, 113, 0.5);
}
.game-cell.invalid {
  background-color: rgba(231, 76, 60, 0.5);
}

/* ▼▼▼ [★핵심 추가★] 줄 제거 애니메이션 ▼▼▼ */
.game-cell.clearing {
  background-color: #f1c40f;
  border-color: #f39c12;
  box-shadow: 0 0 10px #f1c40f;
  animation: clearing-animation 0.3s ease-out;
}
@keyframes clearing-animation {
  0% { transform: scale(1.1); opacity: 1; }
  50% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}
/* ▲▲▲ (추가 완료) ▲▲▲ */


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

/* [★신규★] 드래그 중인 플로팅 블록 */
.floating-block {
  display: grid;
  gap: 3px;
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  opacity: 0.8;
}
.floating-block .block-cell.filled {
  background-color: #f1c40f; /* 드래그 시 노란색 */
  border: 1px solid #f39c12;
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
  transition: opacity 0.2s;
}
.block-preview-wrapper.is-empty {
  cursor: default;
}
/* [★신규★] 드래그 중인 원본 블록 숨기기 */
.block-preview-wrapper.is-dragging {
  opacity: 0.3;
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
  cursor: grab;
}
.block-cell.filled:active {
  cursor: grabbing;
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
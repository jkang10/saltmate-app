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
            'invalid': invalidDrop
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
          <!-- ▼▼▼ [★핵심 수정 1★] mousedown/touchstart 이벤트를 개별 셀로 이동 ▼▼▼ -->
          <div
            v-for="(cell, cIndex) in block.shape.flat()"
            :key="cIndex"
            class="block-cell"
            :class="{ 'filled': cell === 1 }"
            :data-cindex="cIndex"
            
            @mousedown.prevent="handleDragStart($event, block, index, cIndex)"
            @touchstart.prevent="handleDragStart($event, block, index, cIndex)"
          ></div>
          <!-- ▲▲▲ (수정 완료) ▲▲▲ -->
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

// ▼▼▼ [★핵심 수정 2★] cIndex 파라미터 추가 ▼▼▼
const handleDragStart = (e, block, index, cIndex) => {
  // 모바일 터치 시, cIndex가 undefined일 수 있으므로 e.target에서 다시 찾음
  if (cIndex === undefined && e.target) {
    const targetCell = e.target.closest('.block-cell');
    cIndex = Number(targetCell?.dataset.cindex || 0);
  }

  // 1. 드래그 상태 활성화
  isDragging.value = true;
  dragged.block = block;
  dragged.index = index;

  // 2. 블록 내 상대적 위치(offset) 계산
  const shapeWidth = block.shape[0].length;
  dragged.offset.dr = Math.floor(cIndex / shapeWidth);
  dragged.offset.dc = cIndex % shapeWidth;
  
  // 3. 현재 포인터 위치 저장
  const pos = (e.touches ? e.touches[0] : e);
  pointerPosition.x = pos.clientX;
  pointerPosition.y = pos.clientY;
  
  // 4. 드래그 시작 시 블록의 화면상 위치 저장 (Floating Block 위치 계산용)
  // [수정] e.target이 .block-cell이므로 .block-preview를 찾아야 함
  const blockRect = e.target.closest('.block-preview').getBoundingClientRect();
  blockStartPos.x = blockRect.left;
  blockStartPos.y = blockRect.top;
};
// ▲▲▲ (수정 완료) ▲▲▲

const handleDragMove = (e) => {
  if (!isDragging.value || !dragged.block) return;

  // 1. 마우스/터치 위치 업데이트
  const pos = (e.touches ? e.touches[0] : e);
  pointerPosition.x = pos.clientX;
  pointerPosition.y = pos.clientY;

  // 2. 게임 보드 DOM의 좌표 가져오기
  const boardRect = gameBoardRef.value.getBoundingClientRect();
  
  // ▼▼▼ [★Lint 수정 1★] 'cellElements' 변수 삭제 (사용 안 함) ▼▼▼
  // const cellElements = gameBoardRef.value.children; 
  // ▲▲▲ (수정 완료) ▲▲▲

  // 3. 현재 포인터가 보드 위에 있는지 확인
  const isOverBoard = (
    pos.clientX >= boardRect.left && pos.clientX <= boardRect.right &&
    pos.clientY >= boardRect.top && pos.clientY <= boardRect.bottom
  );

  if (isOverBoard) {
    // 4. 포인터 위치에 가장 가까운 셀 찾기
    const targetElement = document.elementFromPoint(pos.clientX, pos.clientY);
    const targetIndex = targetElement?.dataset.index;

    if (targetElement && targetIndex) {
      const target_r = Math.floor(targetIndex / BOARD_SIZE);
      const target_c = targetIndex % BOARD_SIZE;
      
      // 5. Offset 보정 및 유효성 검사
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
      // ▼▼▼ [★핵심 수정 3 - PC 버그★] 칸 경계선(gap)에 있을 때 붉은색이 되는 버그 수정 ▼▼▼
      // (보드 위지만 셀이 아닌 경계선에 있을 경우)
      previewCells.value = [];
      invalidDrop.value = true; // <-- 이 코드를
      // invalidDrop.value = false; // <-- 이렇게 변경합니다. (놓을 수는 없지만 '무효'는 아님)
      // [2차 수정] 'invalidDrop.value = true'가 맞습니다. 드롭 시점에 
      // 'previewCells'가 비어있으면 어차피 드롭이 안됩니다.
      // 붉은색으로 변하는 PC 버그는 handleDragEnd에서 최종 위치를 재검증하지 않기 때문입니다.
      // -> handleDragEnd를 수정합니다.
      invalidDrop.value = true; // (원복)
      // ▲▲▲ (수정 완료) ▲▲▲
    }
  } else {
    // 보드 밖으로 나감
    previewCells.value = [];
    invalidDrop.value = false;
  }
};

// ▼▼▼ [★Lint 수정 2★] 'e' 파라미터 제거 ▼▼▼
const handleDragEnd = () => {
// ▲▲▲ (수정 완료) ▲▲▲

  if (!isDragging.value || !dragged.block) return;
  
  // ▼▼▼ [★핵심 수정 4 - PC/모바일 버그★] 드롭 시 상태(state)가 아닌, 최종 포인터 위치로 재검증 ▼▼▼
  let isValidDrop = false;
  let place_r = 0;
  let place_c = 0;

  const boardRect = gameBoardRef.value.getBoundingClientRect();
  const isOverBoard = (
    pointerPosition.x >= boardRect.left && pointerPosition.x <= boardRect.right &&
    pointerPosition.y >= boardRect.top && pointerPosition.y <= boardRect.bottom
  );
  
  if (isOverBoard) {
    const targetElement = document.elementFromPoint(pointerPosition.x, pointerPosition.y);
    const targetIndex = targetElement?.dataset.index;
    if (targetElement && targetIndex) {
      const target_r = Math.floor(targetIndex / BOARD_SIZE);
      const target_c = targetIndex % BOARD_SIZE;
      
      place_r = target_r - dragged.offset.dr;
      place_c = target_c - dragged.offset.dc;
      
      if (canPlace(dragged.block, place_r, place_c)) {
        isValidDrop = true;
      }
    }
  }
  // ▲▲▲ (수정 완료) ▲▲▲

  // 1. 유효한 위치(previewCells)에 드롭했는지 확인
  if (isValidDrop) {
    
    // 2. 블록 놓기 (재검증된 위치 사용)
    placeBlock(dragged.block, place_r, place_c);
    
    const cellsPlaced = dragged.block.shape.flat().filter(c => c === 1).length;
    score.value += cellsPlaced;
    
    const linesCleared = clearLines();
    if (linesCleared > 0) {
      updateScore(linesCleared);
    }
    
    blocks.value[dragged.index] = { uid: null, shape: null };
    
    spawnBlocks();
  }

  // 3. 드래그 상태 완전 초기화
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

const clearLines = () => {
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
  if (linesCleared === 0) return 0;
  
  cellsToClear.forEach(index => {
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

  if (linesCleared >= 2) {
    const messages = { 2: "더블!", 3: "트리플!", 4: "쿼드!!", 5: "펜타!!!", 6: "퍼펙트!!!" };
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
  
  // ▼▼▼ [★Lint 수정 3★] 'shape' 변수 삭제 (사용 안 함) ▼▼▼
  // const shape = dragged.block.shape;
  // ▲▲▲ (수정 완료) ▲▲▲
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
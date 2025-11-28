<template>
  <div 
    class="block-puzzle-page"
    @mouseup="handleDragEnd"
    @touchend="handleDragEnd"
    @touchcancel="handleDragEnd"
    @mousemove.prevent="handleDragMove"
    @touchmove.prevent="handleDragMove"
  >
    <div class="game-header">
      <div class="stat-card">
        <span class="label">최고 점수</span>
        <span class="value gold">{{ highScore.toLocaleString() }}</span>
      </div>
      <div class="stat-card main-score">
        <span class="label">현재 점수</span>
        <span class="value cyan">{{ score.toLocaleString() }}</span>
      </div>
      <div class="stat-card">
        <span class="label">가루</span>
        <span class="value white">{{ alchemyDust }} 💎</span>
      </div>
    </div>

    <div class="game-area-container">
      <div class="game-board-wrapper" ref="gameBoardRef">
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
      </div>

      <transition name="pop">
        <div v-if="comboMessage" class="combo-popup">
          {{ comboMessage }}
        </div>
      </transition>
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

    <div class="block-spawner-container">
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
const TOUCH_OFFSET_Y = 80; // [핵심] 손가락보다 80px 위에 블록이 보이도록 설정
const COMBO_SCORES = { 1: 100, 2: 300, 3: 600, 4: 1000, 5: 2000, 6: 5000 };

// --- 블록 정의 (1010! 표준) ---
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
  'L1': { shape: [[1, 0], [1, 0], [1, 1]] }, // L
  'L2': { shape: [[1, 1, 1], [1, 0, 0]] },   // J 누운거
  'L3': { shape: [[1, 1], [0, 1], [0, 1]] }, // ㄱ 반대
  'L4': { shape: [[0, 0, 1], [1, 1, 1]] },   // J
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
const clearingCells = ref([]); // 애니메이션용

// --- 드래그 관련 상태 ---
const gameBoardRef = ref(null);
const isDragging = ref(false);
const dragged = reactive({ block: null, index: -1 });
const pointerPosition = reactive({ x: 0, y: 0 });
const previewCells = ref([]);
const invalidDrop = ref(false);

// [핵심] 보드와 셀 크기를 동적으로 계산하기 위한 변수
const boardMetrics = reactive({ left: 0, top: 0, width: 0, cellSize: 0 });

// --- 초기화 및 게임 로직 ---

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
    // 10x10 그리드 + 갭 고려 (약식 계산, 정확한건 CSS Grid가 처리)
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
    // DOM 렌더링 후 보드 치수 계산
    nextTick(() => updateBoardMetrics());
  } catch (error) {
    console.error(error);
    // 개발 모드나 에러 시에도 로컬 플레이 가능하게 (선택사항)
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
  // 스폰 직후 게임 오버 체크
  checkGameOver();
};

// --- 드래그 앤 드롭 핸들러 ---

const handleDragStart = (e, block, index) => {
  if (gameStatus.value !== 'playing') return;
  
  // 터치/마우스 좌표 통일
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  isDragging.value = true;
  dragged.block = block;
  dragged.index = index;
  pointerPosition.x = clientX;
  pointerPosition.y = clientY;

  // 드래그 시작 시 보드 위치 정보 최신화
  updateBoardMetrics();
};

const handleDragMove = (e) => {
  if (!isDragging.value || !dragged.block) return;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  pointerPosition.x = clientX;
  pointerPosition.y = clientY;

  // [핵심] 시각적 오프셋(TOUCH_OFFSET_Y)을 적용한 '가상 블록 위치' 계산
  // 사용자가 터치한 곳보다 위쪽을 기준으로 판정
  const visualX = clientX;
  const visualY = clientY - TOUCH_OFFSET_Y;

  // 보드 내부 좌표로 변환
  const relX = visualX - boardMetrics.left;
  const relY = visualY - boardMetrics.top;

  // 그리드 인덱스 계산 (보드 크기 기준 비율로 계산하여 정확도 향상)
  const colIndex = Math.floor((relX / boardMetrics.width) * BOARD_SIZE);
  const rowIndex = Math.floor((relY / boardMetrics.width) * BOARD_SIZE); // 정사각형이므로 width 사용

  // 유효한 범위 내인지 확인
  if (rowIndex >= 0 && rowIndex < BOARD_SIZE && colIndex >= 0 && colIndex < BOARD_SIZE) {
    // 미리보기 계산 시 블록의 중심을 잡는게 아니라, 
    // 터치한 위치가 블록의 (0,0)이나 중심이 되도록 보정 로직 추가 가능
    // 여기서는 단순화를 위해 터치 포인트 바로 위가 블록의 시작점(0,0)이라고 가정
    // 실제로는 블록의 너비/높이 절반만큼 더 빼주면 "중심 잡기"가 됨.
    
    // 블록 중심 보정 (선택 사항, 여기서는 블록의 좌상단을 기준으로 함)
    const blockRows = dragged.block.shape.length;
    const blockCols = dragged.block.shape[0].length;
    
    // 손가락 위치가 블록의 정중앙에 오도록 보정
    const adjustedRow = rowIndex - Math.floor(blockRows / 2);
    const adjustedCol = colIndex - Math.floor(blockCols / 2);

    if (canPlace(dragged.block, adjustedRow, adjustedCol)) {
      previewCells.value = getPlacementCells(dragged.block, adjustedRow, adjustedCol);
      invalidDrop.value = false;
    } else {
      // 놓을 수 없는 위치라도 빨간색으로 미리보기 표시 (UX 개선)
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
    // 배치 확정
    previewCells.value.forEach(idx => {
      if (idx >= 0 && idx < board.length) board[idx] = 1;
    });

    const cellsCount = dragged.block.shape.flat().filter(x => x).length;
    score.value += cellsCount;

    // 라인 클리어 체크
    checkLines();

    // 블록 소비 및 재생성 체크
    blocks.value[dragged.index] = { uid: null, shape: null };
    if (blocks.value.every(b => !b.shape)) {
      spawnBlocks();
    } else {
      checkGameOver();
    }
  }

  // 초기화
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
        // 보드 밖이거나 이미 채워진 곳이면 불가
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr * BOARD_SIZE + nc] === 1) {
          return false;
        }
      }
    }
  }
  return true;
};

// ignoreCollision: 빨간색 미리보기를 위해 충돌 무시하고 좌표만 계산
const getPlacementCells = (block, r, c, ignoreCollision = false) => {
  const cells = [];
  const shape = block.shape;
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j] === 1) {
        const nr = r + i;
        const nc = c + j;
        // 보드 내부인 경우만 추가
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          cells.push(nr * BOARD_SIZE + nc);
        } else if (!ignoreCollision) {
            // 하나라도 밖으로 나가면 유효한 배치가 아님 (빨간색 표시 때는 무시)
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

  // 행 검사
  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r * BOARD_SIZE + c] === 0) { full = false; break; }
    }
    if (full) rowsToClear.push(r);
  }

  // 열 검사
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (board[r * BOARD_SIZE + c] === 0) { full = false; break; }
    }
    if (full) colsToClear.push(c);
  }

  const allIndices = new Set();
  rowsToClear.forEach(r => {
    for(let c=0; c<BOARD_SIZE; c++) allIndices.add(r*BOARD_SIZE + c);
  });
  colsToClear.forEach(c => {
    for(let r=0; r<BOARD_SIZE; r++) allIndices.add(r*BOARD_SIZE + c);
  });

  if (allIndices.size > 0) {
    clearingCells.value = Array.from(allIndices);
    lines = rowsToClear.length + colsToClear.length;
    
    // 점수 계산
    const points = COMBO_SCORES[lines] || (lines * 100);
    const dust = lines >= 2 ? lines : 0;
    
    score.value += points;
    alchemyDust.value += dust;
    
    // 콤보 메시지
    if (lines >= 2) {
      comboMessage.value = `${lines} 콤보! +${points}`;
      setTimeout(() => comboMessage.value = '', 1500);
    }

    // 애니메이션 후 데이터 삭제
    setTimeout(() => {
      clearingCells.value.forEach(idx => board[idx] = 0);
      clearingCells.value = [];
    }, 300);
  }
};

const checkGameOver = () => {
  // 남은 블록 중 하나라도 놓을 곳이 있는지 확인
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

  if (!canMove) {
    handleGameOverProcess();
  }
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

const restartGame = () => {
  startGameLogic();
};
const goToDashboard = () => router.push('/dashboard');

// --- 스타일 헬퍼 ---
const getBlockGridStyle = (block) => {
  if (!block || !block.shape) return {};
  const rows = block.shape.length;
  const cols = block.shape[0].length;
  return {
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    // 블록 자체의 크기를 고정하지 않고, 내부 셀 크기에 맞춤
    width: `${cols * 20 + (cols-1)*2}px` 
  };
};

const floatingBlockStyle = computed(() => {
  // 블록을 손가락 위로 띄움 (오프셋 적용)
  return {
    position: 'fixed',
    left: `${pointerPosition.x}px`,
    top: `${pointerPosition.y - TOUCH_OFFSET_Y}px`, // Y축 오프셋 적용
    transform: 'translate(-50%, -50%) scale(1.2)', // 손가락 중심에 맞추고 약간 확대
    pointerEvents: 'none',
    zIndex: 9999
  };
});
</script>

<style scoped>
/* 전체 페이지 - 다크 테마 */
.block-puzzle-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: radial-gradient(circle at center, #1a2a6c, #b21f1f, #fdbb2d); /* 예비용 */
  background: linear-gradient(135deg, #0f2027, #203a43, #2c5364); /* Deep Sea 느낌 */
  padding: 20px 10px;
  box-sizing: border-box;
  font-family: 'Noto Sans KR', sans-serif;
  overflow: hidden; /* 스크롤 방지 */
  touch-action: none; /* 모바일에서 드래그 시 화면 밀림 방지 */
}

/* 상단 헤더 */
.game-header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 450px;
  margin-bottom: 20px;
  gap: 10px;
}

.stat-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 10px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 6px rgba(0,0,0,0.2);
}
.stat-card.main-score {
  border-color: rgba(0, 255, 255, 0.5);
  background: rgba(0, 0, 0, 0.3);
  transform: scale(1.05);
}

.label { font-size: 0.75rem; color: #aaa; margin-bottom: 4px; }
.value { font-size: 1.1rem; font-weight: bold; }
.gold { color: #ffd700; }
.cyan { color: #00ffff; text-shadow: 0 0 10px rgba(0,255,255,0.5); }
.white { color: #fff; }

/* 게임 영역 컨테이너 (반응형 유지) */
.game-area-container {
  position: relative;
  width: 100%;
  max-width: 450px; /* PC에서는 너무 크지 않게 */
  aspect-ratio: 1 / 1; /* 정사각형 비율 유지 */
  margin-bottom: 30px;
}

.game-board-wrapper {
  width: 100%;
  height: 100%;
  padding: 5px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 15px;
  border: 1px solid rgba(255,255,255,0.1);
  box-sizing: border-box;
}

/* 10x10 그리드 보드 */
.game-board {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  grid-template-rows: repeat(10, 1fr);
  gap: 2px; /* 셀 간격 */
  width: 100%;
  height: 100%;
}

.game-cell {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  transition: background-color 0.1s, transform 0.2s;
}

/* 셀 상태 스타일 */
.game-cell.filled {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  box-shadow: inset 0 0 5px rgba(255,255,255,0.4), 0 0 10px rgba(0, 242, 254, 0.5);
  border: 1px solid rgba(255,255,255,0.3);
}

.game-cell.preview {
  background: rgba(255, 255, 255, 0.3);
  border: 1px dashed rgba(255,255,255,0.5);
}

.game-cell.invalid {
  background: rgba(255, 50, 50, 0.4) !important; /* 놓을 수 없음 (빨강) */
}

/* 클리어 애니메이션 */
.game-cell.clearing {
  animation: flashAndShrink 0.4s forwards;
}
@keyframes flashAndShrink {
  0% { background: #fff; transform: scale(1); }
  50% { background: #fff; transform: scale(1.1); box-shadow: 0 0 20px #fff; }
  100% { background: transparent; transform: scale(0); opacity: 0; }
}

/* 콤보 팝업 */
.combo-popup {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.8);
  color: #ffd700;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 1.5rem;
  font-weight: bold;
  border: 2px solid #ffd700;
  z-index: 50;
  pointer-events: none;
}
.pop-enter-active { animation: popup 0.5s ease-out; }
@keyframes popup {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

/* 블록 스포너 (하단) */
.block-spawner-container {
  width: 100%;
  max-width: 450px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  padding: 10px;
  border-top: 1px solid rgba(255,255,255,0.1);
  /* 하단 고정 느낌을 주려면 margin-top: auto 사용 가능 */
}

.block-spawner {
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 90px;
}

.spawn-slot {
  width: 80px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.spawn-slot.is-dragging {
  opacity: 0.2; /* 드래그 중일 때 원본 흐리게 */
}

/* 블록 미리보기 스타일 */
.block-preview, .block-shape {
  display: grid;
  gap: 2px;
}
.block-cell {
  width: 18px;
  height: 18px;
  border-radius: 2px;
  background: transparent;
}
.block-cell.filled {
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%); /* 핑크 계열 */
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); /* 민트 계열 */
  /* 실제 게임에서는 랜덤 컬러나 고정 컬러 사용 가능 */
  background: #00f2fe; 
  box-shadow: 0 0 5px rgba(0,242,254,0.6);
}
.block-cell.filled.invalid {
  background: #ff4b4b; /* 놓을 수 없을 때 블록 색상 변경 */
}

/* 플로팅 블록 (드래그 중) */
.floating-block-container {
  pointer-events: none; /* 클릭 통과 */
}

/* 결과 모달 */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex; justify-content: center; align-items: center;
  z-index: 100;
  backdrop-filter: blur(5px);
}
.glass-panel {
  background: rgba(30, 30, 30, 0.9);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 30px;
  border-radius: 20px;
  width: 80%;
  max-width: 350px;
  text-align: center;
  color: white;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.1);
}
.game-over-title {
  font-size: 2rem; margin: 0 0 20px; color: #ff4b4b; text-shadow: 0 0 10px rgba(255,75,75,0.5);
}
.result-stats {
  display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;
}
.result-row {
  display: flex; justify-content: space-between; font-size: 1.1rem; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
}
.result-row.highlight { font-size: 1.2rem; margin-top: 10px; border: none; }

.modal-actions { display: flex; gap: 10px; }
.btn-restart, .btn-exit {
  flex: 1; padding: 12px; border-radius: 10px; border: none; font-weight: bold; cursor: pointer;
  transition: transform 0.1s;
}
.btn-restart { background: linear-gradient(90deg, #00c6ff, #0072ff); color: white; }
.btn-exit { background: #444; color: #ccc; }
.btn-restart:active, .btn-exit:active { transform: scale(0.95); }

</style>
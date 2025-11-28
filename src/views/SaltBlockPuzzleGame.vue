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

    <div v-if="gameStatus === 'idle'" class="modal-overlay start-screen">
      <div class="modal-content start-panel">
        <div class="start-header">
          <i class="fas fa-cubes"></i> 솔트 블록 1010
        </div>
        
        <div class="info-grid">
          <div class="info-row">
            <span>일일 무료 횟수</span>
            <span :class="{'limit-reached': dailyCount >= 10}">{{ 10 - dailyCount }} / 10</span>
          </div>
          <div class="info-row">
            <span>보유 티켓</span>
            <span class="ticket-val">{{ userTickets }} 장</span>
          </div>
          <div class="info-row">
            <span>내 포인트</span>
            <span class="point-val">{{ userPoints.toLocaleString() }} P</span>
          </div>
        </div>

        <p class="fee-notice">
          입장료: <strong>100 SaltMate</strong> (일일 횟수 차감)<br>
          <small class="ticket-notice">* 티켓 사용 시 획득 포인트 70% 적용</small>
        </p>

        <div class="start-actions">
          <button @click="handleStartGame" class="btn-start-game" :disabled="isLoading">
            <span v-if="!isLoading">게임 시작</span>
            <span v-else><i class="fas fa-spinner fa-spin"></i> 준비 중</span>
          </button>
          
          <button @click="handleBuyTicket" class="btn-buy-ticket" :disabled="isLoading">
            <i class="fas fa-shopping-cart"></i> 티켓 구매 (1,000 P)
          </button>
        </div>
        
        <button @click="goToDashboard" class="btn-text-exit">나가기</button>
      </div>
    </div>

    <div v-if="gameStatus === 'lost'" class="modal-overlay">
      <div class="modal-content glass-panel">
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
          <div v-if="isPurchasedPlay" class="penalty-notice">
            (티켓 사용: 보상 70% 적용)
          </div>
        </div>
        
        <div class="modal-actions">
          <button @click="resetToStart" class="btn-restart">처음으로</button>
          <button @click="goToDashboard" class="btn-exit">나가기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { functions, auth, db } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';

// --- Firebase Functions ---
const startGameFunc = httpsCallable(functions, 'startBlockPuzzleGame');
const endGameFunc = httpsCallable(functions, 'endBlockPuzzleGame');
const buyTicketFunc = httpsCallable(functions, 'purchaseBlockPuzzleTickets');
const router = useRouter();

// --- Constants ---
const BOARD_SIZE = 10;
const TOUCH_OFFSET_Y = 80;
const COMBO_SCORES = { 1: 100, 2: 300, 3: 600, 4: 1000, 5: 2000, 6: 5000 };

// --- Block Definitions ---
const BLOCK_DEFINITIONS = {
  '1x1': { shape: [[1]] }, '1x2': { shape: [[1, 1]] }, '2x1': { shape: [[1], [1]] },
  '1x3': { shape: [[1, 1, 1]] }, '3x1': { shape: [[1], [1], [1]] },
  '1x4': { shape: [[1, 1, 1, 1]] }, '4x1': { shape: [[1], [1], [1], [1]] },
  '1x5': { shape: [[1, 1, 1, 1, 1]] }, '5x1': { shape: [[1], [1], [1], [1], [1]] },
  '2x2': { shape: [[1, 1], [1, 1]] }, '3x3': { shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },
  'L1': { shape: [[1, 0], [1, 0], [1, 1]] }, 'L2': { shape: [[1, 1, 1], [1, 0, 0]] },
  'L3': { shape: [[1, 1], [0, 1], [0, 1]] }, 'L4': { shape: [[0, 0, 1], [1, 1, 1]] },
};
const blockTypes = Object.keys(BLOCK_DEFINITIONS);

// --- State ---
const gameStatus = ref('idle'); // idle(start screen), playing, lost
const isLoading = ref(false);
const board = reactive(Array(BOARD_SIZE * BOARD_SIZE).fill(0));
const blocks = ref([{uid: 1, shape: null}, {uid: 2, shape: null}, {uid: 3, shape: null}]);
const score = ref(0);
const highScore = ref(0);
const alchemyDust = ref(0);
const comboMessage = ref('');
const finalPointsAwarded = ref(0);
const clearingCells = ref([]);
const isPurchasedPlay = ref(false); // Track if current game is using ticket

// User Data for Start Screen
const userPoints = ref(0);
const userTickets = ref(0);
const dailyCount = ref(0);
let unsubscribeUser = null;
let unsubscribeDaily = null;

// Dragging State
const gameBoardRef = ref(null);
const isDragging = ref(false);
const dragged = reactive({ block: null, index: -1 });
const pointerPosition = reactive({ x: 0, y: 0 });
const previewCells = ref([]);
const invalidDrop = ref(false);
const boardMetrics = reactive({ left: 0, top: 0, width: 0, cellSize: 0 });

// --- Lifecycle ---
onMounted(() => {
  const user = auth.currentUser;
  if (!user) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }
  
  // Realtime User Data Listeners
  unsubscribeUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      userPoints.value = data.saltmatePoints || 0;
      userTickets.value = data.purchasedBlockPuzzleTickets || 0;
      highScore.value = data.blockPuzzleHighScore || 0;
    }
  });

  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  unsubscribeDaily = onSnapshot(doc(db, "users", user.uid, "daily_play_counts", todayStr), (docSnap) => {
    if (docSnap.exists()) {
      dailyCount.value = docSnap.data().blockPuzzle || 0;
    } else {
      dailyCount.value = 0;
    }
  });

  window.addEventListener('resize', updateBoardMetrics);
});

onUnmounted(() => {
  if (unsubscribeUser) unsubscribeUser();
  if (unsubscribeDaily) unsubscribeDaily();
  window.removeEventListener('resize', updateBoardMetrics);
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

// --- Actions ---

const handleStartGame = async () => {
  if (dailyCount.value >= 10 && userTickets.value <= 0) {
    alert("오늘의 무료 횟수와 티켓을 모두 소진했습니다.");
    return;
  }
  if (dailyCount.value < 10 && userPoints.value < 100) {
    alert("입장료(100 P)가 부족합니다.");
    return;
  }

  isLoading.value = true;
  try {
    const result = await startGameFunc();
    isPurchasedPlay.value = result.data.isPurchasedPlay; // Store mode
    
    initGame();
    gameStatus.value = 'playing';
    nextTick(() => updateBoardMetrics());
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    isLoading.value = false;
  }
};

const handleBuyTicket = async () => {
  if (userPoints.value < 1000) {
    alert("포인트가 부족합니다. (1,000 P 필요)");
    return;
  }
  if (!confirm("1,000 SaltMate로 티켓 10장을 구매하시겠습니까?")) return;

  isLoading.value = true;
  try {
    await buyTicketFunc();
    alert("티켓 구매 완료!");
  } catch (error) {
    console.error(error);
    alert("구매 실패: " + error.message);
  } finally {
    isLoading.value = false;
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

// --- Game Logic (Drag & Drop) ---
// (동일한 로직 유지, 간결하게 표시)
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
    previewCells.value.forEach(idx => { if (idx >= 0 && idx < board.length) board[idx] = 1; });
    const cellsCount = dragged.block.shape.flat().filter(x => x).length;
    score.value += cellsCount;
    checkLines();
    blocks.value[dragged.index] = { uid: null, shape: null };
    if (blocks.value.every(b => !b.shape)) spawnBlocks();
    else checkGameOver();
  }
  isDragging.value = false;
  dragged.block = null;
  dragged.index = -1;
  previewCells.value = [];
  invalidDrop.value = false;
};

const canPlace = (block, r, c) => {
  const shape = block.shape;
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j] === 1) {
        const nr = r + i;
        const nc = c + j;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || board[nr * BOARD_SIZE + nc] === 1) return false;
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
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) cells.push(nr * BOARD_SIZE + nc);
        else if (!ignoreCollision) return []; 
      }
    }
  }
  return cells;
};

const checkLines = () => {
  let lines = 0;
  const rowsToClear = [], colsToClear = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) if (board[r * BOARD_SIZE + c] === 0) { full = false; break; }
    if (full) rowsToClear.push(r);
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) if (board[r * BOARD_SIZE + c] === 0) { full = false; break; }
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
        if (canPlace(block, r, c)) { canMove = true; break; }
      }
      if (canMove) break;
    }
    if (canMove) break;
  }
  if (!canMove) handleGameOverProcess();
};

const handleGameOverProcess = async () => {
  gameStatus.value = 'lost';
  if (score.value > highScore.value) highScore.value = score.value; // Optimistic update
  
  try {
    const res = await endGameFunc({ 
        score: score.value, 
        alchemyDust: alchemyDust.value,
        isPurchasedPlay: isPurchasedPlay.value // Pass the flag
    });
    finalPointsAwarded.value = res.data.awardedPoints;
  } catch (e) { console.error(e); }
};

const resetToStart = () => {
  gameStatus.value = 'idle';
};
const goToDashboard = () => router.push('/dashboard');

// --- Style Helpers ---
const getBlockGridStyle = (block) => {
  if (!block || !block.shape) return {};
  const rows = block.shape.length;
  const cols = block.shape[0].length;
  return {
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    width: `${cols * 22}px`, gap: '2px'
  };
};
const floatingBlockStyle = computed(() => ({
  position: 'fixed', left: `${pointerPosition.x}px`, top: `${pointerPosition.y - TOUCH_OFFSET_Y}px`,
  transform: 'translate(-50%, -50%) scale(1.2)', pointerEvents: 'none', zIndex: 9999
}));
</script>

<style scoped>
/* 기본 레이아웃 유지 */
.block-puzzle-page {
  display: flex; flex-direction: column; height: 100dvh; width: 100vw;
  background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
  padding-top: env(safe-area-inset-top, 5px); padding-bottom: env(safe-area-inset-bottom, 5px);
  box-sizing: border-box; overflow: hidden; touch-action: none;
  font-family: 'Noto Sans KR', sans-serif; color: white;
  justify-content: center; align-items: center; gap: 15px;
}

/* --- 상단/보드/하단 스타일은 이전과 동일 (생략 없이 유지) --- */
.game-header-area { flex-shrink: 0; display: flex; justify-content: space-around; width: 95%; max-width: 450px; margin: 0; gap: 8px; }
.stat-card { flex: 1; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(5px); border-radius: 10px; padding: 8px 4px; display: flex; flex-direction: column; align-items: center; border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
.stat-card.main-score { background: rgba(0, 0, 0, 0.3); border-color: rgba(0, 255, 255, 0.3); transform: scale(1.05); }
.label { font-size: 0.7rem; color: #ccc; margin-bottom: 2px; }
.value { font-size: 1rem; font-weight: bold; white-space: nowrap; }
.gold { color: #ffd700; } .cyan { color: #00ffff; text-shadow: 0 0 5px rgba(0,255,255,0.5); } .white { color: #fff; }

.game-board-container { flex: 0 1 auto; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; position: relative; overflow: visible; padding: 0 10px; box-sizing: border-box; }
.board-aspect-ratio-box { width: 100%; max-width: 450px; aspect-ratio: 1 / 1; max-height: 50vh; background: rgba(0, 0, 0, 0.3); border-radius: 12px; border: 2px solid rgba(255, 255, 255, 0.1); padding: 6px; box-shadow: 0 0 20px rgba(0, 0, 0, 0.3); position: relative; box-sizing: border-box; }
.game-board { display: grid; grid-template-columns: repeat(10, 1fr); grid-template-rows: repeat(10, 1fr); gap: 2px; width: 100%; height: 100%; }
.game-cell { background: rgba(255, 255, 255, 0.08); border-radius: 3px; transition: background-color 0.1s; }
.game-cell.filled { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); box-shadow: inset 0 0 5px rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.2); }
.game-cell.preview { background: rgba(255, 255, 255, 0.3); border: 1px dashed rgba(255,255,255,0.5); }
.game-cell.invalid { background: rgba(255, 80, 80, 0.4) !important; }
.game-cell.clearing { animation: flash 0.3s forwards; }
@keyframes flash { 0% { background: #fff; transform: scale(1); } 100% { background: transparent; transform: scale(0); } }
.combo-popup { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.85); color: #ffd700; padding: 10px 20px; border-radius: 20px; font-size: 1.5rem; font-weight: bold; border: 2px solid #ffd700; z-index: 20; pointer-events: none; white-space: nowrap; }
.pop-enter-active { animation: popAnim 0.4s ease-out; }
@keyframes popAnim { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

.block-spawner-area { flex-shrink: 0; height: 100px; width: 100%; max-width: 450px; display: flex; justify-content: center; align-items: center; background: transparent; border: none; padding-bottom: 0; }
.block-spawner { display: flex; justify-content: space-around; align-items: center; width: 100%; height: 100%; background: rgba(0,0,0,0.2); border-radius: 15px; }
.spawn-slot { width: 30%; height: 80%; display: flex; justify-content: center; align-items: center; }
.spawn-slot.is-dragging { opacity: 0.3; }
.block-preview, .block-shape { display: grid; gap: 2px; }
.block-cell { width: 20px; height: 20px; border-radius: 2px; background: transparent; }
.block-cell.filled { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.block-cell.filled.invalid { background: #ff4b4b; }
.floating-block-container { pointer-events: none; z-index: 9999; }

/* --- 신규: 시작 화면 (Start Screen) --- */
.start-screen {
  background: rgba(0, 0, 0, 0.9); /* 더 어둡게 */
  z-index: 2000;
}
.start-panel {
  background: #2c3e50; /* 짙은 남색 배경 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.7);
  padding: 25px 20px;
  width: 85%;
  max-width: 340px;
  border-radius: 16px;
  color: white;
  text-align: center;
}
.start-header {
  font-size: 1.5rem; font-weight: bold; margin-bottom: 20px;
  color: #fff;
}
.start-header i { margin-right: 8px; }

.info-grid {
  display: flex; flex-direction: column; gap: 10px;
  background: rgba(0, 0, 0, 0.3);
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 15px;
}
.info-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.95rem; color: #ddd;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 5px;
}
.info-row:last-child { border-bottom: none; padding-bottom: 0; }
.limit-reached { color: #ff4b4b; font-weight: bold; }
.ticket-val { color: #00c6ff; font-weight: bold; }
.point-val { color: #ffd700; font-weight: bold; }

.fee-notice {
  font-size: 0.85rem; color: #aaa; margin-bottom: 20px; line-height: 1.4;
}
.fee-notice strong { color: #fff; }
.ticket-notice { display: block; color: #ff9a9e; margin-top: 4px; font-size: 0.8rem; }

.start-actions {
  display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;
}
.btn-start-game {
  width: 100%; padding: 14px; border: none; border-radius: 8px;
  font-size: 1.1rem; font-weight: bold; cursor: pointer;
  background: #007bff; color: white;
  transition: background 0.2s;
}
.btn-start-game:active { background: #0056b3; }
.btn-start-game:disabled { background: #555; cursor: not-allowed; }

.btn-buy-ticket {
  width: 100%; padding: 14px; border: none; border-radius: 8px;
  font-size: 1rem; font-weight: bold; cursor: pointer;
  background: #6f42c1; color: white; /* 보라색 */
  transition: background 0.2s;
}
.btn-buy-ticket:active { background: #5a32a3; }
.btn-buy-ticket:disabled { background: #555; cursor: not-allowed; }

.btn-text-exit {
  background: none; border: none; color: #aaa; text-decoration: underline; cursor: pointer; font-size: 0.9rem;
}

/* 기존 결과 모달 스타일 유지 */
.glass-panel { background: rgba(30, 30, 30, 0.95); border: 1px solid rgba(255,255,255,0.1); padding: 30px; border-radius: 20px; width: 85%; max-width: 320px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
.game-over-title { color: #ff4b4b; font-size: 2rem; margin: 0 0 20px; text-shadow: 0 0 10px rgba(255,0,0,0.5); }
.result-stats { display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px; }
.result-row { display: flex; justify-content: space-between; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; }
.result-row.highlight { font-size: 1.3rem; color: #ffd700; border: none; margin-top: 5px; }
.penalty-notice { color: #ff9a9e; font-size: 0.85rem; margin-top: 5px; } /* 패널티 안내 */

.modal-actions { display: flex; gap: 10px; }
.btn-restart, .btn-exit { flex: 1; padding: 12px; border: none; border-radius: 10px; font-weight: bold; font-size: 1rem; cursor: pointer; }
.btn-restart { background: linear-gradient(90deg, #00c6ff, #0072ff); color: white; box-shadow: 0 4px 15px rgba(0,114,255,0.4); }
.btn-exit { background: #444; color: #ccc; }
.loading-text { color: #00c6ff; font-size: 1.2rem; }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); }
</style>
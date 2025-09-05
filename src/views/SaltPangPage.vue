<template>
  <div class="salt-pang-page">
    <header class="page-header">
      <h1>💎 솔트팡</h1>
      <p>같은 모양의 소금 결정을 3개 이상 맞춰보세요!</p>
    </header>

    <main class="game-container card">
      <div v-if="gameState === 'ready'" class="game-intro">
        <h2>게임 준비</h2>
        <p>입장료: <strong>{{ currentEntryFee }} SaltMate</strong></p>
        <p>60초 동안 최대한 높은 점수를 획득하세요!</p>
        <button @click="startGame" class="game-button" :disabled="isStarting">
           <span v-if="isStarting">입장 중...</span>
           <span v-else>게임 시작</span>
        </button>
      </div>

      <div v-if="gameState === 'playing' || gameState === 'ended'" class="game-area">
        <div class="game-stats">
          <div class="stat-item">시간: <strong>{{ timer }}</strong></div>
          <button @click="toggleMute" class="mute-button">
            <i :class="isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up'"></i>
          </button>
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
            <transition name="gem-explode">
              <span v-if="cell !== null && !explodingGems.has(index)" class="gem" :style="{ color: gemColors[cell] }">
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
import { ref, onUnmounted, onMounted, computed } from 'vue';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import soundMatch from '@/assets/sounds/match.mp3';
import soundBgm from '@/assets/sounds/bgm.mp3';

const BOARD_SIZE = 8;
const NUM_GEM_TYPES = 5;
const GAME_DURATION = 60;

const gemIcons = ['💎', '🟡', '🟢', '🔵', '🟣', '🔴'];
const gemColors = ['#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e74c3c', '#e67e22'];

let audioContextStarted = false;
const isMuted = ref(false);
const sounds = {
  match: new Audio(soundMatch),
  background: new Audio(soundBgm),
};
sounds.background.loop = true;
sounds.background.volume = 0.3;

const gameState = ref('ready');
const board = ref([]);
const score = ref(0);
const timer = ref(GAME_DURATION);
const selectedCell = ref(null);
const isProcessing = ref(false);
const isStarting = ref(false);
const error = ref('');
const awardedPoints = ref(0);
const explodingGems = ref(new Set()); 
const playCount = ref(0);

let timerInterval = null;
let sessionId = null;

const currentEntryFee = computed(() => {
  if (playCount.value >= 30) return 300;
  if (playCount.value >= 15) return 200;
  return 100;
});

const fetchPlayCount = async () => {
  if (!auth.currentUser) return;
  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const playCountRef = doc(db, "users", auth.currentUser.uid, "daily_play_counts", todayStr);
  const docSnap = await getDoc(playCountRef);
  
  if (docSnap.exists() && docSnap.data().saltPang) {
    playCount.value = docSnap.data().saltPang;
  } else {
    playCount.value = 0;
  }
};

const playSound = (sound) => {
  if (!isMuted.value && audioContextStarted) {
    sound.currentTime = 0;
    sound.play().catch(e => console.error("사운드 재생 오류:", e));
  }
};

const initAudioContext = () => {
  if (!audioContextStarted) {
    audioContextStarted = true;
    console.log("오디오 컨텍스트가 활성화되었습니다.");
  }
};

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  if (isMuted.value) {
    sounds.background.pause();
  } else if (gameState.value === 'playing') {
    sounds.background.play();
  }
};

const createBoard = () => {
  let newBoard = [];
  do {
    newBoard = [];
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
      newBoard.push(Math.floor(Math.random() * NUM_GEM_TYPES) + 1);
    }
  } while (hasInitialMatches(newBoard)); 
  return newBoard;
};

const hasInitialMatches = (boardToCheck) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const i = r * BOARD_SIZE + c;
      if (boardToCheck[i] && boardToCheck[i] === boardToCheck[i + 1] && boardToCheck[i] === boardToCheck[i + 2]) return true;
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const i = r * BOARD_SIZE + c;
      if (boardToCheck[i] && boardToCheck[i] === boardToCheck[i + BOARD_SIZE] && boardToCheck[i] === boardToCheck[i + 2 * BOARD_SIZE]) return true;
    }
  }
  return false;
};

const startGame = async () => {
  isStarting.value = true;
  error.value = '';
  initAudioContext();
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const startSession = httpsCallable(functions, 'startSaltPangSession');
    const result = await startSession();
    sessionId = result.data.sessionId;

    score.value = 0;
    awardedPoints.value = 0;
    timer.value = GAME_DURATION;
    board.value = createBoard();
    gameState.value = 'playing';
    
    await fetchPlayCount(); 
    
    playSound(sounds.background);

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
  
  sounds.background.pause();
  sounds.background.currentTime = 0;

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const endSession = httpsCallable(functions, 'endSaltPangSession');
    
    const result = await endSession({ 
      sessionId: sessionId, 
      score: score.value
    }); 
    
    awardedPoints.value = result.data.awardedPoints;

  } catch (err) {
    console.error("게임 종료 오류:", err);
    error.value = `결과 처리 실패: ${err.message}`;
  }
};

const resetGame = async () => {
  gameState.value = 'ready';
  sessionId = null;
  error.value = '';
  explodingGems.value.clear();
  await fetchPlayCount(); 
};

const selectCell = (index) => {
  if (isProcessing.value || gameState.value !== 'playing') return;
  initAudioContext();

  if (selectedCell.value === null) {
    selectedCell.value = index;
  } else {
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
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const hasMatches = await checkAndClearMatches();

  if (!hasMatches) {
    await new Promise(resolve => setTimeout(resolve, 150));
    [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  } else {
    // eslint-disable-next-line no-empty
    while (await processBoard()) {}
  }

  isProcessing.value = false;
};

const processBoard = async () => {
  await new Promise(resolve => setTimeout(resolve, 200));
  dropDownGems();
  fillEmptyCells();
  
  await new Promise(resolve => setTimeout(resolve, 200));
  const hasCleared = await checkAndClearMatches();
  return hasCleared;
}

const checkAndClearMatches = async () => {
  const matches = new Set();
  // 가로
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      let i = r * BOARD_SIZE + c;
      if (board.value[i] && board.value[i] === board.value[i + 1] && board.value[i] === board.value[i + 2]) {
        for (let k = c; k < BOARD_SIZE; k++) {
          i = r * BOARD_SIZE + k;
          if (board.value[i] === board.value[r * BOARD_SIZE + c]) matches.add(i);
          else break;
        }
      }
    }
  }
  // 세로
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      let i = r * BOARD_SIZE + c;
      if (board.value[i] && board.value[i] === board.value[i + BOARD_SIZE] && board.value[i] === board.value[i + 2 * BOARD_SIZE]) {
        for (let k = r; k < BOARD_SIZE; k++) {
          i = k * BOARD_SIZE + c;
          if (board.value[i] === board.value[r * BOARD_SIZE + c]) matches.add(i);
          else break;
        }
      }
    }
  }
  
  if (matches.size > 0) {
    playSound(sounds.match);
    score.value += matches.size * 10 * (matches.size > 3 ? 2 : 1);
    
    matches.forEach(index => explodingGems.value.add(index));

    await new Promise(resolve => setTimeout(resolve, 300));
    matches.forEach(index => (board.value[index] = null));
    explodingGems.value.clear();
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

onMounted(fetchPlayCount);

onUnmounted(() => {
  clearInterval(timerInterval);
  sounds.background.pause();
});
</script>

<style scoped>
.salt-pang-page { max-width: 500px; margin: 70px auto; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.game-container { padding: 20px; background: #fff; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
.game-intro { text-align: center; }
.game-stats { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 1.2em; }
.game-board { display: grid; gap: 4px; border: 2px solid #ccc; padding: 5px; border-radius: 8px; }
.cell { width: 50px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: #f0f0f0; border-radius: 4px; cursor: pointer; position: relative; overflow: hidden;} /* [수정] position: relative와 overflow: hidden 추가 */
.cell.selected { background-color: #a0a0a0; }
.gem { font-size: 2em; user-select: none; transition: transform 0.2s; position: absolute; } /* [수정] position: absolute 추가 */
.game-button { padding: 12px 25px; font-size: 1.1em; cursor: pointer; }
.game-overlay { position: absolute; inset: 0; background-color: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; border-radius: 12px; }
.end-modal { background-color: white; padding: 30px; border-radius: 8px; text-align: center; color: #333; }
.error-message { margin-top: 15px; color: red; text-align: center; }
/* [기존 애니메이션 제거/수정] */
/* .pop-enter-active, .pop-leave-active { transition: transform 0.3s; }
.pop-enter-from, .pop-leave-to { transform: scale(0); } */

/* [신규 추가] 음소거 버튼 스타일 */
.mute-button {
  background: none;
  border: 1px solid #ccc;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1em;
  cursor: pointer;
  color: #555;
}

/* [신규 추가] 보석 터지는 애니메이션 */
.gem-explode-enter-active,
.gem-explode-leave-active {
  transition: all 0.3s ease-out; /* 애니메이션 지속 시간 */
}

.gem-explode-enter-from,
.gem-explode-leave-to {
  opacity: 0;
  transform: scale(2) rotate(45deg); /* 크게 확대되면서 회전하여 사라지는 효과 */
}
</style>
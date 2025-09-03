<template>
  <div class="salt-pang-page" :style="pageBackgroundStyle">
    <header class="page-header">
      <h1>💎 솔트팡</h1>
      <p>같은 모양의 소금 결정을 3개 이상 맞춰보세요!</p>
    </header>

    <main class="game-container card">
      <div v-if="gameState === 'ready'" class="game-intro">
        <h2>게임 준비</h2>
        <p>입장료: <strong>100 SaltMate</strong></p>
        <p>60초 동안 최대한 높은 점수를 획득하세요!</p>
        <button @click="startGame" class="game-button" :disabled="isStarting">
           <span v-if="isStarting">입장 중...</span>
           <span v-else>게임 시작</span>
        </button>

        <div class="ranking-section">
          <h3>오늘의 TOP 7</h3>
          <ul class="ranking-list">
            <li v-for="(rank, index) in topRankings" :key="rank.uid">
              <span>{{ index + 1 }}위</span>
              <span>{{ rank.username }}</span>
              <span>{{ rank.score.toLocaleString() }}점</span>
            </li>
            <li v-if="topRankings.length === 0">랭킹 데이터가 없습니다.</li>
          </ul>
        </div>

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
import { ref, onUnmounted, onMounted, computed } from 'vue'; // [수정] onMounted, computed 추가
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth'; // [신규] 사용자 이름 가져오기 위해 auth 모듈 추가

// 사운드 파일 import
import soundMatch from '@/assets/sounds/match.mp3';
import soundBgm from '@/assets/sounds/bgm.mp3';
// [신규] 배경 이미지 import
import backgroundPng from '@/assets/slatpang.png'; 

// --- 게임 상수 ---
const BOARD_SIZE = 8;
const NUM_GEM_TYPES = 5;
const GAME_DURATION = 60;

const gemIcons = ['💎', '🟡', '🟢', '🔵', '🟣', '🔴'];
const gemColors = ['#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e74c3c', '#e67e22'];

// --- 사운드 객체 ---
let audioContextStarted = false;
const sounds = {
  match: new Audio(soundMatch),
  background: new Audio(soundBgm),
};
sounds.background.loop = true;
sounds.background.volume = 0.3;

// --- 상태 변수 ---
const gameState = ref('ready');
const board = ref([]);
const score = ref(0);
const timer = ref(GAME_DURATION);
const selectedCell = ref(null);
const isProcessing = ref(false);
const isStarting = ref(false);
const error = ref('');
const awardedPoints = ref(0);
const topRankings = ref([]); // [신규] 랭킹 데이터를 저장할 변수

let timerInterval = null;
let sessionId = null;

// [신규] 배경 스타일 computed 속성
const pageBackgroundStyle = computed(() => ({
  backgroundImage: `url(${backgroundPng})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)', // 어두운 배경색
  backgroundBlendMode: 'darken', // 배경 이미지와 색상 혼합
  minHeight: '100vh',
}));


// --- 사운드 재생 관리 ---
const playSound = (sound) => {
  sound.currentTime = 0;
  sound.play().catch(e => console.error("사운드 재생 오류:", e));
};

const initAudioContext = () => {
  if (!audioContextStarted) {
    // 사용자의 첫 상호작용 시 오디오 컨텍스트를 활성화
    // 실제 소리를 작게 재생했다가 멈춰서 오디오 컨텍스트를 "active" 상태로 만듭니다.
    const tempAudio = new Audio(soundMatch); // 아무 사운드 파일
    tempAudio.volume = 0;
    tempAudio.play().then(() => {
      tempAudio.pause();
      tempAudio.currentTime = 0;
      audioContextStarted = true;
    }).catch(e => console.error("오디오 컨텍스트 초기화 오류:", e));
  }
};


// --- 게임 보드 생성 ---
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
      if (boardToCheck[i] && boardToCheck[i] === boardToCheck[i + 1] && boardToCheck[i] === boardToCheck[i + 2]) {
        return true;
      }
    }
  }
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const i = r * BOARD_SIZE + c;
      if (boardToCheck[i] && boardToCheck[i] === boardToCheck[i + BOARD_SIZE] && boardToCheck[i] === boardToCheck[i + 2 * BOARD_SIZE]) {
        return true;
      }
    }
  }
  return false;
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
    gameState.value = 'playing';
    
    // [수정] 오디오 컨텍스트가 활성화 된 후에만 배경음악 재생 시도
    if (audioContextStarted) {
      playSound(sounds.background);
    } else {
      console.warn("오디오 컨텍스트가 아직 활성화되지 않아 배경음악이 재생되지 않을 수 있습니다. 첫 클릭 후 활성화됩니다.");
    }

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

    // [수정] 미리 초기화된 auth 객체 사용
    const user = auth.currentUser;
    const username = user && user.displayName ? user.displayName : '익명';

    const result = await endSession({ sessionId, score: score.value, username: username }); 
    awardedPoints.value = result.data.awardedPoints;

    fetchTopRankings();

  } catch (err) {
    console.error("게임 종료 오류:", err);
    error.value = `결과 처리 실패: ${err.message}`;
  }
};

const resetGame = () => {
  gameState.value = 'ready';
  sessionId = null;
  error.value = ''; // 에러 메시지 초기화
};


// --- 랭킹 관련 함수 ---
const fetchTopRankings = async () => {
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const getRankings = httpsCallable(functions, 'getSaltPangTopRankings');
    const result = await getRankings();
    topRankings.value = result.data.rankings;
  } catch (err) {
    console.error("랭킹 조회 오류:", err);
    error.value = "랭킹을 불러오지 못했습니다.";
  }
};


// --- 게임 로직 ---
const selectCell = (index) => {
  if (isProcessing.value || gameState.value !== 'playing') return;
  initAudioContext(); // [수정] 첫 클릭 시 오디오 컨텍스트 초기화 시도

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
  
  // 실제 스왑 적용
  [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  await new Promise(resolve => setTimeout(resolve, 150));
  
  const hasMatches = checkMatches(board.value); // [수정] 스왑 후 매치 여부만 확인

  if (!hasMatches) {
    await new Promise(resolve => setTimeout(resolve, 150));
    // 매치가 없으면 다시 원래대로 되돌림
    [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  } else {
    // 매치가 있다면 연쇄 반응 처리 시작
    while (await processBoard()) {
        // Continue processing board
    }
  }

  isProcessing.value = false;
};

const processBoard = async () => {
  await new Promise(resolve => setTimeout(resolve, 200)); // 매칭된 보드 상태를 시각적으로 보여주기 위함
  dropDownGems();
  fillEmptyCells();
  
  await new Promise(resolve => setTimeout(resolve, 200)); // 새로운 보드 상태를 시각적으로 보여주기 위함
  const hasCleared = await checkAndClearMatches(); // 새로 채워진 보드에서 매치 확인 및 처리
  return hasCleared; // 연쇄 반응이 있었는지 여부 반환
}

const checkAndClearMatches = async () => {
  const matches = new Set();
  // 가로 매치
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      let i = r * BOARD_SIZE + c;
      if (board.value[i] && board.value[i] === board.value[i + 1] && board.value[i] === board.value[i + 2]) {
        for (let k = c; k < BOARD_SIZE; k++) { // [수정] 4개 이상 매치될 경우를 위해 확장 확인
          i = r * BOARD_SIZE + k;
          if (board.value[i] === board.value[r * BOARD_SIZE + c]) matches.add(i);
          else break;
        }
      }
    }
  }
  // 세로 매치
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      let i = r * BOARD_SIZE + c;
      if (board.value[i] && board.value[i] === board.value[i + BOARD_SIZE] && board.value[i] === board.value[i + 2 * BOARD_SIZE]) {
        for (let k = r; k < BOARD_SIZE; k++) { // [수정] 4개 이상 매치될 경우를 위해 확장 확인
          i = k * BOARD_SIZE + c;
          if (board.value[i] === board.value[r * BOARD_SIZE + c]) matches.add(i);
          else break;
        }
      }
    }
  }
  
  if (matches.size > 0) {
    playSound(sounds.match);
    score.value += matches.size * 10 * (matches.size > 3 ? 2 : 1); // 4개 이상 매치 시 추가 점수
    matches.forEach(index => (board.value[index] = null));
    return true;
  }
  return false;
};

// [신규] 스왑 직후 매치 여부만 빠르게 확인하는 함수 (실제로 보드를 변경하지 않음)
const checkMatches = (boardToCheck) => {
  // 가로 매치
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      const i = r * BOARD_SIZE + c;
      if (boardToCheck[i] && boardToCheck[i] === boardToCheck[i + 1] && boardToCheck[i] === boardToCheck[i + 2]) {
        return true;
      }
    }
  }
  // 세로 매치
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      const i = r * BOARD_SIZE + c;
      if (boardToCheck[i] && boardToCheck[i] === boardToCheck[i + BOARD_SIZE] && boardToCheck[i] === boardToCheck[i + 2 * BOARD_SIZE]) {
        return true;
      }
    }
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

// --- 컴포넌트 생명 주기 훅 ---
onMounted(() => {
  fetchTopRankings(); // 컴포넌트 마운트 시 랭킹 불러오기
});

onUnmounted(() => {
  clearInterval(timerInterval);
  sounds.background.pause();
});
</script>

<style scoped>
.salt-pang-page { 
  max-width: 500px; 
  margin: 0 auto; /* 중앙 정렬 */
  padding: 20px; 
  box-sizing: border-box; /* 패딩이 너비에 포함되도록 */
  color: white; /* 텍스트 색상 흰색 */
}
.page-header { text-align: center; margin-bottom: 20px; }
.game-container { 
  padding: 20px; 
  background-color: rgba(0, 0, 0, 0.5); /* 카드 배경을 반투명하게 */
  border-radius: 12px;
}
.game-intro { text-align: center; }
.game-stats { 
  display: flex; justify-content: space-between; 
  margin-bottom: 15px; font-size: 1.2em; 
  color: #eee; /* 통계 텍스트 색상 */
}
.game-board { 
  display: grid; gap: 4px; 
  border: 2px solid #555; /* 보드 테두리 색상 변경 */
  padding: 5px; border-radius: 8px; 
  background-color: rgba(0, 0, 0, 0.6); /* 보드 배경 반투명 */
}
.cell { 
  width: 50px; height: 50px; 
  display: flex; justify-content: center; align-items: center; 
  background-color: rgba(255, 255, 255, 0.1); /* 셀 배경색 변경 */
  border-radius: 4px; cursor: pointer; 
  border: 1px solid rgba(255, 255, 255, 0.15); /* 셀 테두리 추가 */
}
.cell.selected { background-color: rgba(255, 255, 255, 0.3); }
.gem { font-size: 2em; user-select: none; transition: transform 0.2s; }
.game-button { 
  padding: 12px 25px; font-size: 1.1em; cursor: pointer; 
  background-color: #3498db; /* 버튼 색상 */
  color: white; border: none; border-radius: 8px;
  transition: background-color 0.3s;
}
.game-button:hover:not(:disabled) { background-color: #2980b9; }
.game-button:disabled { background-color: #7f8c8d; cursor: not-allowed; }

.game-overlay { position: absolute; inset: 0; background-color: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; border-radius: 12px; }
.end-modal { 
  background-color: #2c3e50; /* 모달 배경색 어둡게 */
  padding: 30px; border-radius: 8px; text-align: center; 
  color: white; 
  box-shadow: 0 5px 15px rgba(0,0,0,0.5);
}
.error-message { margin-top: 15px; color: #e74c3c; text-align: center; font-weight: bold; }
.pop-enter-active, .pop-leave-active { transition: transform 0.3s; }
.pop-enter-from, .pop-leave-to { transform: scale(0); }

/* [신규] 랭킹 섹션 스타일 */
.ranking-section {
  margin-top: 30px;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 20px;
  border-radius: 8px;
  color: #eee;
}
.ranking-section h3 {
  color: #f1c40f; /* 노란색 강조 */
  margin-bottom: 15px;
  font-size: 1.5em;
}
.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.ranking-list li {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
}
.ranking-list li:last-child {
  border-bottom: none;
}
.ranking-list li span:first-child {
  font-weight: bold;
  color: #3498db;
  width: 50px; /* 순위 너비 고정 */
  text-align: left;
}
.ranking-list li span:nth-child(2) {
  flex-grow: 1; /* 사용자 이름이 공간을 채우도록 */
  text-align: left;
  margin-left: 10px;
}
.ranking-list li span:last-child {
  font-weight: bold;
  color: #2ecc71;
  width: 100px; /* 점수 너비 고정 */
  text-align: right;
}
</style>
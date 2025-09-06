<template>
  <div class="salt-pang-page">
    <header class="page-header">
      <h1>💎 솔트팡</h1>
      <p>같은 모양의 소금 결정을 3개 이상 맞춰보세요!</p>
    </header>

    <main class="game-container card">
      <div v-if="gameState === 'ready'" class="game-intro">
        <h2>게임 설정</h2>
        
        <div class="setting-group">
          <h3>게임 모드 선택</h3>
          <div class="mode-selection">
            <button @click="gameMode = 'classic'" :class="{ active: gameMode === 'classic' }">
              클래식 모드 (60초)
            </button>
            <button @click="gameMode = 'timeAttack'" :class="{ active: gameMode === 'timeAttack' }">
              타임 어택 (30초 +)
            </button>
          </div>
          <p class="mode-description">
            <span v-if="gameMode === 'classic'">60초 동안 최대한 높은 점수를 획득하세요!</span>
            <span v-if="gameMode === 'timeAttack'">30초로 시작하여 보석을 맞출 때마다 시간이 추가됩니다!</span>
          </p>
        </div>

        <div class="setting-group">
          <h3>아이템 상점 (SaltMate 사용)</h3>
          <div class="item-shop">
            <div 
              v-for="item in items" :key="item.id" 
              class="item" 
              :class="{ purchased: purchasedItems.has(item.id) }"
              @click="buyItem(item)"
            >
              <div class="item-name">{{ item.name }}</div>
              <div class="item-cost">{{ item.cost }} SP</div>
              <div v-if="purchasedItems.has(item.id)" class="purchased-badge">✓</div>
            </div>
          </div>
        </div>

        <div class="start-info">
          <p>입장료: <strong>{{ currentEntryFee }} SaltMate</strong></p>
          <button @click="startGame" class="game-button" :disabled="isStarting">
            <span v-if="isStarting">입장 중...</span>
            <span v-else>게임 시작</span>
          </button>
        </div>
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
            v-for="(cell, index) in board" :key="index" class="cell"
            @click="selectCell(index)" :class="{ selected: selectedCell === index }"
          >
            <transition name="gem-explode">
              <span v-if="cell !== null && !explodingGems.has(index)" class="gem" :style="{ color: gemColors[cell] }">
                {{ gemIcons[cell] }}
              </span>
            </transition>
          </div>
        </div>
        <div v-if="isScoreBoostActive" class="score-boost-overlay">
          SCORE x2!
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

      <div v-if="gameState === 'playing' && timer <= 5 && timer > 0" class="countdown-overlay">
        {{ timer }}
      </div>
    </main>

    <div v-if="error" class="error-message" @click="error = ''">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, onMounted, computed, reactive } from 'vue';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from 'firebase/auth';
import soundMatch from '@/assets/sounds/match.mp3';
import soundBgm from '@/assets/sounds/bgm.mp3';

// --- 기본 설정 ---
const BOARD_SIZE = 8;
const NUM_GEM_TYPES = 5;
const CLASSIC_DURATION = 60;
const TIME_ATTACK_DURATION = 30;

const gemIcons = ['💎', '🟡', '🟢', '🔵', '🟣', '🔴'];
const gemColors = ['#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e74c3c', '#e67e22'];

// --- 상태 변수 (Refs) ---
const gameState = ref('ready');
const gameMode = ref('classic');
const board = ref([]);
const score = ref(0);
const timer = ref(CLASSIC_DURATION);
const selectedCell = ref(null);
const isProcessing = ref(false);
const isStarting = ref(false);
const error = ref('');
const awardedPoints = ref(0);
const explodingGems = ref(new Set()); 
const playCount = reactive({ classic: 0, timeAttack: 0 });

// --- [신규] 아이템 관련 상태 ---
const items = ref([
  { id: 'time_plus_5', name: '+5초 시간 추가', cost: 150 },
  { id: 'score_x2_10s', name: '10초간 점수 2배', cost: 300 },
]);
const purchasedItems = ref(new Set());
const isScoreBoostActive = ref(false);

// --- 오디오 관련 ---
let audioContextStarted = false;
const isMuted = ref(false);
const sounds = {
  match: new Audio(soundMatch),
  background: new Audio(soundBgm),
  countdownTick: null,
  countdownEnd: null,
};
sounds.background.loop = true;
sounds.background.volume = 0.3;

// --- 내부 변수 ---
let timerInterval = null;
let sessionId = null;
let scoreBoostTimeout = null;

// --- 계산된 속성 (Computed) ---
const currentEntryFee = computed(() => {
  if (gameMode.value === 'classic') {
    if (playCount.classic >= 30) return 300;
    if (playCount.classic >= 15) return 200;
    return 100;
  }
  if (gameMode.value === 'timeAttack') {
    return 150;
  }
  return 100; // 기본값
});

// --- 함수 ---
const fetchPlayCount = async () => {
  if (!auth.currentUser) return;
  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const playCountRef = doc(db, "users", auth.currentUser.uid, "daily_play_counts", todayStr);
  const docSnap = await getDoc(playCountRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    playCount.classic = data.saltPang_classic || 0;
    playCount.timeAttack = data.saltPang_timeAttack || 0;
  } else {
    playCount.classic = 0;
    playCount.timeAttack = 0;
  }
};

const playSound = (soundKey) => {
  if (!isMuted.value && audioContextStarted && sounds[soundKey]) {
    const sound = sounds[soundKey];
    sound.currentTime = 0;
    sound.play().catch(e => console.error(`${soundKey} 사운드 재생 오류:`, e));
  }
};

const initAudioContext = async () => {
  if (!audioContextStarted && window.Tone) {
    await window.Tone.start();
    sounds.countdownTick = new window.Tone.Synth().toDestination();
    sounds.countdownEnd = new window.Tone.Synth().toDestination();
    audioContextStarted = true;
  }
};

const toggleMute = () => {
  isMuted.value = !isMuted.value;
  if (isMuted.value) sounds.background.pause();
  else if (gameState.value === 'playing') sounds.background.play();
};

const createBoard = () => {
  let newBoard;
  do {
    newBoard = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => Math.floor(Math.random() * NUM_GEM_TYPES) + 1);
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

// [신규] 아이템 구매 함수
const buyItem = async (item) => {
  if (purchasedItems.value.has(item.id)) return; // 이미 구매한 아이템
  error.value = '';
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const purchaseItemFunc = httpsCallable(functions, 'purchaseSaltPangItem');
    await purchaseItemFunc({ itemId: item.id });
    purchasedItems.value.add(item.id);
  } catch (err) {
    console.error("아이템 구매 오류:", err);
    error.value = `구매 실패: ${err.message}`;
  }
};

// [수정] 게임 시작 로직 (모드, 아이템 적용)
const startGame = async () => {
  isStarting.value = true;
  error.value = '';
  await initAudioContext();

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const startSession = httpsCallable(functions, 'startSaltPangSession');
    const result = await startSession({ gameMode: gameMode.value });
    sessionId = result.data.sessionId;
    
    // 초기화
    score.value = 0;
    awardedPoints.value = 0;
    board.value = createBoard();
    
    // 게임 모드에 따른 설정
    if (gameMode.value === 'classic') {
      timer.value = CLASSIC_DURATION;
    } else if (gameMode.value === 'timeAttack') {
      timer.value = TIME_ATTACK_DURATION;
    }

    // 아이템 효과 적용
    if (purchasedItems.value.has('time_plus_5')) {
      timer.value += 5;
    }
    if (purchasedItems.value.has('score_x2_10s')) {
      // 10초 뒤에 점수 2배 부스트 활성화
      scoreBoostTimeout = setTimeout(() => {
        isScoreBoostActive.value = true;
        // 10초 뒤에 비활성화
        setTimeout(() => isScoreBoostActive.value = false, 10000);
      }, 10000);
    }
    
    await fetchPlayCount(); 
    gameState.value = 'playing';
    playSound('background');

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer.value--;
      if (timer.value <= 5 && timer.value >= 1 && sounds.countdownTick) {
        sounds.countdownTick.triggerAttackRelease("C5", "8n");
      }
      if (timer.value <= 0) {
        if (sounds.countdownEnd) sounds.countdownEnd.triggerAttackRelease("C6", "1n");
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
  if (timerInterval) clearInterval(timerInterval);
  if (scoreBoostTimeout) clearTimeout(scoreBoostTimeout);
  isScoreBoostActive.value = false;
  gameState.value = 'ended';
  sounds.background.pause();
  sounds.background.currentTime = 0;

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const endSession = httpsCallable(functions, 'endSaltPangSession');
    
    // [수정] username을 보내는 부분을 삭제합니다.
    const result = await endSession({ 
      sessionId: sessionId, 
      score: score.value,
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
  purchasedItems.value.clear(); // 구매한 아이템 초기화
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
    if (Math.abs(row1 - row2) + Math.abs(col1 - col2) === 1) {
      swapAndCheck(selectedCell.value, index);
    }
    selectedCell.value = null;
  }
};

const swapAndCheck = async (index1, index2) => {
  isProcessing.value = true;
  [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  await new Promise(r => setTimeout(r, 150));
  
  const hasMatches = await checkAndClearMatches();
  if (!hasMatches) {
    await new Promise(r => setTimeout(r, 150));
    [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  } else {
    while (await processBoard());
  }
  isProcessing.value = false;
};

const processBoard = async () => {
  await new Promise(r => setTimeout(r, 200));
  dropDownGems();
  fillEmptyCells();
  await new Promise(r => setTimeout(r, 200));
  return await checkAndClearMatches();
};

const checkAndClearMatches = async () => {
  const matches = new Set();
  // 가로/세로 매치 검사 로직 (기존과 동일)
  for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE - 2; c++) { let i = r * BOARD_SIZE + c; if (board.value[i] && board.value[i] === board.value[i+1] && board.value[i] === board.value[i+2]) for (let k=c; k<BOARD_SIZE; k++) { i = r * BOARD_SIZE + k; if (board.value[i] === board.value[r*BOARD_SIZE+c]) matches.add(i); else break; } }
  for (let c = 0; c < BOARD_SIZE; c++) for (let r = 0; r < BOARD_SIZE - 2; r++) { let i = r * BOARD_SIZE + c; if (board.value[i] && board.value[i] === board.value[i+BOARD_SIZE] && board.value[i] === board.value[i+2*BOARD_SIZE]) for (let k=r; k<BOARD_SIZE; k++) { i = k * BOARD_SIZE + c; if (board.value[i] === board.value[r*BOARD_SIZE+c]) matches.add(i); else break; } }
  
  if (matches.size > 0) {
    playSound('match');

    // [수정] 게임 모드 및 아이템 효과 적용
    if (gameMode.value === 'timeAttack') {
      timer.value += 1; // 타임 어택 모드: 시간 추가
    }
    let scoreMultiplier = 1;
    if (isScoreBoostActive.value) {
      scoreMultiplier = 2; // 점수 2배 부스터
    }

    score.value += matches.size * 10 * (matches.size > 3 ? 2 : 1) * scoreMultiplier;
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
      if (board.value[i] === null && emptyRow === -1) emptyRow = r;
      else if (board.value[i] !== null && emptyRow !== -1) {
        board.value[emptyRow * BOARD_SIZE + c] = board.value[i];
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
  if (timerInterval) clearInterval(timerInterval);
  if (scoreBoostTimeout) clearTimeout(scoreBoostTimeout);
  sounds.background.pause();
});
</script>

<style scoped>
/* 기존 스타일 ... */
.salt-pang-page { max-width: 500px; margin: 70px auto; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.game-container { padding: 20px; background: #fff; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); position: relative; }
.game-intro { text-align: center; }
.game-stats { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 1.2em; }
.game-board { display: grid; gap: 4px; border: 2px solid #ccc; padding: 5px; border-radius: 8px; }
.cell { width: 50px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: #f0f0f0; border-radius: 4px; cursor: pointer; position: relative; overflow: hidden; }
.cell.selected { background-color: #a0a0a0; }
.gem { font-size: 2em; user-select: none; transition: transform 0.2s; position: absolute; }
.game-button { padding: 12px 25px; font-size: 1.1em; cursor: pointer; border-radius: 8px; border: none; background-color: #007bff; color: white; font-weight: bold; }
.game-overlay { position: absolute; inset: 0; background-color: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; border-radius: 12px; z-index: 20; }
.end-modal { background-color: white; padding: 30px; border-radius: 8px; text-align: center; color: #333; }
.error-message { margin-top: 15px; color: red; text-align: center; cursor: pointer; }
.mute-button { background: none; border: 1px solid #ccc; width: 40px; height: 40px; border-radius: 50%; font-size: 1em; cursor: pointer; color: #555; }
.countdown-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10em; font-weight: 900; color: rgba(220, 53, 69, 0.7); text-shadow: 0 0 20px rgba(255, 255, 255, 0.7); animation: countdown-pulse 1s ease-in-out infinite; pointer-events: none; z-index: 10; }
@keyframes countdown-pulse { from { transform: translate(-50%, -50%) scale(1); opacity: 0.7; } to { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } }
.gem-explode-enter-active, .gem-explode-leave-active { transition: all 0.3s ease-out; }
.gem-explode-enter-from, .gem-explode-leave-to { opacity: 0; transform: scale(2) rotate(45deg); }

/* --- 신규 스타일 --- */
.setting-group { margin-bottom: 25px; border-top: 1px solid #eee; padding-top: 20px; }
.setting-group h3 { margin-bottom: 10px; color: #333; }
.mode-selection { display: flex; gap: 10px; justify-content: center; }
.mode-selection button { padding: 10px 15px; border: 1px solid #ccc; background-color: #f8f9fa; cursor: pointer; border-radius: 8px; font-weight: bold; transition: all 0.2s; }
.mode-selection button.active { background-color: #007bff; color: white; border-color: #007bff; }
.mode-description { margin-top: 10px; color: #666; font-size: 0.9em; min-height: 2.7em; }
.item-shop { display: flex; justify-content: center; gap: 10px; }
.item { border: 1px solid #ccc; border-radius: 8px; padding: 10px; cursor: pointer; text-align: center; transition: all 0.2s; position: relative; }
.item:hover { border-color: #007bff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.item.purchased { background-color: #d4edda; border-color: #c3e6cb; color: #155724; }
.item-name { font-weight: bold; }
.item-cost { font-size: 0.9em; color: #007bff; }
.purchased-badge { position: absolute; top: -10px; right: -10px; background-color: #28a745; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
.start-info { border-top: 1px solid #eee; padding-top: 20px; }
.score-boost-overlay {
  position: absolute;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 2em;
  font-weight: bold;
  color: #e67e22;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 5px 15px;
  border-radius: 20px;
  z-index: 15;
  animation: boost-fade 10s linear forwards;
}
@keyframes boost-fade { from { opacity: 1; } to { opacity: 0; } }

/* 반응형 스타일 */
@media (max-width: 480px) {
  /* ... 기존 반응형 스타일 ... */
  .cell { width: 11vw; height: 11vw; }
  .gem { font-size: 7vw; }
  .game-stats { font-size: 1em; }
  .page-header h1 { font-size: 1.8em; }
}
</style>
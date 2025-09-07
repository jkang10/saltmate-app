<template>
  <div class="salt-pang-page">
    <header class="page-header">
      <h1>💎 솔트팡</h1>
      <p>같은 모양의 소금 결정을 3개 이상 맞춰보세요!</p>
    </header>

    <main class="game-container card">
      <div v-if="gameState === 'ready'" class="game-intro">
        <h2 class="main-title">게임 설정</h2>
        
        <div class="intro-section mission-section">
          <h3 class="section-title"><i class="fas fa-tasks"></i> 오늘의 미션</h3>
          <div v-if="missions.daily.length > 0" class="mission-list">
            <div v-for="mission in missions.daily" :key="mission.missionId" class="mission-item">
              <div class="mission-desc">{{ mission.description }}</div>
              <div class="mission-progress-bar">
                <div class="progress" :style="{ width: `${Math.min(100, (mission.progress / mission.targetCount) * 100)}%` }"></div>
              </div>
              <div class="mission-status">
                <span v-if="mission.completed && mission.claimed" class="claimed">✓ 완료</span>
                <button v-else-if="mission.completed && !mission.claimed" @click="claimReward(mission)" class="claim-button">
                  보상 받기 (+{{ mission.reward }} SP)
                </button>
                <span v-else>{{ mission.progress }} / {{ mission.targetCount }}</span>
              </div>
            </div>
          </div>
          <p v-else>일일 미션을 불러오는 중...</p>
          
          <h3 class="section-title weekly"><i class="fas fa-calendar-week"></i> 이번 주 미션</h3>
          <div v-if="missions.weekly.length > 0" class="mission-list">
             <div v-for="mission in missions.weekly" :key="mission.missionId" class="mission-item">
              <div class="mission-desc">{{ mission.description }}</div>
              <div class="mission-progress-bar">
                <div class="progress" :style="{ width: `${Math.min(100, (mission.progress / mission.targetCount) * 100)}%` }"></div>
              </div>
              <div class="mission-status">
                <span v-if="mission.completed && mission.claimed" class="claimed">✓ 완료</span>
                <button v-else-if="mission.completed && !mission.claimed" @click="claimReward(mission)" class="claim-button">
                  보상 받기 (+{{ mission.reward }} SP)
                </button>
                <span v-else>{{ mission.progress }} / {{ mission.targetCount }}</span>
              </div>
            </div>
          </div>
          <p v-else>주간 미션을 불러오는 중...</p>
        </div>

        <div class="intro-section mode-section">
          <h3 class="section-title"><i class="fas fa-gamepad"></i> 게임 모드 선택</h3>
          <div class="mode-selection">
            <div class="mode-card" :class="{ active: gameMode === 'classic' }" @click="selectGameMode('classic')">
              <h4>클래식</h4>
              <p>60초 시간 제한</p>
            </div>
            <div class="mode-card" :class="{ active: gameMode === 'timeAttack' }" @click="selectGameMode('timeAttack')">
              <h4>타임 어택</h4>
              <p>30초 + 추가 시간</p>
            </div>
            <div class="mode-card" :class="{ active: gameMode === 'infinite' }" @click="selectGameMode('infinite')">
              <h4>무한 모드</h4>
              <p>30회 이동 제한</p>
            </div>
            <div class="mode-card ranked" :class="{ active: gameMode === 'ranked' }" @click="selectGameMode('ranked')" :disabled="!isRankedPlayable">
              <h4>랭킹전</h4>
              <p>주말 전용</p>
            </div>
          </div>
        </div>

        <div class="intro-section item-section">
           <h3 class="section-title"><i class="fas fa-shopping-cart"></i> 아이템 상점</h3>
           <div class="item-shop">
            <div v-for="item in items" :key="item.id" class="item" :class="{ purchased: purchasedItems.has(item.id) }" @click="buyItem(item)">
              <div class="item-icon">{{ item.icon }}</div>
              <div class="item-name">{{ item.name }}</div>
              <div class="item-cost">{{ item.cost }} SP</div>
              <div v-if="purchasedItems.has(item.id)" class="purchased-badge">✓</div>
            </div>
          </div>
          <p v-if="gameMode === 'timeAttack'" class="item-notice">
            아이템을 클릭하면 잠시 후 녹색 체크(✓)가 표시됩니다.
          </p>
        </div>

        <div class="start-info">
          <div class="entry-fee">
            <p>입장료</p>
            <strong>{{ currentEntryFee }} SaltMate</strong>
          </div>
          <button @click="startGame" class="game-button" :disabled="isStarting || isBuyingItem">
            <span v-if="isStarting">입장 중...</span>
            <span v-else-if="isBuyingItem">구매 중...</span>
            <span v-else>GAME START</span>
          </button>
        </div>
      </div>

      <div v-if="gameState === 'playing' || gameState === 'ended'" class="game-area">
        <div class="game-stats">
          <div class="stat-item" v-if="gameMode === 'infinite'">이동: <strong>{{ movesLeft }} / {{ INFINITE_MODE_MOVES }}</strong></div>
          <div class="stat-item" v-else>시간: <strong>{{ timer }}</strong></div>
          <button @click="toggleMute" class="mute-button">
            <i :class="isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up'"></i>
          </button>
          <div class="stat-item">점수: <strong>{{ score.toLocaleString() }}</strong></div>
        </div>
        <div class="game-board" :style="{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }">
          <div
            v-for="(cell, index) in board" :key="index" class="cell"
            @click="selectCell(index)"
            :class="{ selected: selectedCell === index }"
            @touchstart="handleTouchStart(index, $event)"
            @touchmove="handleTouchMove($event)"
            @touchend="handleTouchEnd()"
          >
            <transition name="gem-fall">
              <img
                v-if="cell !== null"
                :src="getGemImage(cell)"
                class="gem-image"
                :class="{ 'clearing': explodingGems.has(index) }"
                alt="Gem"
              />
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

      <div v-if="gameState === 'playing' && timer <= 5 && timer > 0 && gameMode !== 'infinite'" class="countdown-overlay">
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
import soundMatch from '@/assets/sounds/match.mp3';
import soundBgm from '@/assets/sounds/bgm.mp3';

// --- 기본 설정 ---
const BOARD_SIZE = 8;
const NUM_GEM_TYPES = 5;
const CLASSIC_DURATION = 60;
const TIME_ATTACK_DURATION = 30;
const INFINITE_MODE_MOVES = 30;

// --- 상태 변수 (Refs) ---
const gameState = ref('ready');
const gameMode = ref('classic');
const board = ref([]);
const score = ref(0);
const timer = ref(CLASSIC_DURATION);
const movesLeft = ref(INFINITE_MODE_MOVES);
const selectedCell = ref(null);
const isProcessing = ref(false);
const isStarting = ref(false);
const isBuyingItem = ref(false);
const error = ref('');
const awardedPoints = ref(0);
const explodingGems = ref(new Set()); 
const playCount = reactive({ classic: 0, timeAttack: 0 });

// --- 아이템 관련 상태 ---
const items = ref([
  { id: 'time_plus_5', name: '+5초 시간 추가', cost: 150, icon: '⏱️' },
  { id: 'score_x2_10s', name: '10초간 점수 2배', cost: 300, icon: '🚀' },
]);
const purchasedItems = ref(new Set());
const isScoreBoostActive = ref(false);

// --- 미션 관련 상태 ---
const missions = reactive({ daily: [], weekly: [] });
const gameStats = reactive({
  gemsMatched: {},
  maxCombo: 0,
  jackpotGemsMatched: 0,
  playCount: 0,
});
let currentCombo = 0;

// --- 스와이프 관련 상태 ---
const touchStart = reactive({ index: null, x: 0, y: 0 });
const hasSwiped = ref(false);

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
const isRankedPlayable = computed(() => {
  const today = new Date();
  const day = today.getDay();
  return day === 0 || day === 6;
});

const currentEntryFee = computed(() => {
  if (gameMode.value === 'classic') {
    if (playCount.classic >= 30) return 300;
    if (playCount.classic >= 15) return 200;
    return 100;
  }
  if (gameMode.value === 'timeAttack') { 
    return "400 ~";
  }
  if (gameMode.value === 'infinite') return 200;
  if (gameMode.value === 'ranked') return 500;
  return 100;
});

// --- 함수 ---
const getGemImage = (gemType) => {
  if (gemType === null) return '';
  try {
    return require(`@/assets/gems/gem_${gemType}.png`);
  } catch (e) {
    return require(`@/assets/logo.png`); 
  }
};

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

const fetchMissions = async () => {
  error.value = '';
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const getMissionsFunc = httpsCallable(functions, 'getOrAssignSaltPangMissions');
    const result = await getMissionsFunc();
    missions.daily = result.data.daily;
    missions.weekly = result.data.weekly;
  } catch (err) {
    console.error("미션 불러오기 오류:", err);
    error.value = `미션 로딩 실패: ${err.message}`;
  }
};

const claimReward = async (mission) => {
  error.value = '';
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const claimRewardFunc = httpsCallable(functions, 'claimSaltPangMissionReward');
    await claimRewardFunc({ missionId: mission.missionId });
    mission.claimed = true;
  } catch(err) {
    console.error("미션 보상 수령 오류:", err);
    error.value = `보상 수령 실패: ${err.message}`;
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
    newBoard = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => {
      if (Math.random() < 0.005) return 6;
      return Math.floor(Math.random() * NUM_GEM_TYPES) + 1;
    });
  } while (hasInitialMatches(newBoard)); 
  return newBoard;
};

const hasInitialMatches = (b) => {
  for (let r=0; r<BOARD_SIZE; r++) for (let c=0; c<BOARD_SIZE-2; c++) { const i=r*BOARD_SIZE+c; if (b[i]&&b[i]===b[i+1]&&b[i]===b[i+2]) return true; }
  for (let c=0; c<BOARD_SIZE; c++) for (let r=0; r<BOARD_SIZE-2; r++) { const i=r*BOARD_SIZE+c; if (b[i]&&b[i]===b[i+BOARD_SIZE]&&b[i]===b[i+2*BOARD_SIZE]) return true; }
  return false;
};

const buyItem = async (item) => {
  if (purchasedItems.value.has(item.id) || isBuyingItem.value) return;
  error.value = '';
  isBuyingItem.value = true;
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const purchaseItemFunc = httpsCallable(functions, 'purchaseSaltPangItem');
    await purchaseItemFunc({ itemId: item.id });
    purchasedItems.value.add(item.id);
  } catch (err) {
    console.error("아이템 구매 오류:", err);
    error.value = `구매 실패: ${err.message}`;
  } finally {
    isBuyingItem.value = false;
  }
};

const selectGameMode = (mode) => {
  if (mode === 'ranked' && !isRankedPlayable.value) {
    error.value = '랭킹전은 토요일과 일요일에만 참여할 수 있습니다.';
    return;
  }
  error.value = '';
  gameMode.value = mode;
};

const startGame = async () => {
  isStarting.value = true;
  error.value = '';
  await initAudioContext();

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const startSession = httpsCallable(functions, 'startSaltPangSession');
    const result = await startSession({ gameMode: gameMode.value });
    sessionId = result.data.sessionId;
    
    score.value = 0;
    awardedPoints.value = 0;
    board.value = createBoard();
    
    gameStats.gemsMatched = {};
    gameStats.maxCombo = 0;
    gameStats.jackpotGemsMatched = 0;
    gameStats.playCount = 1;
    currentCombo = 0;

    if (gameMode.value === 'classic') timer.value = CLASSIC_DURATION;
    else if (gameMode.value === 'timeAttack') timer.value = TIME_ATTACK_DURATION;
    else if (gameMode.value === 'infinite') {
      timer.value = 0;
      movesLeft.value = INFINITE_MODE_MOVES;
    } else if (gameMode.value === 'ranked') {
        timer.value = CLASSIC_DURATION;
    }

    if (purchasedItems.value.has('time_plus_5') && gameMode.value !== 'infinite') timer.value += 5;
    if (purchasedItems.value.has('score_x2_10s')) {
      scoreBoostTimeout = setTimeout(() => {
        isScoreBoostActive.value = true;
        setTimeout(() => isScoreBoostActive.value = false, 10000);
      }, 10000);
    }
    
    await fetchPlayCount(); 
    gameState.value = 'playing';
    playSound('background');

    if (gameMode.value !== 'infinite') {
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        timer.value--;
        if (timer.value <= 5 && timer.value >= 1 && sounds.countdownTick) sounds.countdownTick.triggerAttackRelease("C5", "8n");
        if (timer.value <= 0) {
          if (sounds.countdownEnd) sounds.countdownEnd.triggerAttackRelease("C6", "1n");
          endGame();
        }
      }, 1000);
    }

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
    
    const result = await endSession({ 
      sessionId: sessionId, 
      score: score.value,
      gameStats: {
        gemsMatched: gameStats.gemsMatched,
        maxCombo: gameStats.maxCombo,
        jackpotGemsMatched: gameStats.jackpotGemsMatched,
        playCount: gameStats.playCount,
      }
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
  purchasedItems.value.clear();
  explodingGems.value.clear();
  await fetchPlayCount();
  await fetchMissions();
};

const handleTouchStart = (index, event) => {
  if (isProcessing.value || gameState.value !== 'playing') return;
  touchStart.index = index;
  touchStart.x = event.touches[0].clientX;
  touchStart.y = event.touches[0].clientY;
  hasSwiped.value = false;
};

const handleTouchMove = (event) => {
  if (touchStart.index === null || hasSwiped.value) return;

  const dx = event.touches[0].clientX - touchStart.x;
  const dy = event.touches[0].clientY - touchStart.y;
  const SWIPE_THRESHOLD = 20;

  if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
    hasSwiped.value = true;
    let targetIndex = -1;
    const { index } = touchStart;
    const col = index % BOARD_SIZE;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && col < BOARD_SIZE - 1) targetIndex = index + 1;
      else if (dx < 0 && col > 0) targetIndex = index - 1;
    } else {
      if (dy > 0) targetIndex = index + BOARD_SIZE;
      else if (dy < 0) targetIndex = index - BOARD_SIZE;
    }

    if (targetIndex >= 0 && targetIndex < BOARD_SIZE * BOARD_SIZE) {
      swapAndCheck(index, targetIndex);
    }
  }
};

const handleTouchEnd = () => {
  touchStart.index = null;
};

const selectCell = (index) => {
  if (hasSwiped.value || isProcessing.value || gameState.value !== 'playing') return;
  initAudioContext();
  if (selectedCell.value === null) {
    selectedCell.value = index;
  } else {
    const r1=Math.floor(selectedCell.value/BOARD_SIZE), c1=selectedCell.value%BOARD_SIZE;
    const r2=Math.floor(index/BOARD_SIZE), c2=index%BOARD_SIZE;
    if (Math.abs(r1-r2)+Math.abs(c1-c2)===1) swapAndCheck(selectedCell.value, index);
    selectedCell.value = null;
  }
};

const swapAndCheck = async (index1, index2) => {
  if (gameMode.value === 'infinite') {
    if (movesLeft.value <= 0) return;
    movesLeft.value--;
  }
  isProcessing.value = true;
  [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  await new Promise(r => setTimeout(r, 150));
  
  const hasMatches = await checkAndClearMatches();
  if (!hasMatches) {
    await new Promise(r => setTimeout(r, 150));
    [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
    currentCombo = 0;
    if (gameMode.value === 'infinite' && movesLeft.value === 0) endGame();
  } else {
    while (await processBoard());
    if (gameMode.value === 'infinite' && movesLeft.value === 0) endGame();
  }
  isProcessing.value = false;
};

const processBoard = async () => {
  await new Promise(r => setTimeout(r, 200));
  dropDownGems();
  await new Promise(r => setTimeout(r, 200));
  fillEmptyCells();
  await new Promise(r => setTimeout(r, 200));
  const hasMoreMatches = await checkAndClearMatches();
  if (!hasMoreMatches) {
    currentCombo = 0;
  }
  return hasMoreMatches;
};

const checkAndClearMatches = async () => {
  const matches = new Set();
  for (let r=0; r<BOARD_SIZE; r++) for (let c=0; c<BOARD_SIZE-2; c++) { let i=r*BOARD_SIZE+c; if (board.value[i]&&board.value[i]===board.value[i+1]&&board.value[i]===board.value[i+2]) for(let k=c;k<BOARD_SIZE;k++){ i=r*BOARD_SIZE+k; if(board.value[i]===board.value[r*BOARD_SIZE+c]) matches.add(i); else break;} }
  for (let c=0; c<BOARD_SIZE; c++) for (let r=0; r<BOARD_SIZE-2; r++) { let i=r*BOARD_SIZE+c; if (board.value[i]&&board.value[i]===board.value[i+BOARD_SIZE]&&board.value[i]===board.value[i+2*BOARD_SIZE]) for(let k=r;k<BOARD_SIZE;k++){ i=k*BOARD_SIZE+c; if(board.value[i]===board.value[r*BOARD_SIZE+c]) matches.add(i); else break;} }
  
  if (matches.size > 0) {
    playSound('match');
    
    currentCombo++;
    if (currentCombo > gameStats.maxCombo) gameStats.maxCombo = currentCombo;
    
    matches.forEach(index => {
      explodingGems.value.add(index);
      const gemType = board.value[index];
      if (gemType) {
        if(gemType === 6) gameStats.jackpotGemsMatched++;
        gameStats.gemsMatched[gemType] = (gameStats.gemsMatched[gemType] || 0) + 1;
      }
    });

    if (gameMode.value === 'timeAttack') timer.value += 1;
    let scoreMultiplier = 1;
    if (isScoreBoostActive.value) scoreMultiplier = 2;
    score.value += matches.size * 10 * (matches.size > 3 ? 2 : 1) * scoreMultiplier;
    
    await new Promise(r => setTimeout(r, 300));
    matches.forEach(index => {
      board.value[index] = null;
      explodingGems.value.delete(index);
    });
    return true;
  }
  return false;
};

const dropDownGems = () => {
  for(let c=0;c<BOARD_SIZE;c++){ let er=-1; for(let r=BOARD_SIZE-1;r>=0;r--){ const i=r*BOARD_SIZE+c; if(board.value[i]===null&&er===-1)er=r; else if(board.value[i]!==null&&er!==-1){ board.value[er*BOARD_SIZE+c]=board.value[i]; board.value[i]=null; er--; } } }
};

const fillEmptyCells = () => {
  for(let i=0;i<board.value.length;i++){ if(board.value[i]===null){ board.value[i]=Math.floor(Math.random()*NUM_GEM_TYPES)+1; } }
};

onMounted(() => {
  fetchPlayCount();
  fetchMissions();
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (scoreBoostTimeout) clearTimeout(scoreBoostTimeout);
  sounds.background.pause();
});
</script>

<style scoped>
.salt-pang-page { max-width: 500px; margin: 70px auto; padding: 15px; }
.page-header { text-align: center; margin-bottom: 20px; color: #333; }
.page-header h1 { font-size: 2.5em; font-weight: 900; }
.page-header p { font-size: 1.1em; color: #666; }
.game-container { padding: 10px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); position: relative; }
.game-intro { display: flex; flex-direction: column; gap: 15px; }
.main-title { text-align: center; }
.intro-section { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.07); }
.section-title { font-size: 1.3em; font-weight: bold; margin: 0 0 15px 0; display: flex; align-items: center; gap: 8px; color: #007bff; }
.section-title.weekly { margin-top: 20px; }

.mission-list { display: flex; flex-direction: column; gap: 12px; }
.mission-item { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 5px 15px; padding: 10px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; }
.mission-desc { font-weight: 500; text-align: left; }
.mission-progress-bar { grid-column: 1 / 3; width: 100%; height: 8px; background-color: #e9ecef; border-radius: 4px; overflow: hidden; }
.progress { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
.mission-status { text-align: right; font-size: 0.9em; }
.claimed { color: #28a745; font-weight: bold; }
.claim-button { padding: 5px 10px; font-size: 0.8em; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; }

.mode-selection { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.mode-card { padding: 15px; border: 2px solid #e9ecef; border-radius: 10px; cursor: pointer; transition: all 0.2s ease-in-out; text-align: center; }
.mode-card:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); }
.mode-card.active { border-color: #007bff; background-color: #e7f1ff; box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25); }
.mode-card h4 { margin: 0 0 5px; font-size: 1.1em; }
.mode-card p { margin: 0; color: #666; font-size: 0.9em; }
.mode-card.ranked { border-style: dashed; }
.mode-card.ranked.active { border-color: #dc3545; background-color: #ffe8e8; }
.mode-card:disabled { opacity: 0.6; cursor: not-allowed; background-color: #f8f9fa; }
.mode-card:disabled:hover { transform: none; box-shadow: none; }

.item-shop { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.item { padding: 15px; border: 2px solid #e9ecef; border-radius: 10px; cursor: pointer; transition: all 0.2s ease-in-out; text-align: center; position: relative; }
.item:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); }
.item.purchased { border-color: #28a745; background-color: #eafaf1; box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.25); }
.item-icon { font-size: 1.5em; }
.item-name { font-weight: bold; margin: 5px 0; }
.item-cost { font-size: 1em; color: #007bff; font-weight: 500; }
.purchased-badge { position: absolute; top: 5px; right: 5px; background-color: #28a745; color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.start-info { display: flex; justify-content: space-between; align-items: center; background: white; padding: 15px 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.07); }
.entry-fee p { margin: 0; color: #666; }
.entry-fee strong { font-size: 1.3em; color: #333; }
.game-button { padding: 15px 30px; font-size: 1.2em; cursor: pointer; border-radius: 10px; border: none; background: linear-gradient(135deg, #007bff, #0056b3); color: white; font-weight: bold; transition: all 0.3s ease; }
.game-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 123, 255, 0.4); }
.game-button:disabled { background: #a0c9ff; cursor: not-allowed; }
.item-notice { margin-top: 10px; font-size: 0.9em; color: #007bff; font-weight: 500; text-align: center; }

.game-area { position: relative; }
.game-stats { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 1.2em; }
.game-board { display: grid; gap: 4px; border: 2px solid #ccc; padding: 5px; border-radius: 8px; touch-action: none; }
.cell { width: 50px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: #f0f0f0; border-radius: 4px; cursor: pointer; position: relative; overflow: hidden; }
.cell.selected { background-color: #e0e0e0; transform: scale(0.95); }
.gem-image { width: 90%; height: 90%; object-fit: contain; user-select: none; position: absolute; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.cell.selected .gem-image { transform: scale(1.15); filter: brightness(1.2); }
.gem-image.clearing { animation: gem-clear 0.3s ease-out forwards; }
@keyframes gem-clear { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
.gem-fall-enter-active { animation: gem-fall 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes gem-fall { 0% { transform: translateY(-50px) scale(0.5); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
.game-overlay { position: absolute; inset: 0; background-color: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; border-radius: 12px; z-index: 20; }
.end-modal { background-color: white; padding: 30px; border-radius: 8px; text-align: center; color: #333; }
.error-message { margin-top: 15px; color: red; text-align: center; cursor: pointer; }
.mute-button { background: none; border: 1px solid #ccc; width: 40px; height: 40px; border-radius: 50%; font-size: 1em; cursor: pointer; color: #555; }
.countdown-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 10em; font-weight: 900; color: rgba(220, 53, 69, 0.7); text-shadow: 0 0 20px rgba(255, 255, 255, 0.7); animation: countdown-pulse 1s ease-in-out infinite; pointer-events: none; z-index: 10; }
@keyframes countdown-pulse { from { transform: translate(-50%, -50%) scale(1); opacity: 0.7; } to { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } }
.score-boost-overlay { position: absolute; top: 100px; left: 50%; transform: translateX(-50%); font-size: 2em; font-weight: bold; color: #e67e22; background-color: rgba(255, 255, 255, 0.9); padding: 5px 15px; border-radius: 20px; z-index: 15; animation: boost-fade 10s linear forwards; }
@keyframes boost-fade { from { opacity: 1; } to { opacity: 0; } }
.mode-description { margin-top: 10px; color: #666; font-size: 0.9em; min-height: 1em; }
.ranked-notice { color: #dc3545; font-weight: 500; }

@media (max-width: 480px) {
  .cell { width: 11vw; height: 11vw; }
  .game-stats { font-size: 1em; }
  .page-header h1 { font-size: 1.8em; }
}
</style>
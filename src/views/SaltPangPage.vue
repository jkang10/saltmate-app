<template>
  <div class="salt-pang-page">
    <transition name="jackpot-fade">
      <div v-if="jackpotEffect.active" class="jackpot-effect-overlay">
        <div class="jackpot-content">
          <div class="jackpot-title">JACKPOT!</div>
          <div class="jackpot-prize">{{ jackpotEffect.amount.toLocaleString() }} SP!</div>
        </div>
      </div>
    </transition>
    <header class="page-header">
      <h1>💎 솔트팡</h1>
      <p>같은 모양의 소금 결정을 3개 이상 맞춰보세요!</p>
    </header>

    <main class="game-container card">
      <div v-if="gameState === 'ready'" class="game-intro">
        <div class="intro-section jackpot-section">
          <h3 class="section-title"><i class="fas fa-gem jackpot-icon"></i> 현재 잭팟 금액</h3>
          <div class="jackpot-amount">
            {{ jackpotAmount.toLocaleString() }} SaltMate
          </div>
        </div>

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
	  <div v-for="item in items" :key="item.id" class="item" 
	       :class="{ purchased: purchasedItems.has(item.id) }" 
	       @click="toggleItemSelection(item.id)">
	    <input type="checkbox" :checked="purchasedItems.has(item.id)" class="item-checkbox" @click.stop>
	    <div class="item-icon">{{ item.icon }}</div>
	    <div class="item-info">
	      <div class="item-name">{{ item.name }}</div>
	      <div v-if="getCouponCount(item.id) > 0" class="item-cost coupon">
		쿠폰 사용 ({{ getCouponCount(item.id) }}개 보유)
	      </div>
	      <div v-else class="item-cost">{{ item.cost }} SP</div>
	    </div>
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
        <div
          class="game-board"
          :style="{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }"
        >
          <div
            v-for="(cell, index) in board"
            :key="index"
            class="cell"
            :class="{ selected: selectedCell === index }"
            
            @mousedown="handleCellInteraction(index, 'down')"
            @mouseup="handleCellInteraction(index, 'up')"
            @mouseenter="handleCellInteraction(index, 'enter')"
            @dragstart.prevent

            @touchstart.prevent="handleTouchStart(index, $event)"
            @touchmove="handleTouchMove($event)"
            @touchend="handleTouchEnd()"
          >
            <transition name="gem-fall">
              <div v-if="cell !== null" class="gem-image-wrapper" :class="getSpecialGemClass(cell)">
                <img
                  :src="getGemImage(cell)"
                  class="gem-image"
                  :class="{ 
                    'clearing': explodingGems.has(index),
                    'special-clear': explodingGems.has(index) && explodingGems.size >= 4
                  }"
                  alt="Gem"
                />
                <div class="gem-special-effect"></div>
              </div>
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
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";import soundMatch from '@/assets/sounds/match.mp3';
import soundBgm from '@/assets/sounds/bgm.mp3';

// --- 기본 설정 ---
const BOARD_SIZE = 8;
const NUM_GEM_TYPES = 5;
const CLASSIC_DURATION = 60;
const TIME_ATTACK_DURATION = 30;
const INFINITE_MODE_MOVES = 30;

// --- 상태 변수 ---
const jackpotAmount = ref(0);
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
const jackpotEffect = reactive({ active: false, amount: 0 });

// [신규] 보유한 아이템 쿠폰을 저장할 변수
const itemCoupons = reactive({
  SALTPANG_TIME_PLUS_5: 0,
  SALTPANG_SCORE_X2_10S: 0,
});

// 아이템 관련 상태
const items = ref([
  { id: 'time_plus_5', name: '+5초 시간 추가', cost: 150, icon: '⏱️' },
  { id: 'score_x2_10s', name: '10초간 점수 2배', cost: 300, icon: '🚀' },
]);
const purchasedItems = ref(new Set());
const isScoreBoostActive = ref(false);

// 미션 관련 상태
const missions = reactive({ daily: [], weekly: [] });
const gameStats = reactive({
  gemsMatched: {},
  maxCombo: 0,
  jackpotGemsMatched: 0,
  playCount: 0,
});
let currentCombo = 0;

// 모바일 스와이프 관련 상태
const touchStart = reactive({ index: null, x: 0, y: 0 });
const hasSwiped = ref(false);

// PC 드래그 상태
const isDragging = ref(false);
const mouseDownIndex = ref(null);
const preventClick = ref(false);

// 오디오 관련
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

// 내부 변수
let timerInterval = null;
let sessionId = null;
let scoreBoostTimeout = null;
let lastMoveDirection = 'h';

// --- 계산된 속성 ---
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
  if (gameMode.value === 'timeAttack') return "400 ~";
  if (gameMode.value === 'infinite') return 300;
  if (gameMode.value === 'ranked') return 500;
  return 100;
});

// --- 함수 ---
const handleCellInteraction = (index, eventType) => {
  if (isProcessing.value || gameState.value !== 'playing') return;
  initAudioContext();

  const clickedGem = board.value[index];

  if (eventType === 'down') {
    mouseDownIndex.value = index;
    isDragging.value = true;
    preventClick.value = false;
    if (clickedGem?.special === 'rainbow') {
      selectedCell.value = index;
      return;
    }
  } 
  else if (eventType === 'up') {
    if (preventClick.value) {
      isDragging.value = false;
      mouseDownIndex.value = null;
      return;
    }
    
    isDragging.value = false;
    mouseDownIndex.value = null;

    if (selectedCell.value === index) {
      selectedCell.value = null;
      return;
    }

    if (selectedCell.value !== null) {
      const r1 = Math.floor(selectedCell.value / BOARD_SIZE);
      const c1 = selectedCell.value % BOARD_SIZE;
      const r2 = Math.floor(index / BOARD_SIZE);
      const c2 = index % BOARD_SIZE;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
        swapAndCheck(selectedCell.value, index);
      } else {
        selectedCell.value = index;
      }
    } else {
      selectedCell.value = index;
    }
  } 
  else if (eventType === 'enter') {
    if (!isDragging.value || mouseDownIndex.value === null || mouseDownIndex.value === index) return;

    preventClick.value = true; 
    const index1 = mouseDownIndex.value;
    const index2 = index;

    isDragging.value = false;
    mouseDownIndex.value = null;

    const r1 = Math.floor(index1 / BOARD_SIZE);
    const c1 = index1 % BOARD_SIZE;
    const r2 = Math.floor(index2 / BOARD_SIZE);
    const c2 = index2 % BOARD_SIZE;
    
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
      swapAndCheck(index1, index2);
    }
  }
};

// ▼▼▼ 이 함수 전체를 추가해주세요 ▼▼▼
const getCouponCount = (itemId) => {
  const couponType = itemId === 'time_plus_5' ? 'SALTPANG_TIME_PLUS_5' : 'SALTPANG_SCORE_X2_10S';
  return itemCoupons[couponType] || 0;
};

// [신규] 보유한 아이템 쿠폰 개수를 가져오는 함수
const fetchItemCoupons = async () => {
  if (!auth.currentUser) return;
  try {
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/coupons`),
      where('status', '==', 'unused'),
      where('type', 'in', ['SALTPANG_TIME_PLUS_5', 'SALTPANG_SCORE_X2_10S'])
    );
    const snapshot = await getDocs(q);
    const counts = { SALTPANG_TIME_PLUS_5: 0, SALTPANG_SCORE_X2_10S: 0 };
    snapshot.forEach(doc => {
      const coupon = doc.data();
      if (counts[coupon.type] !== undefined) {
        counts[coupon.type] += coupon.quantity || 1;
      }
    });
    Object.assign(itemCoupons, counts);
  } catch (error) {
    console.error("아이템 쿠폰 정보 로딩 실패:", error);
  }
};

const getGemImage = (gem) => {
  if (gem === null) return '';
  try {
    const type = typeof gem === 'object' ? gem.type : gem;
    return require(`@/assets/gems/gem_${type}.png`);
  } catch (e) {
    return require(`@/assets/logo.png`); 
  }
};

const getSpecialGemClass = (gem) => {
    if(typeof gem !== 'object' || !gem.special) return '';
    if(gem.special === 'striped-h') return 'striped-h';
    if(gem.special === 'striped-v') return 'striped-v';
    if(gem.special === 'bomb') return 'bomb';
    if(gem.special === 'rainbow') return 'rainbow';
    return '';
};

const triggerJackpotEffect = (amount) => {
  jackpotEffect.amount = amount;
  jackpotEffect.active = true;
  setTimeout(() => {
    jackpotEffect.active = false;
  }, 3000);
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

const claimReward = async (mission) => {
  error.value = '';
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const claimRewardFunc = httpsCallable(functions, 'claimSaltPangMissionReward');
    await claimRewardFunc({ missionId: mission.missionId });
    mission.claimed = true;
    alert("보상이 지급되었습니다!");
    await fetchMissions();
  } catch(err) {
    console.error("미션 보상 수령 오류:", err);
    error.value = `보상 수령 실패: ${err.message}`;
    mission.claimed = false;
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
  // 아이템을 구매하는 대신, 사용하기로 선택한 아이템 목록(purchasedItems)에 추가하거나 제거합니다.
  if (purchasedItems.value.has(item.id)) {
    purchasedItems.value.delete(item.id);
  } else {
    purchasedItems.value.add(item.id);
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
  await fetchItemCoupons();
};

const selectGameMode = (mode) => {
  if (mode === 'ranked' && !isRankedPlayable.value) {
    error.value = '랭킹전은 토요일과 일요일에만 참여할 수 있습니다.';
    return;
  }
  error.value = '';
  gameMode.value = mode;
};

// ▼▼▼ 이 함수 전체를 추가해주세요 ▼▼▼
const toggleItemSelection = (itemId) => {
  if (purchasedItems.value.has(itemId)) {
    purchasedItems.value.delete(itemId);
  } else {
    purchasedItems.value.add(itemId);
  }
};

const startGame = async () => {
  isStarting.value = true;
  error.value = '';
  await initAudioContext();

  try {
    const functions = getFunctions(undefined, "asia-northeast3");

    // 1. 사용하기로 선택한 아이템 중 쿠폰으로 사용할 수 있는 것을 먼저 처리합니다.
    const couponsToUse = [];
    if (purchasedItems.value.has('time_plus_5') && itemCoupons.SALTPANG_TIME_PLUS_5 > 0) {
      couponsToUse.push('SALTPANG_TIME_PLUS_5');
    }
    if (purchasedItems.value.has('score_x2_10s') && itemCoupons.SALTPANG_SCORE_X2_10S > 0) {
      couponsToUse.push('SALTPANG_SCORE_X2_10S');
    }

    if (couponsToUse.length > 0) {
      const useCouponFunc = httpsCallable(functions, 'useItemCoupon');
      for (const type of couponsToUse) {
        // [핵심 수정] 서버에 couponId 대신 couponType을 전달하도록 수정되어 있으므로,
        // 이 로직은 서버의 useItemCoupon 함수가 couponType으로 쿠폰을 찾아 사용하도록 구현되어 있어야 합니다.
        // 이 부분은 이전 수정에서 올바르게 반영되었습니다.
        await useCouponFunc({ couponType: type });
      }
      // 쿠폰 사용 후 최신 쿠폰 개수를 다시 불러옵니다.
      await fetchItemCoupons();
    }
    
    // 2. 쿠폰으로 사용하지 않고 SaltMate로 구매할 아이템 목록을 정확히 추려냅니다.
    const paidItems = [...purchasedItems.value].filter(id => {
        const couponType = id === 'time_plus_5' ? 'SALTPANG_TIME_PLUS_5' : 'SALTPANG_SCORE_X2_10S';
        // 이전에 쿠폰이 있었는지 여부(couponsToUse)를 기반으로 유료 아이템을 결정합니다.
        // couponsToUse에 포함된 타입에 해당하는 id는 paidItems에서 제외됩니다.
        return !couponsToUse.includes(couponType);
    });

    // 3. 서버에 게임 시작을 요청하며, 유료 아이템 목록만 함께 보냅니다.
    const startSession = httpsCallable(functions, 'startSaltPangSession');
    const result = await startSession({ gameMode: gameMode.value, items: paidItems });
    sessionId = result.data.sessionId;
    
    // --- 이하 게임 보드 초기화 및 타이머 설정 로직 (기존과 동일) ---
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

    // 아이템 효과 적용 (쿠폰 사용분 + 유료 구매분 모두)
    if (purchasedItems.value.has('time_plus_5')) {
      timer.value += 5;
    }
    if (purchasedItems.value.has('score_x2_10s')) {
      scoreBoostTimeout = setTimeout(() => {
        isScoreBoostActive.value = true;
        setTimeout(() => isScoreBoostActive.value = false, 10000);
      }, 10000); // 10초 뒤부터 10초간 활성화
    }
    
    await fetchPlayCount(); 
    gameState.value = 'playing';
    playSound('background');

    if (gameMode.value !== 'infinite') {
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
    }

  } catch (err) {
    console.error("게임 시작 오류:", err);
    error.value = `게임 시작 실패: ${err.message}`;
    gameState.value = 'ready'; 
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

    if (result.data.jackpotWinnings && result.data.jackpotWinnings > 0) {
      triggerJackpotEffect(result.data.jackpotWinnings);
    }
    
  } catch (err) {
    console.error("게임 종료 오류:", err);
    error.value = `결과 처리 실패: ${err.message}`;
  }
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

const swapAndCheck = async (index1, index2) => {
  if (isProcessing.value) return;
  isProcessing.value = true;
  selectedCell.value = null;

  if (gameMode.value === 'infinite') {
    if (movesLeft.value <= 0) {
      isProcessing.value = false;
      return;
    }
    movesLeft.value--;
  }

  const gem1 = board.value[index1];
  const gem2 = board.value[index2];

  const r1 = Math.floor(index1 / BOARD_SIZE);
  const r2 = Math.floor(index2 / BOARD_SIZE);
  lastMoveDirection = (r1 === r2) ? 'h' : 'v';

  [board.value[index1], board.value[index2]] = [gem2, gem1];
  await new Promise(r => setTimeout(r, 150));

  let matchFound = false;

  if (gem1?.special === 'rainbow' || gem2?.special === 'rainbow') {
    const rainbowIndex = gem1?.special === 'rainbow' ? index1 : index2;
    const otherIndex = rainbowIndex === index1 ? index2 : index1;
    await activateRainbowCombination(rainbowIndex, otherIndex);
    matchFound = true;
  } else if (gem1?.special && gem2?.special) {
    await activateSpecialCombination(index1, index2);
    matchFound = true;
  } else {
    const matches1 = findMatchesAt(index1);
    const matches2 = findMatchesAt(index2);
    if (matches1.size >= 3 || matches2.size >= 3) {
      matchFound = true;
    }
  }

  if (matchFound) {
    await processBoard();
  } else {
    await new Promise(r => setTimeout(r, 150));
    [board.value[index1], board.value[index2]] = [gem1, gem2];
    currentCombo = 0;
  }

  if (gameMode.value === 'infinite' && movesLeft.value <= 0) {
    endGame();
  }
  isProcessing.value = false;
};

const processBoard = async () => {
  let hasMoreMatches;
  do {
    hasMoreMatches = await checkAndClearMatches();
    if (hasMoreMatches) {
      await new Promise(r => setTimeout(r, 200));
      dropDownGems();
      await new Promise(r => setTimeout(r, 200));
      fillEmptyCells();
      await new Promise(r => setTimeout(r, 200));
    }
  } while (hasMoreMatches);
  
  currentCombo = 0;
};

const checkAndClearMatches = async () => {
  const matches = findMatchesOnBoard();
  if (matches.all.size === 0) return false;

  playSound('match');
  currentCombo++;
  if (currentCombo > gameStats.maxCombo) gameStats.maxCombo = currentCombo;

  const specialGemsToCreate = [];
  [...matches.byType.longH, ...matches.byType.longV].forEach(match => {
    let bestIndex = -1;
    if(match.includes(selectedCell.value)) bestIndex = selectedCell.value;
    else bestIndex = match[1];

    if (match.length >= 5) {
      specialGemsToCreate.push({ index: bestIndex, type: gameMode.value === 'ranked' ? 'rainbow' : 'time' });
    } else if (match.length === 4) {
      specialGemsToCreate.push({ index: bestIndex, type: lastMoveDirection === 'h' ? 'striped-v' : 'striped-h' });
    }
  });
   matches.byType.shape.forEach(match => {
     specialGemsToCreate.push({ index: match.center, type: 'bomb' });
  });

  let gemsToActivate = new Set();
  matches.all.forEach(index => {
    const gem = board.value[index];
    if (gem?.special) {
      gemsToActivate.add(index);
    }
  });
  
  let regularMatches = new Set([...matches.all]);
  specialGemsToCreate.forEach(sg => regularMatches.delete(sg.index));
  
  await clearGems(regularMatches);

  specialGemsToCreate.forEach(special => {
      const originalGem = board.value[special.index];
      const baseGemType = originalGem?.type || (typeof originalGem === 'number' ? originalGem : Math.floor(Math.random() * NUM_GEM_TYPES) + 1);
      
      if (special.type === 'time' || special.type === 'rainbow') {
        board.value[special.index] = { type: baseGemType, special: special.type };
      }
      else if (special.type === 'striped-h' || special.type === 'striped-v') {
         board.value[special.index] = { type: baseGemType, special: special.type };
      }
      else if (special.type === 'bomb') {
         board.value[special.index] = { type: baseGemType, special: 'bomb' };
      }
  });

  if(gemsToActivate.size > 0) {
      await activateSpecialGems(gemsToActivate);
  }

  return true;
};

const findMatchesOnBoard = () => {
  const matches = new Set();
  const longH = [], longV = [], shapes = [];

  // 가로 매치 확인 (기존과 동일)
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE - 2; c++) {
      let line = [r * BOARD_SIZE + c];
      const firstGemType = board.value[line[0]]?.type || board.value[line[0]];
      if(!firstGemType) continue;

      while (c + line.length < BOARD_SIZE) {
        const nextIndex = r * BOARD_SIZE + c + line.length;
        const nextGemType = board.value[nextIndex]?.type || board.value[nextIndex];
        if (firstGemType === nextGemType) {
          line.push(nextIndex);
        } else {
          break;
        }
      }
      if (line.length >= 3) {
        line.forEach(i => matches.add(i));
        if (line.length >= 4) longH.push(line);
        c += line.length - 1;
      }
    }
  }

  // 세로 매치 확인 (기존과 동일)
  for (let c = 0; c < BOARD_SIZE; c++) {
    for (let r = 0; r < BOARD_SIZE - 2; r++) {
      let line = [r * BOARD_SIZE + c];
      const firstGemType = board.value[line[0]]?.type || board.value[line[0]];
      if(!firstGemType) continue;

      while (r + line.length < BOARD_SIZE) {
        const nextIndex = (r + line.length) * BOARD_SIZE + c;
        const nextGemType = board.value[nextIndex]?.type || board.value[nextIndex];
        if(firstGemType === nextGemType) {
          line.push(nextIndex);
        } else {
          break;
        }
      }
      if (line.length >= 3) {
        line.forEach(i => matches.add(i));
        if (line.length >= 4) longV.push(line);
        r += line.length - 1;
      }
    }
  }
  
  // [핵심 수정] L, T자 매치 확인 로직 강화
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
        const index = r * BOARD_SIZE + c;
        const gemType = board.value[index]?.type || board.value[index];
        if (!gemType) continue;

        // 가로 3개 이상 확인
        const hMatch = [index];
        for (let i = c + 1; i < BOARD_SIZE; i++) {
            const nextIndex = r * BOARD_SIZE + i;
            const nextType = board.value[nextIndex]?.type || board.value[nextIndex];
            if (nextType === gemType) hMatch.push(nextIndex); else break;
        }

        // 세로 3개 이상 확인
        const vMatch = [index];
        for (let i = r + 1; i < BOARD_SIZE; i++) {
            const nextIndex = i * BOARD_SIZE + c;
            const nextType = board.value[nextIndex]?.type || board.value[nextIndex];
            if (nextType === gemType) vMatch.push(nextIndex); else break;
        }
        
        // 가로 3개와 세로 3개가 교차하면 shape 매치로 간주
        if (hMatch.length >= 3 && vMatch.length >= 3) {
            shapes.push({ center: index });
            hMatch.forEach(i => matches.add(i));
            vMatch.forEach(i => matches.add(i));
        }
    }
  }

  return { all: matches, byType: { longH, longV, shape: shapes } };
};

const findMatchesAt = (index) => {
    const matches = new Set([index]);
    const type = board.value[index]?.type || board.value[index];
    if (!type) return new Set();

    const r = Math.floor(index / BOARD_SIZE), c = index % BOARD_SIZE;
    
    let hLine = [index];
    for (let i = c - 1; i >= 0; i--) {
        const gemType = board.value[r * BOARD_SIZE + i]?.type || board.value[r * BOARD_SIZE + i];
        if (gemType === type) hLine.unshift(r * BOARD_SIZE + i); else break;
    }
    for (let i = c + 1; i < BOARD_SIZE; i++) {
        const gemType = board.value[r * BOARD_SIZE + i]?.type || board.value[r * BOARD_SIZE + i];
        if (gemType === type) hLine.push(r * BOARD_SIZE + i); else break;
    }
    if (hLine.length >= 3) hLine.forEach(i => matches.add(i));

    let vLine = [index];
    for (let i = r - 1; i >= 0; i--) {
        const gemType = board.value[i * BOARD_SIZE + c]?.type || board.value[i * BOARD_SIZE + c];
        if (gemType === type) vLine.unshift(i * BOARD_SIZE + c); else break;
    }
    for (let i = r + 1; i < BOARD_SIZE; i++) {
        const gemType = board.value[i * BOARD_SIZE + c]?.type || board.value[i * BOARD_SIZE + c];
        if (gemType === type) vLine.push(i * BOARD_SIZE + c); else break;
    }
    if (vLine.length >= 3) vLine.forEach(i => matches.add(i));
    
    return matches.size >= 3 ? matches : new Set();
};

const clearGems = async (indices) => {
  if (indices.size === 0) return;
  
  // [수정] 점수 계산 로직 강화
  const scoreMultiplier = isScoreBoostActive.value ? 2 : 1;
  const comboBonus = currentCombo > 1 ? (currentCombo - 1) * 5 : 0; // 콤보 보너스
  const specialBonus = indices.size > 5 ? indices.size * 2 : 0; // 특수 아이템 보너스
  
  score.value += (indices.size * 10 + comboBonus + specialBonus) * scoreMultiplier;
  
  indices.forEach(index => {
    explodingGems.value.add(index);
    const gem = board.value[index];
    if(gem){
      const type = gem.type || gem;
      if (type === 6) gameStats.jackpotGemsMatched++;
      gameStats.gemsMatched[type] = (gameStats.gemsMatched[type] || 0) + 1;
    }
  });
  
  if (gameMode.value === 'timeAttack') timer.value += 1;

  await new Promise(r => setTimeout(r, 300));

  indices.forEach(index => {
    board.value[index] = null;
    explodingGems.value.delete(index);
  });
};

const activateSpecialGems = async (indices) => {
    let affectedGems = new Set(indices);
    let newSpecialGemsToActivate = new Set();

    indices.forEach(index => {
        const gem = board.value[index];
        if (!gem?.special) return;

        const r = Math.floor(index / BOARD_SIZE);
        const c = index % BOARD_SIZE;

        if (gem.special === 'striped-h') {
            for (let i = 0; i < BOARD_SIZE; i++) affectedGems.add(r * BOARD_SIZE + i);
        } else if (gem.special === 'striped-v') {
            for (let i = 0; i < BOARD_SIZE; i++) affectedGems.add(i * BOARD_SIZE + c);
        } else if (gem.special === 'bomb') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                        affectedGems.add(nr * BOARD_SIZE + nc);
                    }
                }
            }
        }
    });

    affectedGems.forEach(index => {
        const gem = board.value[index];
        if (gem?.special && !indices.has(index)) {
            newSpecialGemsToActivate.add(index);
        }
    });
    
    await clearGems(affectedGems);
    
    if (newSpecialGemsToActivate.size > 0) {
        await activateSpecialGems(newSpecialGemsToActivate);
    }
};

const activateSpecialCombination = async (index1, index2) => {
    const gem1 = board.value[index1];
    const gem2 = board.value[index2];
    // [수정] 조합의 중심이 되는 위치를 index1으로 통일합니다.
    const r = Math.floor(index1 / BOARD_SIZE);
    const c = index1 % BOARD_SIZE;
    let affectedGems = new Set([index1, index2]);
    
    // 줄무늬 + 폭탄 조합: 가로/세로 3줄 폭발
    if ((gem1.special.startsWith('striped') && gem2.special === 'bomb') || (gem2.special.startsWith('striped') && gem1.special === 'bomb')) {
        for (let i = -1; i <= 1; i++) {
            const row = r + i;
            const col = c + i;
            if(row >= 0 && row < BOARD_SIZE) { // 가로 3줄
                for(let j=0; j<BOARD_SIZE; j++) affectedGems.add(row * BOARD_SIZE + j);
            }
            if(col >= 0 && col < BOARD_SIZE) { // 세로 3줄
                for(let j=0; j<BOARD_SIZE; j++) affectedGems.add(j * BOARD_SIZE + col);
            }
        }
    }
    // 폭탄 + 폭탄 조합: 5x5 폭발
    else if (gem1.special === 'bomb' && gem2.special === 'bomb') {
        for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                    affectedGems.add(nr * BOARD_SIZE + nc);
                }
            }
        }
    }
    // 줄무늬 + 줄무늬 조합: 십자(+) 폭발
    else if (gem1.special.startsWith('striped') && gem2.special.startsWith('striped')) {
        for(let i=0; i<BOARD_SIZE; i++) {
            affectedGems.add(r * BOARD_SIZE + i); // 가로 한 줄
            affectedGems.add(i * BOARD_SIZE + c); // 세로 한 줄
        }
    }

    await clearGems(affectedGems);
};

const activateRainbowCombination = async (rainbowIndex, otherIndex) => {
    const otherGem = board.value[otherIndex];
    let affectedGems = new Set([rainbowIndex]);

    if (!otherGem?.special) {
        const targetType = otherGem.type;
        for (let i = 0; i < board.value.length; i++) {
            const gem = board.value[i];
            const gemType = gem?.type || gem;
            if (gemType === targetType) {
                affectedGems.add(i);
            }
        }
    }
    else {
        const targetType = otherGem.type;
        for (let i = 0; i < board.value.length; i++) {
            const gem = board.value[i];
            const gemType = gem?.type || gem;
            if (gemType === targetType) {
                board.value[i] = { type: gemType, special: otherGem.special };
                affectedGems.add(i);
            }
        }
        await activateSpecialGems(affectedGems);
        return;
    }
    await clearGems(affectedGems);
};

const dropDownGems = () => {
  for(let c=0;c<BOARD_SIZE;c++){ let er=-1; for(let r=BOARD_SIZE-1;r>=0;r--){ const i=r*BOARD_SIZE+c; if(board.value[i]===null&&er===-1)er=r; else if(board.value[i]!==null&&er!==-1){ board.value[er*BOARD_SIZE+c]=board.value[i]; board.value[i]=null; er--; } } }
};

const fillEmptyCells = () => {
  for(let i=0;i<board.value.length;i++){ if(board.value[i]===null){ board.value[i]=Math.floor(Math.random()*NUM_GEM_TYPES)+1; } }
};

const listenToJackpot = () => {
  const jackpotRef = doc(db, "configuration", "saltPangJackpot");
  onSnapshot(jackpotRef, (docSnap) => {
    if (docSnap.exists()) {
      jackpotAmount.value = docSnap.data().amount || 0;
    }
  });
};

// [수정] onMounted, resetGame 함수에 쿠폰 정보 로딩 함수 호출 추가
onMounted(() => {
  fetchPlayCount();
  fetchMissions();
  listenToJackpot();
  fetchItemCoupons(); // 추가
});

const resetGame = async () => {
  gameState.value = 'ready';
  sessionId = null;
  error.value = '';
  purchasedItems.value.clear();
  explodingGems.value.clear();
  await fetchPlayCount();
  await fetchMissions();
  await fetchItemCoupons(); // 추가
};

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (scoreBoostTimeout) clearTimeout(scoreBoostTimeout);
  sounds.background.pause();
});

</script>

<style scoped>
/* [핵심 수정] 잭팟 UI 관련 스타일을 아래 코드로 교체합니다. */
.jackpot-section {
  text-align: center;
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  color: white;
  padding: 25px;
  border-radius: 12px;
}

.jackpot-icon {
  color: #ffd700;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.jackpot-amount {
  font-size: 2.8em;
  font-weight: bold;
  text-shadow: 0 2px 5px rgba(0,0,0,0.3);
  
  background: linear-gradient(45deg, #ffd700, #fca5f1, #b3c7f0, #ffd700);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: gradient-animation 4s ease infinite;
}

@keyframes gradient-animation {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

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
/* 4개 이상 매치 시 이펙트 */
.gem-image.special-clear {
  animation: gem-special-clear 0.5s ease-out forwards;
}

@keyframes gem-special-clear {
  0% {
    transform: scale(1.2);
    opacity: 1;
    filter: brightness(1.5) saturate(2);
  }
  50% {
    transform: scale(2.5) rotate(360deg);
    opacity: 0.5;
  }
  100% {
    transform: scale(0);
    opacity: 0;
  }
}
.gem-image-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gem-special-effect {
  position: absolute;
  width: 100%;
  height: 100%;
  background-size: cover;
  pointer-events: none;
}

.striped-h .gem-special-effect {
  background-image: linear-gradient(to bottom, transparent 45%, white 45%, white 55%, transparent 55%);
}
.striped-v .gem-special-effect {
  background-image: linear-gradient(to right, transparent 45%, white 45%, white 55%, transparent 55%);
}
.bomb .gem-special-effect {
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.7) 20%, transparent 60%);
  animation: bomb-pulse 1s infinite;
}
.rainbow .gem-special-effect {
  animation: rainbow-spin 2s linear infinite;
  background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
  border-radius: 50%;
  opacity: 0.8;
}

@keyframes bomb-pulse {
  0%, 100% { transform: scale(0.8); }
  50% { transform: scale(1); }
}
@keyframes rainbow-spin {
  to { transform: rotate(360deg); }
}
.jackpot-effect-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  pointer-events: none;
}

.jackpot-content {
  text-align: center;
  color: #fff;
  animation: jackpot-show 3s forwards;
}

.jackpot-title {
  font-size: 6em;
  font-weight: 900;
  text-transform: uppercase;
  background: linear-gradient(45deg, #f7971e, #ffd200, #f7971e);
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: gradient-animation 2s ease infinite, text-glow 1.5s infinite alternate;
}

.jackpot-prize {
  font-size: 3em;
  font-weight: 700;
  text-shadow: 0 0 15px #fff;
}

.jackpot-fade-enter-active,
.jackpot-fade-leave-active {
  transition: opacity 0.5s ease;
}
.jackpot-fade-enter-from,
.jackpot-fade-leave-to {
  opacity: 0;
}

@keyframes jackpot-show {
  0% { transform: scale(0.5); opacity: 0; }
  20% { transform: scale(1.2); opacity: 1; }
  40% { transform: scale(1); }
  80% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes text-glow {
  from { text-shadow: 0 0 10px #ffd700, 0 0 20px #ffd700, 0 0 30px #f7971e; }
  to { text-shadow: 0 0 20px #ffd700, 0 0 30px #f7971e, 0 0 40px #f7971e; }
}
</style>

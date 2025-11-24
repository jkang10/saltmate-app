<template>
  <div class="salt-alchemy-page">
    <audio ref="bgmPlayer" src="/sound/Gil Kita - Silly Lovebirds.mp3" loop preload="auto"></audio>
    
    <div class="game-stats-glass">
      <button @click="toggleSound" class="sound-toggle-btn">
        <i v-if="isSoundPlaying" class="fas fa-volume-up"></i>
        <i v-else class="fas fa-volume-mute"></i>
      </button>
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
      <div class="stat-item gold-stat">
        <span v-if="isGoldenPotMode">획득 골드</span>
        <span v-else>보유 골드</span>
        <strong v-if="isGoldenPotMode">+ {{ earnedGold.toLocaleString() }} G</strong>
        <strong v-else>{{ goldBalance.toLocaleString() }} G</strong>
      </div>
    </div>

    <div v-if="isGoldenPotMode" class="event-banner">
      <i class="fas fa-coins"></i> 황금 항아리 이벤트 (🌟+🌟 = GOLD)
    </div>
    
    <div class="game-tools">
      <button 
        class="tool-button" 
        @click="activateHammerMode"
        :disabled="hammerCount <= 0 || hammerMode || isClearing || isProcessingItem"
        :class="{ 'active': hammerMode }"
      >
        <i class="fas fa-hammer"></i>
        <span>망치 ({{ hammerCount }})</span>
      </button>
      <p v-if="hammerMode" class="tool-guide">제거할 이모지를 터치하세요!</p>
    </div>

    <div 
      class="game-area-wrapper" 
      ref="gameAreaWrapper"
      :class="{ 'hard-mode': gameMode === 'hard' }"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @click="handleDropItem"
      @touchstart.prevent="handleTouchMove"
      @touchmove.prevent="handleTouchMove"
      @touchend.prevent="handleTouchEnd"
    >
      <div 
        v-if="gameStatus === 'playing' && nextItem"
        class="preview-item" 
        :style="previewItemStyle"
      >
        <div class="emoji-wrapper" :style="{ fontSize: `${nextItem.radius * 1.5}px` }">
          {{ nextItem.emoji }}
        </div>
      </div>

      <div class="deadline" :style="{ top: `${DEADLINE_Y}px` }"></div>

      <div 
        v-for="item in reactiveItems"
        :key="item.id"
        class="alchemy-item"
        :style="getItemStyle(item)"
        @click.stop="useHammerOnItem(item.id)"
        @touchend.stop="useHammerOnItem(item.id)"
      >
        <div class="emoji-wrapper" :style="{ fontSize: `${item.radius * 1.5}px` }">
          {{ item.emoji }}
        </div>
      </div>
    </div>

    <div class="purchase-fab" @click="buyPlayTicket" :class="{ 'is-loading': isBuying }">
      <div class="fab-icon">
        <i class="fas fa-ticket-alt"></i>
        <span class="plus-badge">+</span>
      </div>
      <div class="fab-text">
        <span class="label">추가 10회</span>
        <span class="cost">1,000 P</span>
      </div>
    </div>

    <div v-if="showEntryModal" class="modal-overlay entry-modal">
      <div class="modal-content">
        <h2><i class="fas fa-flask"></i> 솔트 알케미</h2>
        
        <div class="status-box">
          <div class="status-row">
            <span>일일 무료 횟수:</span>
            <strong :class="dailyPlaysLeft > 0 ? 'text-green' : 'text-red'">
              {{ dailyPlaysLeft }} / 10
            </strong>
          </div>
          <div class="status-row">
            <span>보유 티켓:</span>
            <strong class="text-blue">{{ userTicketCount }} 장</strong>
          </div>
        </div>

        <div class="mode-selector">
          <p>게임 모드를 선택하세요:</p>
          <div class="mode-buttons">
            <button 
              class="mode-btn" 
              :class="{ active: selectedMode === 'normal' }" 
              @click="selectedMode = 'normal'"
            >
              🌱 일반 모드
              <small>여유로운 플레이</small>
            </button>
            <button 
              class="mode-btn hard" 
              :class="{ active: selectedMode === 'hard' }" 
              @click="selectedMode = 'hard'"
            >
              🔥 하드 모드
              <small>좁은 맵 + 빠른 중력</small>
            </button>
          </div>
        </div>

        <p class="info-text" v-if="canStartGame">
          입장료: <strong>{{ dailyPlaysLeft > 0 ? '100 SaltMate' : '티켓 1장' }}</strong>
          <br><span class="sub-text" v-if="dailyPlaysLeft <= 0">(티켓 사용 시에도 페널티 없음!)</span>
        </p>
        <p class="info-text text-red" v-else>
          입장 가능한 횟수가 없습니다.<br>티켓을 구매해주세요!
        </p>

        <div class="button-group">
          <button @click="handleStartGame" class="btn-primary btn-lg" :disabled="!canStartGame">
            게임 시작
          </button>
          <button @click="buyPlayTicket" class="btn-secondary btn-lg purchase-btn" :disabled="isBuying">
            <span v-if="isBuying">구매 중...</span>
            <span v-else><i class="fas fa-shopping-cart"></i> 티켓 구매 (1,000 P)</span>
          </button>
        </div>

        <button @click="goToDashboard" class="btn-text">나가기</button>
      </div>
    </div>

    <div v-if="gameStatus !== 'playing' && !showEntryModal" class="modal-overlay">
      <div class="modal-content">
        <h2 v-if="gameStatus === 'loading'">게임 준비 중...</h2>
        <h2 v-if="gameStatus === 'lost'">게임 오버</h2>
        <p v-if="gameStatus === 'lost'">
          최종 점수: {{ score }}<br />
          획득한 가루: {{ alchemyDust }} 💎<br />
          <strong v-if="earnedGold > 0">획득한 골드: +{{ earnedGold.toLocaleString() }} G</strong>
        </p>
        <div v-if="gameStatus === 'loading'" class="loading-spinner"></div>
        <button v-if="gameStatus === 'lost'" @click="refreshAndShowEntry" class="btn-primary">
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Matter from 'matter-js';
import { functions, auth, db } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';

// --- Firebase Functions ---
const startGameFunc = httpsCallable(functions, 'startAlchemyGame');
const endGameFunc = httpsCallable(functions, 'endAlchemyGame');
const useBoosterFunc = httpsCallable(functions, 'useSaltPangBooster');
const purchasePlaysFunc = httpsCallable(functions, 'purchaseAlchemyPlays'); // 신규
const router = useRouter();

const bgmPlayer = ref(null);
const isSoundPlaying = ref(false);

// --- 상태 변수 ---
const showEntryModal = ref(true);
const selectedMode = ref('normal');
const gameMode = ref('normal'); // 실제 게임 중인 모드
const gameStatus = ref('idle'); 
const isBuying = ref(false);

// 유저 정보
const dailyPlaysLeft = ref(0);
const userTicketCount = ref(0);
const userPoints = ref(0);
const hammerCount = ref(0);
const goldBalance = ref(0);

const score = ref(0);
const highScore = ref(localStorage.getItem('alchemyHighScore') || 0);
const alchemyDust = ref(0);
const earnedGold = ref(0);

// Matter.js 관련
const { Engine, Runner, World, Bodies, Events, Composite } = Matter;
let engine, runner, world;
const gameAreaWrapper = ref(null);
let walls = {};

// 아이템 정의
const BOMB_DEFINITION = { level: 'bomb', emoji: '💣', radius: 20, score: 0 };
const EMOJI_DEFINITIONS = [
  { level: 1, emoji: '🪨', radius: 15, score: 1 },
  { level: 2, emoji: '🧂', radius: 20, score: 3 },
  { level: 3, emoji: '🍚', radius: 25, score: 6 },
  { level: 4, emoji: '⚙️', radius: 30, score: 10 },
  { level: 5, emoji: '💎', radius: 35, score: 15 },
  { level: 6, emoji: '🌈', radius: 40, score: 21 },
  { level: 7, emoji: '🌟', radius: 45, score: 28 },
  { level: 8, emoji: '🏺', radius: 50, score: 36 },
  { level: 9, emoji: '🔮', radius: 55, score: 45 },
  { level: 10, emoji: '💧', radius: 60, score: 55 }
];
const getItemDefinition = (level) => EMOJI_DEFINITIONS[level - 1];

const reactiveItems = ref([]);
const nextItem = ref(null);
const previewPositionX = ref(180); // 중앙
const canDropItem = ref(true);
const mergesToProcess = [];
const isClearing = ref(false);
const isProcessingItem = ref(false);
const hammerMode = ref(false);

// --- 게임 상수 (동적 변경됨) ---
let GAME_WIDTH = 360;
const GAME_HEIGHT = 500;
const DEADLINE_Y = 60;

// --- Computed ---
const isGoldenPotMode = computed(() => {
  const day = new Date().getDay();
  return day === 6 || day === 0; 
});

const canStartGame = computed(() => {
  if (dailyPlaysLeft.value > 0) return userPoints.value >= 100;
  return userTicketCount.value > 0;
});

// --- 유저 정보 로드 ---
const fetchUserStatus = async () => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      userPoints.value = data.saltmatePoints || 0;
      userTicketCount.value = data.purchasedAlchemyPlays || 0;
      hammerCount.value = data.saltPangBoosters?.hammer || 0;
      goldBalance.value = data.goldBalance || 0;
    }
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + kstOffset).toISOString().slice(0, 10);
    const countRef = doc(db, 'users', user.uid, 'daily_play_counts', todayStr);
    const countSnap = await getDoc(countRef);
    const used = countSnap.exists() ? (countSnap.data().saltAlchemy || 0) : 0;
    dailyPlaysLeft.value = Math.max(0, 10 - used);
  } catch (e) { console.error("정보 로드 실패:", e); }
};

// --- 게임 시작/종료 ---
const handleStartGame = () => {
  showEntryModal.value = false;
  gameMode.value = selectedMode.value; // 선택한 모드 확정
  startGameLogic();
};

const refreshAndShowEntry = async () => {
  gameStatus.value = 'idle';
  await fetchUserStatus();
  showEntryModal.value = true;
};

const startGameLogic = async () => {
  if (!auth.currentUser) { alert("로그인 필요"); router.push('/login'); return; }
  
  gameStatus.value = 'loading';
  try {
    // 서버에 모드 정보 전달
    await startGameFunc({ mode: gameMode.value });
    
    // 물리 엔진 초기화 (모드에 따라 설정 변경)
    initMatterJS(); 
    initEventListeners();
    
    reactiveItems.value = [];
    mergesToProcess.length = 0;
    score.value = 0;
    alchemyDust.value = 0;
    earnedGold.value = 0;
    
    spawnNextItem();
    gameStatus.value = 'playing';
    canDropItem.value = true;

    if (bgmPlayer.value && !isSoundPlaying.value) {
       bgmPlayer.value.play().then(() => isSoundPlaying.value = true).catch(()=>{});
    }
  } catch (error) {
    let msg = error.message;
    if (msg.includes("resource-exhausted")) msg = "입장 가능한 횟수가 없습니다.\n티켓을 구매해주세요!";
    alert(msg);
    gameStatus.value = 'idle';
    await fetchUserStatus();
    showEntryModal.value = true;
  }
};

const goToDashboard = () => router.push('/dashboard');

// --- 티켓 구매 ---
const buyPlayTicket = async () => {
  if (isBuying.value) return;
  if (!confirm("1,000 SaltMate로 '추가 플레이 10회'를 구매하시겠습니까?")) return;
  isBuying.value = true;
  try {
    const result = await purchasePlaysFunc();
    alert(result.data.message);
    await fetchUserStatus();
  } catch (error) {
    alert(error.message);
  } finally {
    isBuying.value = false;
  }
};

// --- 물리 엔진 (Matter.js) ---
const initMatterJS = () => {
  engine = Engine.create();
  world = engine.world;
  
  // [핵심] 모드에 따른 물리 설정 변경
  if (gameMode.value === 'hard') {
    GAME_WIDTH = 280; // 좁게
    engine.world.gravity.y = 1.5; // 중력 강하게 (빠르게 떨어짐)
    previewPositionX.value = GAME_WIDTH / 2;
  } else {
    GAME_WIDTH = 360;
    engine.world.gravity.y = 0.8;
    previewPositionX.value = GAME_WIDTH / 2;
  }

  const wallOptions = { isStatic: true, restitution: 0.1, friction: 0.2 };
  
  walls.floor = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT, GAME_WIDTH, 20, { ...wallOptions, label: 'floor' });
  walls.left = Bodies.rectangle(0, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { ...wallOptions, label: 'wall' });
  walls.right = Bodies.rectangle(GAME_WIDTH, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { ...wallOptions, label: 'wall' });
  
  // 데드라인 센서
  walls.deadline = Bodies.rectangle(GAME_WIDTH / 2, DEADLINE_Y, GAME_WIDTH, 2, {
    isStatic: true, isSensor: true, label: 'deadline'
  });

  World.add(world, [walls.floor, walls.left, walls.right, walls.deadline]);
  runner = Runner.create();
  Runner.run(runner, engine);
};

const initEventListeners = () => {
  Events.on(engine, 'afterUpdate', () => {
    if (isClearing.value) return;
    const currentBodies = Composite.allBodies(world).filter(b => b.label === 'alchemy-item');
    reactiveItems.value = currentBodies.map(body => ({
      id: body.id, level: body.level, radius: body.circleRadius,
      emoji: body.emoji, x: body.position.x, y: body.position.y, angle: body.angle
    }));
    processMergeQueue();
    if (gameStatus.value === 'playing') checkGameOver();
  });

  Events.on(engine, 'collisionStart', (event) => {
    if (gameStatus.value !== 'playing' || isClearing.value) return;
    const pairs = event.pairs;
    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;
      if (bodyA.label === 'alchemy-item' && bodyB.label === 'alchemy-item') {
        if (bodyA.level === 'bomb' || bodyB.level === 'bomb') {
          if (bodyA.level === 'bomb' && bodyB.level === 'bomb') mergesToProcess.push({ transform: [bodyA, bodyB], toLevel: 1 });
          else mergesToProcess.push({ remove: [bodyA, bodyB] });
        } else if (bodyA.level === bodyB.level) { 
          mergesToProcess.push({ merge: [bodyA, bodyB], toLevel: bodyA.level + 1 });
        }
      }
    }
  });
};

const processMergeQueue = () => {
  if (mergesToProcess.length === 0) return;
  isClearing.value = true;
  
  mergesToProcess.forEach(pair => {
    const bodyA = (pair.merge || pair.remove || pair.transform)[0];
    const bodyB = (pair.merge || pair.remove || pair.transform)[1];
    if (!Composite.get(world, bodyA.id, 'body') || !Composite.get(world, bodyB.id, 'body')) return;

    if (pair.remove) {
      World.remove(world, [bodyA, bodyB]);
      if (bodyA.level !== 'bomb') { score.value += bodyA.score; alchemyDust.value += Math.floor(bodyA.score / 2) || 1; }
      if (bodyB.level !== 'bomb') { score.value += bodyB.score; alchemyDust.value += Math.floor(bodyB.score / 2) || 1; }
    } else if (pair.transform) {
      World.remove(world, [bodyA, bodyB]);
      World.add(world, createAlchemyItem((bodyA.position.x + bodyB.position.x)/2, (bodyA.position.y + bodyB.position.y)/2, pair.toLevel));
    } else if (pair.merge) {
      const nextLevel = pair.toLevel;
      if (isGoldenPotMode.value && nextLevel === 8) { 
        earnedGold.value += Math.floor(Math.random() * 401) + 100;
        const def = getItemDefinition(7); 
        score.value += def.score * 2; alchemyDust.value += (Math.floor(def.score/2)||1)*2;
        World.remove(world, [bodyA, bodyB]);
      } else if (nextLevel > 10) { 
        const def = getItemDefinition(10);
        score.value += def.score * 2; alchemyDust.value += (Math.floor(def.score/2)||1)*2;
        World.remove(world, [bodyA, bodyB]);
      } else {
        const def = getItemDefinition(nextLevel);
        score.value += def.score; alchemyDust.value += Math.floor(def.score/2) || 1;
        World.remove(world, [bodyA, bodyB]);
        World.add(world, createAlchemyItem((bodyA.position.x + bodyB.position.x)/2, (bodyA.position.y + bodyB.position.y)/2, nextLevel));
      }
    }
  });
  mergesToProcess.length = 0;
  isClearing.value = false;
};

const createAlchemyItem = (x, y, level) => {
  if (level === 'bomb') {
    return Bodies.circle(x, y, BOMB_DEFINITION.radius, {
      restitution: 0.2, friction: 0.1, label: 'alchemy-item',
      level: 'bomb', emoji: '💣', circleRadius: BOMB_DEFINITION.radius, score: 0 
    });
  }
  const def = getItemDefinition(level);
  return Bodies.circle(x, y, def.radius, {
    restitution: 0.2, friction: 0.1, label: 'alchemy-item',
    level: def.level, emoji: def.emoji, circleRadius: def.radius, score: def.score
  });
};

const spawnNextItem = () => {
  nextItem.value = (Math.random() < 0.03) ? BOMB_DEFINITION : getItemDefinition(Math.floor(Math.random() * 3) + 1);
};

const handleDropItem = () => {
  if (gameStatus.value !== 'playing' || !canDropItem.value || hammerMode.value || isClearing.value) return; 
  canDropItem.value = false;
  if (!nextItem.value) return;
  
  const newItem = createAlchemyItem(
    Math.max(nextItem.value.radius, Math.min(previewPositionX.value, GAME_WIDTH - nextItem.value.radius)),
    DEADLINE_Y + 30, 
    nextItem.value.level
  );
  World.add(world, newItem);
  spawnNextItem();
  setTimeout(() => { canDropItem.value = true; }, 500); 
};

// --- 망치 기능 ---
const activateHammerMode = () => { if (hammerCount.value > 0 && !isClearing.value) hammerMode.value = true; };
const useHammerOnItem = async (itemId) => {
  if (!hammerMode.value || isClearing.value || isProcessingItem.value) return;
  isClearing.value = true; isProcessingItem.value = true; hammerMode.value = false;
  try {
    await useBoosterFunc({ boosterType: 'hammer' });
    hammerCount.value--; 
    const body = Composite.allBodies(world).find(b => b.id === itemId);
    if (body) World.remove(world, body);
  } catch (error) { alert(`오류: ${error.message}`); } 
  finally { isClearing.value = false; isProcessingItem.value = false; }
};

// --- 게임 오버 ---
const checkGameOver = () => {
  const bodies = Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label === 'alchemy-item') {
      if (body.position.y - body.circleRadius < DEADLINE_Y && body.speed < 0.1 && body.angularSpeed < 0.1) {
        handleGameOver(); return;
      }
    }
  }
};

const handleGameOver = async () => {
  if (gameStatus.value !== 'playing') return;
  gameStatus.value = 'lost';
  Runner.stop(runner);
  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('alchemyHighScore', score.value);
  }
  try {
    await endGameFunc({ score: score.value, alchemyDust: alchemyDust.value, earnedGold: earnedGold.value, mode: gameMode.value }); 
  } catch (error) { console.error("결과 전송 실패:", error); }
};

// --- 입력 ---
const handleMouseMove = (e) => {
  if (gameStatus.value !== 'playing' || hammerMode.value) return; 
  const rect = gameAreaWrapper.value.getBoundingClientRect();
  previewPositionX.value = e.clientX - rect.left;
};
const handleMouseLeave = () => {};
const handleTouchMove = (e) => {
  if (gameStatus.value !== 'playing' || hammerMode.value) return; 
  const rect = gameAreaWrapper.value.getBoundingClientRect();
  previewPositionX.value = e.touches[0].clientX - rect.left;
};
const handleTouchEnd = () => { if (hammerMode.value) return; handleDropItem(); };

const toggleSound = () => {
  if (!bgmPlayer.value) return;
  if (isSoundPlaying.value) { bgmPlayer.value.pause(); isSoundPlaying.value = false; }
  else { bgmPlayer.value.play().then(() => isSoundPlaying.value = true).catch(()=>{}); }
};

const previewItemStyle = computed(() => {
  if (!nextItem.value) return { display: 'none' };
  const def = nextItem.value.level === 'bomb' ? BOMB_DEFINITION : getItemDefinition(nextItem.value.level); 
  const x = Math.max(def.radius, Math.min(previewPositionX.value, GAME_WIDTH - def.radius));
  return {
    width: `${def.radius * 2}px`, height: `${def.radius * 2}px`,
    transform: `translate(${x - def.radius}px, 10px)`, opacity: canDropItem.value ? 0.8 : 0.3
  };
});
const getItemStyle = (item) => ({
  width: `${item.radius * 2}px`, height: `${item.radius * 2}px`,
  transform: `translate(${item.x - item.radius}px, ${item.y - item.radius}px) rotate(${item.angle}rad)`,
  zIndex: item.level === 'bomb' ? 20 : item.level, 
  backgroundColor: item.level === 'bomb' ? '#333' : `var(--lv-${item.level}-bg)`, 
  border: item.level === 'bomb' ? '2px solid #ff0000' : `2px solid var(--lv-${item.level}-border)` 
});

const cleanupMatterJS = () => {
  if (runner) Runner.stop(runner);
  if (world) World.clear(world);
  if (engine) Engine.clear(engine);
  reactiveItems.value = [];
};

onMounted(async () => {
  await fetchUserStatus();
  if (bgmPlayer.value) bgmPlayer.value.volume = 0.3;
});
onUnmounted(() => {
  cleanupMatterJS();
  if (bgmPlayer.value) bgmPlayer.value.pause();
});
</script>

<style scoped>
:root {
  --lv-1-bg: #d1d1d1; --lv-1-border: #a0a0a0;
  --lv-2-bg: #e0e0e0; --lv-2-border: #b0b0b0;
  --lv-3-bg: #f0f0f0; --lv-3-border: #c0c0c0;
  --lv-4-bg: #aed6f1; --lv-4-border: #85c1e9;
  --lv-5-bg: #abebc6; --lv-5-border: #82e0aa;
  --lv-6-bg: #f9e79f; --lv-6-border: #f7dc6f;
  --lv-7-bg: #f5b041; --lv-7-border: #f39c12;
  --lv-8-bg: #ec7063; --lv-8-border: #e74c3c;
  --lv-9-bg: #bb8fce; --lv-9-border: #a569bd;
  --lv-10-bg: #85c1e9; --lv-10-border: #3498db;
}
.salt-alchemy-page {
  display: flex; flex-direction: column; align-items: center;
  padding: 10px; background-color: #1a1a2e;
  min-height: 100dvh; box-sizing: border-box;
}

/* 상단바 */
.game-stats-glass {
  position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  width: 100%; max-width: 380px; padding: 10px;
  background: rgba(44, 62, 80, 0.8); color: white;
  border-radius: 12px; backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); margin-bottom: 10px;
}
.sound-toggle-btn {
  position: absolute; top: 10px; right: 10px;
  background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
  color: white; width: 30px; height: 30px; border-radius: 50%;
  font-size: 0.9rem; cursor: pointer; transition: all 0.3s; z-index: 10;
}
.stat-item { text-align: center; }
.stat-item span { font-size: 0.8rem; color: #bdc3c7; }
.stat-item strong { font-size: 1.2rem; color: #ffffff; }
.stat-item.gold-stat strong { color: #f1c40f; text-shadow: 0 0 5px #f1c40f; }

.event-banner {
  width: 100%; max-width: 380px; padding: 8px; margin-bottom: 5px;
  background: linear-gradient(90deg, #f1c40f, #f39c12); color: #333;
  font-weight: bold; text-align: center; border-radius: 8px; font-size: 0.9rem;
  box-shadow: 0 0 15px #f1c40f;
}

/* 도구 UI */
.game-tools {
  width: 100%; max-width: 380px; display: flex; justify-content: space-between;
  align-items: center; padding: 0 10px; box-sizing: border-box; margin-bottom: 5px;
}
.tool-button {
  background: linear-gradient(145deg, #6c757d, #495057); border: 1px solid #adb5bd;
  color: white; padding: 8px 15px; border-radius: 8px; cursor: pointer;
  font-size: 1rem; font-weight: bold; display: flex; align-items: center; gap: 8px;
}
.tool-button.active {
  background: linear-gradient(145deg, #e74c3c, #c0392b); border-color: #ff7675;
}
.tool-guide { color: #f1c40f; font-size: 0.9rem; font-weight: bold; animation: pulse-text 1.5s infinite alternate; }
@keyframes pulse-text { from { opacity: 0.7; } to { opacity: 1; } }

/* 게임 영역 */
.game-area-wrapper {
  width: 360px; height: 500px; position: relative; overflow: hidden;
  background: #e0e5ec; border-radius: 0 0 150px 150px; border: 10px solid #78553a;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.2); cursor: pointer; touch-action: none;
  transition: width 0.3s;
}
/* 하드 모드 스타일 */
.game-area-wrapper.hard-mode {
  width: 280px;
  border-color: #c0392b;
  background: #333; /* 어두운 배경 */
}

.deadline {
  position: absolute; width: 100%; height: 2px;
  background-color: #e74c3c; opacity: 0.5; z-index: 50; border-bottom: 2px dashed #e74c3c;
}
.alchemy-item {
  position: absolute; top: 0; left: 0; will-change: transform;
  transition: transform 0.05s linear; z-index: 10; border-radius: 50%;
  display: flex; justify-content: center; align-items: center;
}
.emoji-wrapper { line-height: 1; text-align: center; user-select: none; filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.2)); }
.preview-item {
  position: absolute; top: 10px; left: 0; will-change: transform; z-index: 100;
  pointer-events: none; border-radius: 50%; background-color: rgba(255, 255, 255, 0.7);
  border: 2px dashed #aaa; display: flex; justify-content: center; align-items: center;
}

/* 입장 팝업 */
.entry-modal .modal-content {
  max-width: 400px; width: 90%; background: linear-gradient(145deg, #2c3e50, #34495e);
  color: white; border: 1px solid rgba(255,255,255,0.1);
}
.status-box {
  background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; margin: 15px 0;
}
.status-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 1rem; }
.text-green { color: #2ecc71; } .text-red { color: #e74c3c; } .text-blue { color: #3498db; }

.mode-selector { margin-bottom: 20px; text-align: left; }
.mode-selector p { font-size: 0.9rem; color: #bdc3c7; margin-bottom: 10px; }
.mode-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mode-btn {
  background: rgba(0,0,0,0.2); border: 2px solid transparent;
  color: #ccc; padding: 15px 10px; border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  cursor: pointer; transition: all 0.3s;
}
.mode-btn small { font-size: 0.75rem; opacity: 0.7; font-weight: normal; }
.mode-btn.active { background: rgba(46, 204, 113, 0.2); border-color: #2ecc71; color: #fff; }
.mode-btn.hard.active { background: rgba(231, 76, 60, 0.2); border-color: #e74c3c; }

.info-text { color: #bdc3c7; margin-bottom: 20px; line-height: 1.5; }
.sub-text { font-size: 0.8rem; color: #3498db; }
.button-group { display: flex; flex-direction: column; gap: 10px; }
.btn-lg { width: 100%; padding: 14px; font-size: 1.1rem; border-radius: 10px; }
.purchase-btn { background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); border: none; }
.btn-text { margin-top: 15px; background: none; border: none; color: #bdc3c7; text-decoration: underline; cursor: pointer; }

/* 구매 FAB */
.purchase-fab {
  position: fixed; bottom: 80px; right: 20px; z-index: 50;
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); color: white;
  border-radius: 30px; padding: 8px 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  display: flex; align-items: center; gap: 10px; cursor: pointer;
  border: 2px solid rgba(255,255,255,0.2);
}
.purchase-fab:active { transform: scale(0.95); }
.fab-icon { position: relative; font-size: 1.2rem; }
.plus-badge {
  position: absolute; top: -5px; right: -8px; background: #ff4757; color: white;
  font-size: 0.7rem; font-weight: bold; padding: 2px 4px; border-radius: 50%; border: 1px solid white;
}
.fab-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
.fab-text .label { font-size: 0.75rem; opacity: 0.9; }
.fab-text .cost { font-size: 0.9rem; font-weight: bold; color: #FFD700; }

/* 공통 모달 */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex; justify-content: center; align-items: center; z-index: 200;
}
.modal-content {
  background: white; padding: 30px; border-radius: 12px;
  text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); color: #333;
}
.btn-primary {
  background-color: #007bff; color: white; padding: 12px 25px;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1.1rem; font-weight: bold; margin-top: 10px;
}
.btn-primary:hover { background-color: #0056b3; }
.btn-primary:disabled { background-color: #555; cursor: not-allowed; }
.btn-secondary {
  background-color: #6c757d; color: white; padding: 12px 25px;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1.1rem; font-weight: bold; margin-top: 10px;
}
.loading-spinner {
  display: inline-block; border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #007bff; border-radius: 50%;
  width: 40px; height: 40px; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
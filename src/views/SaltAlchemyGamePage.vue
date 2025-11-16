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
        <span v-if="isGoldenPotMode">획득한 골드</span>
        <span v-else>보유 골드</span>
        <strong v-if="isGoldenPotMode">+ {{ earnedGold.toLocaleString() }} G</strong>
        <strong v-else>{{ goldBalance.toLocaleString() }} G</strong>
      </div>
    </div>
    <div v-if="isGoldenPotMode" class="event-banner">
      <i class="fas fa-coins"></i> 황금 항아리 이벤트 진행 중! (🌟+🌟 = GOLD)
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

    <div v-if="gameStatus !== 'playing'" class="modal-overlay">
      <div class="modal-content">
        <h2 v-if="gameStatus === 'loading'">게임 준비 중...</h2>
        <h2 v-if="gameStatus === 'lost'">게임 오버</h2>
        <p v-if="gameStatus === 'lost'">
          최종 점수: {{ score }}<br />
          획득한 가루: {{ alchemyDust }} 💎<br />
          <strong v-if="earnedGold > 0">획득한 골드: +{{ earnedGold.toLocaleString() }} G</strong>
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import Matter from 'matter-js';
import { functions, auth, db } from '@/firebaseConfig'; // [★복구★] db 임포트
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore'; // [★복구★] getDoc 임포트

// --- [★복구★] BGM 제어 ---
const bgmPlayer = ref(null);
const isSoundPlaying = ref(false);

// --- Matter.js 모듈 ---
const { Engine, Runner, World, Bodies, Events, Composite } = Matter;

// --- Firebase 연동 ---
const startGameFunc = httpsCallable(functions, 'startAlchemyGame');
const endGameFunc = httpsCallable(functions, 'endAlchemyGame');
// [★복구★] '솔트팡 부스터 사용' 함수 호출 (망치 사용 시)
const useBoosterFunc = httpsCallable(functions, 'useSaltPangBooster');
const router = useRouter();

// ▼▼▼ [★복구★] 대시보드 이동 함수 ▼▼▼
const goToDashboard = () => {
  router.push('/dashboard');
};
// ▲▲▲ (복구 완료) ▲▲▲

// --- 게임 기본 상수 ---
const GAME_WIDTH = 360; 
const GAME_HEIGHT = 500; 
const DEADLINE_Y = 60; 

// --- [★복구★] 아이템 정의 (10단계 + BND 폭탄) ---
const BOMB_DEFINITION = { level: 'bomb', emoji: '💣', radius: 20, score: 0 };
const EMOJI_DEFINITIONS = [
  { level: 1, emoji: '🪨', radius: 15, score: 1 },  // 조약돌
  { level: 2, emoji: '🧂', radius: 20, score: 3 },  // 암염
  { level: 3, emoji: '🍚', radius: 25, score: 6 },  // 정제 소금
  { level: 4, emoji: '⚙️', radius: 30, score: 10 }, // 희귀 미네랄
  { level: 5, emoji: '💎', radius: 35, score: 15 }, // 소금 결정
  { level: 6, emoji: '🌈', radius: 40, score: 21 }, // 무지갯빛 결정
  { level: 7, emoji: '🌟', radius: 45, score: 28 }, // 황금 소금
  { level: 8, emoji: '🏺', radius: 50, score: 36 }, // 고대 유물
  { level: 9, emoji: '🔮', radius: 55, score: 45 }, // 명예의 결정
  { level: 10, emoji: '💧', radius: 60, score: 55 } // 헬리아의 눈물
];
const getItemDefinition = (level) => EMOJI_DEFINITIONS[level - 1];

// --- Matter.js 물리 엔진 객체 ---
let engine;
let runner;
let world;
const gameAreaWrapper = ref(null); 
let walls = {};

// --- Vue 반응형 게임 상태 ---
const gameStatus = ref('loading'); 
const reactiveItems = ref([]); 
const score = ref(0);
const highScore = ref(localStorage.getItem('alchemyHighScore') || 0);
const alchemyDust = ref(0); 
const nextItem = ref(null); 
const previewPositionX = ref(GAME_WIDTH / 2);
const canDropItem = ref(true); 
const mergesToProcess = []; 

// --- [★복구★] 신규 모드 및 아이템 상태 변수 추가 ---
const isClearing = ref(false); 
const isProcessingItem = ref(false); 
const hammerMode = ref(false); 
const hammerCount = ref(0); 
const goldBalance = ref(0); // [신규] 보유 골드
const earnedGold = ref(0);  // [신규] 이번 판에 획득한 골드
// --- (복구 완료) ---

// --- [★복구★] 주말(토/일) 감지 '황금 항아리' 모드 ---
const isGoldenPotMode = computed(() => {
  const day = new Date().getDay();
  return day === 6 || day === 0; // 0=일요일, 6=토요일
});
// --- (복구 완료) ---

// --- BGM 토글 함수 (기존과 동일) ---
const toggleSound = () => {
  if (!bgmPlayer.value) return;
  if (isSoundPlaying.value) {
    bgmPlayer.value.pause();
    isSoundPlaying.value = false;
  } else {
    bgmPlayer.value.play().then(() => {
      isSoundPlaying.value = true;
    }).catch(error => {
      console.warn("BGM 재생이 차단되었습니다.", error);
      isSoundPlaying.value = false; 
    });
  }
};

// --- [★복구★] 망치 모드 활성화/사용 함수 ---
const activateHammerMode = () => {
  if (hammerCount.value > 0 && !isClearing.value) {
    hammerMode.value = true;
  }
};

const useHammerOnItem = async (itemId) => {
  if (!hammerMode.value || isClearing.value || isProcessingItem.value) return;

  isClearing.value = true; 
  isProcessingItem.value = true;
  hammerMode.value = false;

  try {
    await useBoosterFunc({ boosterType: 'hammer' });
    hammerCount.value--; 

    const body = Composite.allBodies(world).find(b => b.id === itemId);
    if (body) {
      World.remove(world, body);
    }
  } catch (error) {
    console.error("망치 사용 오류:", error);
    alert(`망치 사용에 실패했습니다: ${error.message}`);
  } finally {
    isClearing.value = false; 
    isProcessingItem.value = false;
  }
};
// --- (복구 완료) ---


// --- 1. Matter.js 초기화 (기존과 동일) ---
const initMatterJS = () => {
  engine = Engine.create();
  world = engine.world;
  engine.world.gravity.y = 0.8; 

  const wallOptions = { isStatic: true, restitution: 0.1, friction: 0.2 };
  walls.floor = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT, GAME_WIDTH, 20, { ...wallOptions, label: 'floor' });
  walls.left = Bodies.rectangle(0, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { ...wallOptions, label: 'wall' });
  walls.right = Bodies.rectangle(GAME_WIDTH, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { ...wallOptions, label: 'wall' });
  walls.deadline = Bodies.rectangle(GAME_WIDTH / 2, DEADLINE_Y, GAME_WIDTH, 2, {
    isStatic: true, isSensor: true, label: 'deadline'
  });

  World.add(world, [walls.floor, walls.left, walls.right, walls.deadline]);

  runner = Runner.create();
  Runner.run(runner, engine);
};

// --- 2. Matter.js 이벤트 리스너 초기화 ---
const initEventListeners = () => {
  Events.on(engine, 'afterUpdate', () => {
    if (isClearing.value) return; 

    const currentBodies = Composite.allBodies(world).filter(b => b.label === 'alchemy-item');
    reactiveItems.value = currentBodies.map(body => ({
      id: body.id, level: body.level, radius: body.circleRadius,
      emoji: body.emoji, x: body.position.x, y: body.position.y, angle: body.angle
    }));

    processMergeQueue();

    if (gameStatus.value === 'playing') {
      checkGameOver();
    }
  });

  // [★복구★] BND 폭탄 로직 추가
  Events.on(engine, 'collisionStart', (event) => {
    if (gameStatus.value !== 'playing' || isClearing.value) return;
    const pairs = event.pairs;

    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;

      if (bodyA.label === 'alchemy-item' && bodyB.label === 'alchemy-item') {
        
        // 1. 폭탄 + 아이템 충돌
        if (bodyA.level === 'bomb' || bodyB.level === 'bomb') {
          // (폭탄끼리 충돌 시, 둘 다 Lv.1(🪨)로 변경)
          if (bodyA.level === 'bomb' && bodyB.level === 'bomb') {
            mergesToProcess.push({ transform: [bodyA, bodyB], toLevel: 1 });
          } else {
            // (폭탄 + 일반 아이템 충돌 시, 둘 다 제거)
            mergesToProcess.push({ remove: [bodyA, bodyB] });
          }
        }
        
        // 2. 일반 아이템 충돌 (기존 로직)
        else if (bodyA.level === bodyB.level) { 
          mergesToProcess.push({ merge: [bodyA, bodyB], toLevel: bodyA.level + 1 });
        }
      }
    }
  });
  // --- (복구 완료) ---
};

// --- 3. [★복구★] 병합 로직 수정 (황금 항아리 모드 적용) ---
const processMergeQueue = () => {
  if (mergesToProcess.length === 0) return;
  isClearing.value = true; 
  
  mergesToProcess.forEach(pair => {
    const bodyA = (pair.merge || pair.remove || pair.transform)[0];
    const bodyB = (pair.merge || pair.remove || pair.transform)[1];
    if (!Composite.get(world, bodyA.id, 'body') || !Composite.get(world, bodyB.id, 'body')) {
      return; 
    }

    if (pair.remove) {
      World.remove(world, [bodyA, bodyB]);
      if (bodyA.level !== 'bomb') { score.value += bodyA.score; alchemyDust.value += Math.floor(bodyA.score / 2) || 1; }
      if (bodyB.level !== 'bomb') { score.value += bodyB.score; alchemyDust.value += Math.floor(bodyB.score / 2) || 1; }
    
    } else if (pair.transform) {
      World.remove(world, [bodyA, bodyB]);
      const newX = (bodyA.position.x + bodyB.position.x) / 2;
      const newY = (bodyA.position.y + bodyB.position.y) / 2;
      const newItem = createAlchemyItem(newX, newY, pair.toLevel);
      World.add(world, newItem);
    
    } else if (pair.merge) {
      const nextLevel = pair.toLevel;

      // ▼▼▼ [★신규★] 황금 항아리 분기 ▼▼▼
      if (isGoldenPotMode.value && nextLevel === 8) { // Lv.7(🌟) + Lv.7(🌟) = 8
        const goldReward = Math.floor(Math.random() * 401) + 100; // 100 ~ 500 G
        earnedGold.value += goldReward;
        
        const itemDef = getItemDefinition(7); 
        score.value += (itemDef.score * 2);
        alchemyDust.value += (Math.floor(itemDef.score / 2) || 1) * 2;
        
        World.remove(world, [bodyA, bodyB]); // 아이템 2개 제거 (새 아이템 생성 X)
      
      } else if (nextLevel > 10) { // Lv.10(💧) + Lv.10(💧) = 11 (최대 레벨)
        const itemDef = getItemDefinition(10);
        score.value += (itemDef.score * 2); // 마지막 점수 2배
        alchemyDust.value += (Math.floor(itemDef.score / 2) || 1) * 2;
        World.remove(world, [bodyA, bodyB]); // 아이템 2개 제거
      
      } else { // ▼▼▼ (기존 일반 합체) ▼▼▼
        const nextItemDef = getItemDefinition(nextLevel);
        score.value += nextItemDef.score;
        alchemyDust.value += Math.floor(nextItemDef.score / 2) || 1;

        const newX = (bodyA.position.x + bodyB.position.x) / 2;
        const newY = (bodyA.position.y + bodyB.position.y) / 2;
        World.remove(world, [bodyA, bodyB]);
        const newItem = createAlchemyItem(newX, newY, nextLevel);
        World.add(world, newItem);
      }
    }
  });

  mergesToProcess.length = 0; 
  isClearing.value = false; 
};
// --- (복구 완료) ---


// --- 4. [★복구★] 아이템 생성 (폭탄 확률) ---
const createAlchemyItem = (x, y, level) => {
  // BND 폭탄 생성
  if (level === 'bomb') {
    return Bodies.circle(x, y, BOMB_DEFINITION.radius, {
      restitution: 0.2, friction: 0.1, label: 'alchemy-item',
      level: 'bomb', emoji: '💣', circleRadius: BOMB_DEFINITION.radius,
      score: 0 
    });
  }
  // 일반 아이템 생성
  const definition = getItemDefinition(level);
  return Bodies.circle(x, y, definition.radius, {
    restitution: 0.2, friction: 0.1, label: 'alchemy-item',
    level: definition.level,
    emoji: definition.emoji, 
    circleRadius: definition.radius,
    score: definition.score // [★추가★] 점수도 바디에 저장
  });
};

const spawnNextItem = () => {
  const rand = Math.random();
  
  if (rand < 0.03) { // 3% 확률로 BND 폭탄 등장
    nextItem.value = BOMB_DEFINITION;
  } else {
    // 1, 2, 3 레벨 아이템만 무작위로 생성
    const nextLevel = Math.floor(Math.random() * 3) + 1;
    nextItem.value = getItemDefinition(nextLevel);
  }
};
// --- (복구 완료) ---

const handleDropItem = () => {
  if (gameStatus.value !== 'playing' || !canDropItem.value || hammerMode.value || isClearing.value) return; 

  canDropItem.value = false;
  const currentItem = nextItem.value;
  if (!currentItem) return;
  
  const newItem = createAlchemyItem(
    Math.max(currentItem.radius, Math.min(previewPositionX.value, GAME_WIDTH - currentItem.radius)),
    DEADLINE_Y + 30, 
    currentItem.level
  );
  World.add(world, newItem);
  spawnNextItem();
  setTimeout(() => { canDropItem.value = true; }, 500); 
};

// --- 5. [★복구★] 게임 오버 처리 (획득 골드 전송) ---
const checkGameOver = () => {
  const bodies = Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label === 'alchemy-item') {
      const itemTopY = body.position.y - body.circleRadius;
      if (itemTopY < DEADLINE_Y && body.speed < 0.1 && body.angularSpeed < 0.1) {
        handleGameOver();
        return;
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
    await endGameFunc({ 
      score: score.value,
      alchemyDust: alchemyDust.value,
      earnedGold: earnedGold.value // [★신규★] 획득 골드 전송
    }); 
  } catch (error) {
    console.error("게임 결과 전송 실패:", error);
  }
};
// --- (복구 완료) ---


// --- 6. [★복구★] 게임 시작 (망치/골드 불러오기) ---
const startGameLogic = async () => {
  if (!auth.currentUser) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }
  
  gameStatus.value = 'loading';
  
  try {
    // 1. 유저 정보에서 망치/골드 개수 미리 가져오기
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      // (솔트팡과 망치 아이템 공유)
      hammerCount.value = userSnap.data().saltPangBoosters?.hammer || 0;
      goldBalance.value = userSnap.data().goldBalance || 0; // [★신규★]
    }

    // 2. 엔진과 월드를 먼저 생성
    initMatterJS(); 
    initEventListeners();
    
    // 3. 입장료 받기
    await startGameFunc(); //
    
    reactiveItems.value = [];
    mergesToProcess.length = 0;
    score.value = 0;
    alchemyDust.value = 0;
    earnedGold.value = 0; // [★신규★]
    
    spawnNextItem(); 
    gameStatus.value = 'playing';
    canDropItem.value = true;
    
  } catch (error) {
    console.error("게임 시작 오류:", error);
    alert(`게임 시작 실패: ${error.message}`);
    gameStatus.value = 'lost'; 
  }
};
// --- (복구 완료) ---

const restartGame = () => {
  cleanupMatterJS(); 
  startGameLogic(); 
};

// --- 7. 유저 입력 핸들러 (기존과 동일) ---
const handleMouseMove = (event) => {
  if (gameStatus.value !== 'playing' || hammerMode.value) return; 
  const rect = gameAreaWrapper.value.getBoundingClientRect();
  previewPositionX.value = event.clientX - rect.left;
};
const handleMouseLeave = () => {};
const handleTouchMove = (event) => {
  if (gameStatus.value !== 'playing' || hammerMode.value) return; 
  const rect = gameAreaWrapper.value.getBoundingClientRect();
  previewPositionX.value = event.touches[0].clientX - rect.left;
};
const handleTouchEnd = () => {
  if (hammerMode.value) return; 
  handleDropItem();
};

// --- 8. Vue 스타일 바인딩 (기존과 동일) ---
const previewItemStyle = computed(() => {
  if (!nextItem.value) return { display: 'none' };
  const def = nextItem.value.level === 'bomb' ? BOMB_DEFINITION : getItemDefinition(nextItem.value.level); 
  const x = Math.max(def.radius, Math.min(previewPositionX.value, GAME_WIDTH - def.radius));
  return {
    width: `${def.radius * 2}px`,
    height: `${def.radius * 2}px`,
    transform: `translate(${x - def.radius}px, 10px)`, 
    opacity: canDropItem.value ? 0.8 : 0.3
  };
});

const getItemStyle = (item) => ({
  width: `${item.radius * 2}px`,
  height: `${item.radius * 2}px`,
  transform: `translate(${item.x - item.radius}px, ${item.y - item.radius}px) rotate(${item.angle}rad)`,
  zIndex: item.level === 'bomb' ? 20 : item.level, 
  backgroundColor: item.level === 'bomb' ? '#333' : `var(--lv-${item.level}-bg)`, 
  border: item.level === 'bomb' ? '2px solid #ff0000' : `2px solid var(--lv-${item.level}-border)` 
});

// --- 9. 컴포넌트 생명주기 (기존과 동일, BGM 관련 포함) ---
const cleanupMatterJS = () => {
  if (runner) Runner.stop(runner);
  if (world) World.clear(world);
  if (engine) Engine.clear(engine);
  reactiveItems.value = [];
};

onMounted(() => {
  nextTick(() => {
    startGameLogic();
    if (bgmPlayer.value) {
      bgmPlayer.value.volume = 0.3; 
      bgmPlayer.value.play().then(() => {
        isSoundPlaying.value = true;
      }).catch(error => {
        console.warn("BGM 자동재생이 차단되었습니다. 음소거 버튼을 눌러주세요.", error);
        isSoundPlaying.value = false;
      });
    }
  });
});

onUnmounted(() => {
  cleanupMatterJS();
  if (bgmPlayer.value) {
    bgmPlayer.value.pause();
  }
});
</script>

<style scoped>
/* ( ... :root, .salt-alchemy-page ... ) */
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

/* ▼▼▼ [★핵심 10★] 스탯바 2x2 그리드로 수정 ▼▼▼ */
.game-stats-glass {
  position: relative; 
  display: grid;
  /* (수정) 3열 -> 2열 */
  grid-template-columns: 1fr 1fr; 
  gap: 10px; /* (추가) */
  width: 100%; max-width: 380px; padding: 10px;
  background: rgba(44, 62, 80, 0.8); color: white;
  border-radius: 12px; backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  box-sizing: border-box; margin-bottom: 10px;
}
.sound-toggle-btn {
  position: absolute; top: 10px; right: 10px;
  background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
  color: white; width: 30px; height: 30px;
  border-radius: 50%; font-size: 0.9rem; cursor: pointer;
  transition: all 0.3s ease; z-index: 10;
}
.sound-toggle-btn:hover { background: rgba(255, 255, 255, 0.2); }
.stat-item { text-align: center; }
.stat-item span { font-size: 0.8rem; color: #bdc3c7; }
.stat-item strong { font-size: 1.2rem; color: #ffffff; }
/* (신규) 골드 스탯 색상 */
.stat-item.gold-stat strong {
  color: #f1c40f; 
  text-shadow: 0 0 5px #f1c40f;
}
/* ▲▲▲ (수정 완료) ▲▲▲ */


/* ▼▼▼ [★복구★] 게임 도구(망치) UI 스타일 추가 ▼▼▼ */
.game-tools {
  width: 100%;
  max-width: 380px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  box-sizing: border-box;
  margin-bottom: 5px;
}
.tool-button {
  background: linear-gradient(145deg, #6c757d, #495057);
  border: 1px solid #adb5bd;
  color: white;
  padding: 8px 15px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}
.tool-button:hover:not(:disabled) {
  background: linear-gradient(145deg, #868e96, #5a6268);
  box-shadow: 0 0 10px rgba(173, 181, 189, 0.5);
}
.tool-button.active {
  background: linear-gradient(145deg, #e74c3c, #c0392b);
  border-color: #ff7675;
  box-shadow: 0 0 15px rgba(231, 76, 60, 0.7);
}
.tool-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tool-guide {
  color: #f1c40f;
  font-size: 0.9rem;
  font-weight: bold;
  animation: pulse-text 1.5s infinite alternate;
}
@keyframes pulse-text {
  from { opacity: 0.7; }
  to { opacity: 1; }
}
/* ▲▲▲ (복구 완료) ▲▲▲ */

/* (신규) 이벤트 배너 */
.event-banner {
  width: 100%;
  max-width: 380px;
  padding: 8px;
  margin-bottom: 5px;
  background: linear-gradient(90deg, #f1c40f, #f39c12);
  color: #333;
  font-weight: bold;
  text-align: center;
  border-radius: 8px;
  font-size: 0.9rem;
  box-shadow: 0 0 15px #f1c40f;
}

/* ( ... .game-area-wrapper, .deadline, .alchemy-item, .emoji-wrapper, .preview-item, .modal-overlay, .modal-content, .btn-primary, .btn-secondary, .loading-spinner ... 기존 스타일 ... ) */
.game-area-wrapper {
  width: 360px; height: 500px; position: relative;
  overflow: hidden; background: #e0e5ec;
  border-radius: 0 0 150px 150px; border: 10px solid #78553a;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
  cursor: pointer; touch-action: none; 
}
.deadline {
  position: absolute; width: 100%; height: 2px;
  background-color: #e74c3c; opacity: 0.5;
  z-index: 50; border-bottom: 2px dashed #e74c3c;
}
.alchemy-item {
  position: absolute; top: 0; left: 0;
  will-change: transform; transition: transform 0.05s linear;
  z-index: 10; border-radius: 50%;
  display: flex; justify-content: center; align-items: center;
}
.emoji-wrapper {
  line-height: 1; text-align: center;
  user-select: none; filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.2));
}
.preview-item {
  position: absolute; top: 10px; left: 0;
  will-change: transform; z-index: 100;
  pointer-events: none; transition: opacity 0.2s;
  border-radius: 50%; background-color: rgba(255, 255, 255, 0.7);
  border: 2px dashed #aaa;
  display: flex; justify-content: center; align-items: center;
}
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center; z-index: 200;
}
.modal-content {
  background: white; padding: 30px; border-radius: 12px;
  text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
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
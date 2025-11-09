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
          획득한 가루: {{ alchemyDust }} 💎
        </p>
        <div v-if="gameStatus === 'loading'" class="loading-spinner"></div>
        <button v-if="gameStatus === 'lost'" @click="restartGame" class="btn-primary">
          다시하기
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import Matter from 'matter-js';
import { functions, auth } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

// --- [★핵심 추가★] BGM 제어 ---
const bgmPlayer = ref(null);
const isSoundPlaying = ref(false);

// --- Matter.js 모듈 ---
const { Engine, Runner, World, Bodies, Events, Composite } = Matter;

// --- Firebase 연동 ---
const startGameFunc = httpsCallable(functions, 'startAlchemyGame');
const endGameFunc = httpsCallable(functions, 'endAlchemyGame');
const router = useRouter();

// --- 게임 기본 상수 ---
const GAME_WIDTH = 360; // 게임 항아리 너비 (px)
const GAME_HEIGHT = 500; // 게임 항아리 높이 (px)
const DEADLINE_Y = 60; // 이 선을 넘으면 게임 오버

// --- 아이템 정의 (10단계 이모지 리스트) ---
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
const gameAreaWrapper = ref(null); // Vue 템플릿의 div와 연결
let walls = {};

// --- Vue 반응형 게임 상태 ---
const gameStatus = ref('loading'); // 'loading', 'playing', 'lost'
const reactiveItems = ref([]); // Vue가 렌더링할 아이템 목록
const score = ref(0);
const highScore = ref(localStorage.getItem('alchemyHighScore') || 0);
const alchemyDust = ref(0); // 획득한 연금술 가루
const nextItem = ref(null); // 다음에 떨어뜨릴 아이템
const previewPositionX = ref(GAME_WIDTH / 2);
const canDropItem = ref(true); // 아이템 드랍 쿨다운
const mergesToProcess = []; // [중요] 병합 대기열

// --- [★핵심 추가★] BGM 토글 함수 ---
const toggleSound = () => {
  if (!bgmPlayer.value) return;
  if (isSoundPlaying.value) {
    bgmPlayer.value.pause();
    isSoundPlaying.value = false;
  } else {
    // play()는 프로미스를 반환하며, 사용자 상호작용 없이 실패할 수 있음
    bgmPlayer.value.play().then(() => {
      isSoundPlaying.value = true;
    }).catch(error => {
      console.warn("BGM 재생이 차단되었습니다. 사용자의 상호작용이 필요합니다.", error);
      isSoundPlaying.value = false; // 실패 시 상태 원복
    });
  }
};

// --- 1. Matter.js 초기화 ---
const initMatterJS = () => {
  engine = Engine.create();
  world = engine.world;
  engine.world.gravity.y = 0.8; // 중력

  // 항아리 벽 생성
  const wallOptions = { isStatic: true, restitution: 0.1, friction: 0.2 };
  walls.floor = Bodies.rectangle(GAME_WIDTH / 2, GAME_HEIGHT, GAME_WIDTH, 20, { ...wallOptions, label: 'floor' });
  walls.left = Bodies.rectangle(0, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { ...wallOptions, label: 'wall' });
  walls.right = Bodies.rectangle(GAME_WIDTH, GAME_HEIGHT / 2, 20, GAME_HEIGHT, { ...wallOptions, label: 'wall' });
  
  // 게임 오버 감지 센서
  walls.deadline = Bodies.rectangle(GAME_WIDTH / 2, DEADLINE_Y, GAME_WIDTH, 2, {
    isStatic: true,
    isSensor: true, // 충돌은 감지하되 물리적 영향은 없음
    label: 'deadline'
  });

  World.add(world, [walls.floor, walls.left, walls.right, walls.deadline]);

  // 물리 엔진 실행
  runner = Runner.create();
  Runner.run(runner, engine);
};

// --- 2. Matter.js 이벤트 리스너 초기화 ---
const initEventListeners = () => {
  // [A] 매 프레임마다 Vue 데이터와 동기화
  Events.on(engine, 'afterUpdate', () => {
    // 1. 물리 객체 목록을 Vue 반응형 배열로 복사
    const currentBodies = Composite.allBodies(world).filter(b => b.label === 'alchemy-item');
    reactiveItems.value = currentBodies.map(body => ({
      id: body.id,
      level: body.level,
      radius: body.circleRadius,
      emoji: body.emoji, 
      x: body.position.x,
      y: body.position.y,
      angle: body.angle
    }));

    // 2. 병합 대기열 처리 (핵심)
    processMergeQueue();

    // 3. 게임 오버 체크 (비동기)
    if (gameStatus.value === 'playing') {
      checkGameOver();
    }
  });

  // [B] 충돌 시작 시 (병합 감지)
  Events.on(engine, 'collisionStart', (event) => {
    if (gameStatus.value !== 'playing') return;
    const pairs = event.pairs;

    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;

      // 둘 다 아이템이고, 레벨이 같고, 최고 레벨이 아니어야 함
      if (bodyA.label === 'alchemy-item' && bodyB.label === 'alchemy-item' &&
          bodyA.level === bodyB.level && bodyA.level < 10) {
        
        // [중요] 물리 루프 중 객체를 바로 제거/생성하면 불안정함
        // 큐에 추가하여 'afterUpdate' 루프에서 처리
        mergesToProcess.push({ bodyA, bodyB });
      }
    }
  });
};

// --- 3. 핵심 로직: 아이템 병합 처리 ---
const processMergeQueue = () => {
  if (mergesToProcess.length === 0) return;

  mergesToProcess.forEach(pair => {
    const { bodyA, bodyB } = pair;

    // (방어 코드) 아이템이 이미 다른 병합으로 제거되었는지 확인
    if (!Composite.get(world, bodyA.id, 'body') || !Composite.get(world, bodyB.id, 'body')) {
      return;
    }

    const nextLevel = bodyA.level + 1;
    const nextItemDef = getItemDefinition(nextLevel);

    // 1. 점수 및 가루 획득
    score.value += nextItemDef.score;
    alchemyDust.value += Math.floor(nextItemDef.score / 2) || 1; // 점수의 50%를 가루로 획득

    // 2. 병합 위치 계산
    const newX = (bodyA.position.x + bodyB.position.x) / 2;
    const newY = (bodyA.position.y + bodyB.position.y) / 2;

    // 3. 기존 두 아이템 제거
    World.remove(world, [bodyA, bodyB]);

    // 4. 새 아이템 생성
    const newItem = createAlchemyItem(newX, newY, nextLevel);
    World.add(world, newItem);
  });

  mergesToProcess.length = 0; // 큐 비우기
};

// --- 4. 핵심 로직: 아이템 생성 및 드랍 ---
const createAlchemyItem = (x, y, level) => {
  const definition = getItemDefinition(level);
  return Bodies.circle(x, y, definition.radius, {
    restitution: 0.2, // 탄성
    friction: 0.1,    // 마찰
    label: 'alchemy-item',
    // Vue가 참조할 커스텀 데이터
    level: definition.level,
    emoji: definition.emoji, 
    circleRadius: definition.radius
  });
};

const spawnNextItem = () => {
  // 1, 2, 3 레벨 아이템만 무작위로 생성
  const nextLevel = Math.floor(Math.random() * 3) + 1;
  nextItem.value = getItemDefinition(nextLevel);
};

const handleDropItem = () => {
  if (gameStatus.value !== 'playing' || !canDropItem.value) return;

  canDropItem.value = false;
  const currentItem = nextItem.value;
  if (!currentItem) return;
  
  // 1. 현재 아이템을 물리 엔진에 추가
  const newItem = createAlchemyItem(
    Math.max(currentItem.radius, Math.min(previewPositionX.value, GAME_WIDTH - currentItem.radius)), // 벽에 끼지 않도록
    DEADLINE_Y + 30, // 데드라인 살짝 아래
    currentItem.level
  );
  World.add(world, newItem);

  // 2. 다음 아이템 준비
  spawnNextItem();

  // 3. 드랍 쿨다운
  setTimeout(() => {
    canDropItem.value = true;
  }, 500); // 0.5초 쿨다운
};

// --- 5. 핵심 로직: 게임 오버 처리 ---
const checkGameOver = () => {
  const bodies = Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label === 'alchemy-item') {
      // 아이템의 *상단*이 데드라인을 넘었는지 확인
      const itemTopY = body.position.y - body.circleRadius;
      
      // 데드라인을 넘었고, 속도가 거의 0이라면 (즉, 멈춰있다면) 게임 오버
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
  Runner.stop(runner); // 물리 엔진 정지

  // 최고 점수 갱신
  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('alchemyHighScore', score.value);
  }

  // 백엔드에 결과 전송
  try {
    // [★수정★] endGameFunc에 score와 alchemyDust를 모두 전송
    await endGameFunc({ 
      score: score.value,
      alchemyDust: alchemyDust.value 
    }); 
  } catch (error) {
    console.error("게임 결과 전송 실패:", error);
    // (에러가 나도 재시작은 가능하도록 함)
  }
};

// --- 6. 게임 시작 및 재시작 ---
const startGameLogic = async () => {
  if (!auth.currentUser) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }
  
  gameStatus.value = 'loading';
  
try {
    // 1. 엔진과 월드를 먼저 생성
    initMatterJS(); 
    initEventListeners();
    
    // 2. 입장료 받기
    await startGameFunc(); //
    
    // 4. (기존 로직) 상태 초기화
    reactiveItems.value = [];
    mergesToProcess.length = 0;
    score.value = 0;
    alchemyDust.value = 0;
    
    spawnNextItem(); // 첫 아이템 준비
    gameStatus.value = 'playing';
    canDropItem.value = true;
    
  } catch (error) {
    console.error("게임 시작 오류:", error);
    alert(`게임 시작 실패: ${error.message}`);
    // [★수정★] 게임 시작 실패 시 로딩 모달을 닫고 'lost' 상태로 변경
    gameStatus.value = 'lost'; 
    // router.push('/dashboard'); // (대시보드로 튕기지 않고 '다시하기' 버튼 표시)
  }
};

const restartGame = () => {
  cleanupMatterJS(); // 이전 엔진 완전 제거
  startGameLogic(); // 새 게임 시작
};

// --- 7. 유저 입력 핸들러 (PC/모바일) ---
const handleMouseMove = (event) => {
  if (gameStatus.value !== 'playing') return;
  const rect = gameAreaWrapper.value.getBoundingClientRect();
  previewPositionX.value = event.clientX - rect.left;
};
const handleMouseLeave = () => {
  // 마우스가 떠나도 마지막 위치 기억
};
const handleTouchMove = (event) => {
  if (gameStatus.value !== 'playing') return;
  const rect = gameAreaWrapper.value.getBoundingClientRect();
  previewPositionX.value = event.touches[0].clientX - rect.left;
};
const handleTouchEnd = () => {
  handleDropItem();
};

// --- 8. Vue 스타일 바인딩 ---
const previewItemStyle = computed(() => {
  if (!nextItem.value) return { display: 'none' };
  const def = nextItem.value;
  const x = Math.max(def.radius, Math.min(previewPositionX.value, GAME_WIDTH - def.radius));
  return {
    width: `${def.radius * 2}px`,
    height: `${def.radius * 2}px`,
    transform: `translate(${x - def.radius}px, 10px)`, // 상단 10px에 고정
    opacity: canDropItem.value ? 0.8 : 0.3
  };
});

const getItemStyle = (item) => ({
  width: `${item.radius * 2}px`,
  height: `${item.radius * 2}px`,
  transform: `translate(${item.x - item.radius}px, ${item.y - item.radius}px) rotate(${item.angle}rad)`,
  zIndex: item.level,
  backgroundColor: `var(--lv-${item.level}-bg)`,
  border: `2px solid var(--lv-${item.level}-border)`
});

// --- 9. 컴포넌트 생명주기 ---
const cleanupMatterJS = () => {
  if (runner) Runner.stop(runner);
  if (world) World.clear(world);
  if (engine) Engine.clear(engine);
  reactiveItems.value = [];
};

onMounted(() => {
  nextTick(() => {
    startGameLogic();

    // --- [★핵심 추가★] BGM 자동재생 시도 ---
    if (bgmPlayer.value) {
      // 볼륨을 0.3으로 줄여서 시작
      bgmPlayer.value.volume = 0.3; 
      bgmPlayer.value.play().then(() => {
        isSoundPlaying.value = true;
      }).catch(error => {
        console.warn("BGM 자동재생이 차단되었습니다. 음소거 버튼을 눌러주세요.", error);
        isSoundPlaying.value = false;
      });
    }
    // --- (추가 완료) ---
  });
});

onUnmounted(() => {
  cleanupMatterJS();
  // --- [★핵심 추가★] BGM 정지 ---
  if (bgmPlayer.value) {
    bgmPlayer.value.pause();
  }
  // --- (추가 완료) ---
});
</script>

<style scoped>
/* [★추가★] 레벨별 색상 변수 */
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
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background-color: #1a1a2e; /* 어두운 배경 */
  min-height: 100dvh;
  box-sizing: border-box;
}

/* 상단 스탯바 */
.game-stats-glass {
  /* [★수정★] 버튼을 넣기 위해 position: relative 추가 */
  position: relative; 
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  max-width: 380px; /* 게임 컨테이너보다 살짝 넓게 */
  padding: 10px;
  background: rgba(44, 62, 80, 0.8);
  color: white;
  border-radius: 12px;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
  margin-bottom: 10px;
}

/* ▼▼▼ [★핵심 추가★] BGM 음소거 버튼 스타일 ▼▼▼ */
.sound-toggle-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
}
.sound-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
/* ▲▲▲ (추가 완료) ▲▲▲ */

.stat-item {
  text-align: center;
}
.stat-item span {
  font-size: 0.8rem;
  color: #bdc3c7;
}
.stat-item strong {
  font-size: 1.2rem;
  color: #ffffff;
}

/* 게임 영역 (항아리) */
.game-area-wrapper {
  width: 360px; /* GAME_WIDTH */
  height: 500px; /* GAME_HEIGHT */
  position: relative;
  overflow: hidden;
  background: #e0e5ec; /* 밝은 회색 배경 (항아리 내부) */
  border-radius: 0 0 150px 150px; /* 항아리 모양 (하단 둥글게) */
  border: 10px solid #78553a; /* 항아리 테두리 */
  box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
  cursor: pointer;
  touch-action: none; /* 모바일 스크롤 방지 */
}

/* 게임 오버 라인 */
.deadline {
  position: absolute;
  width: 100%;
  height: 2px;
  background-color: #e74c3c;
  opacity: 0.5;
  z-index: 50;
  border-bottom: 2px dashed #e74c3c;
}

/* 떨어지는 아이템 (Vue 렌더링) */
.alchemy-item {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
  transition: transform 0.05s linear;
  z-index: 10;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 이모지 스타일 */
.emoji-wrapper {
  line-height: 1;
  text-align: center;
  user-select: none; /* 드래그 방지 */
  filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.2));
  /* 폰트 크기는 style 바인딩으로 제어됨 */
}

/* 다음 아이템 미리보기 */
.preview-item {
  position: absolute;
  top: 10px; /* 상단 고정 */
  left: 0; /* transform으로 X 위치 제어 */
  will-change: transform;
  z-index: 100;
  pointer-events: none; /* 클릭 방지 */
  transition: opacity 0.2s;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.7);
  border: 2px dashed #aaa;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 모달 (기존과 동일) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 200;
}
.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.btn-primary {
  background-color: #007bff;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: bold;
  margin-top: 10px;
  transition: background-color 0.2s ease;
}
.btn-primary:hover {
  background-color: #0056b3;
}
.loading-spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
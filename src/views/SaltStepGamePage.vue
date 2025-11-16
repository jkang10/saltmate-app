<template>
  <div class="step-game-page" @mousedown.prevent="handleTap" @touchstart.prevent="handleTap">
    <div class="game-stats-glass">
      <div class="stat-item">
        <span>최고 계단</span>
        <strong>{{ highScore }}</strong>
      </div>
      <div class="stat-item score">
        <span>현재 계단</span>
        <strong>{{ score }}</strong>
      </div>
      <div class="stat-item-group">
        <div class="stat-item micro">
          <span><i class="fas fa-coins"></i> G</span>
          <strong>{{ earnedGold }}</strong>
        </div>
        <div class="stat-item micro">
          <span>💎</span>
          <strong>{{ alchemyDust }}</strong>
        </div>
      </div>
    </div>

    <div class="game-canvas-wrapper" ref="gameWrapperRef">
      <canvas ref="gameCanvasRef"></canvas>
      <div v-if="comboMessage" class="combo-popup">
        {{ comboMessage }}
      </div>
    </div>
    
    <div v-if="gameStatus !== 'playing'" class="modal-overlay">
      <div class="modal-content">
        <h2 v-if="gameStatus === 'loading'">게임 준비 중...</h2>
        <h2 v-if="gameStatus === 'lost'">게임 오버!</h2>
        <p v-if="gameStatus === 'lost'">
          최종 계단: {{ score }}<br />
          획득한 가루: {{ alchemyDust }} 💎<br />
          획득한 골드: {{ earnedGold }} G<br />
          <strong>획득한 SaltMate: {{ finalPointsAwarded }} P</strong>
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
// ▼▼▼ [★핵심 수정 1★] 'nextTick' 제거 ▼▼▼
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
// ▼▼▼ [★핵심 수정 2★] 'db' 제거 ▼▼▼
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
// ▼▼▼ [★핵심 수정 3★] 'doc', 'getDoc' import 라인 전체 제거 ▼▼▼
// import { doc, getDoc } from 'firebase/firestore'; 

// --- [★핵심★] 재사용할 에셋 임포트 ---
import gemImageSrc from '@/assets/gems/gem_1.png'; 
import avatarBodySrc from '@/assets/avatar/body_male.png';
import avatarOutfitSrc from '@/assets/avatar/outfit_hoodie.png';

// --- Firebase ---
const startGameFunc = httpsCallable(functions, 'startSaltStepGame');
const endGameFunc = httpsCallable(functions, 'endSaltStepGame');
const router = useRouter();

// --- 게임 상태 ---
const gameStatus = ref('loading');
const score = ref(0);
const highScore = ref(localStorage.getItem('saltStepHighScore') || 0);
const alchemyDust = ref(0);
const earnedGold = ref(0);
const finalPointsAwarded = ref(0);
const comboMessage = ref('');

// --- Canvas 및 게임 로직 ---
const gameWrapperRef = ref(null);
const gameCanvasRef = ref(null);
let ctx = null;
let gameLoopId = null;
let canvasWidth = 300;
let canvasHeight = 600;

// --- 게임 객체 ---
const player = reactive({ x: 0, y: 0, width: 40, height: 60, targetSide: 'left' });
const stairs = ref([]);
let cameraY = 0;
let gameSpeed = 1.0; 
let currentStairIndex = 0;

// ▼▼▼ [★핵심 수정 4★] 'isClearing' 변수 선언 추가 ▼▼▼
const isClearing = ref(false); // (애니메이션 등 처리 중 탭 방지)
// ▲▲▲ (수정 완료) ▲▲▲

// --- [★핵심★] 에셋 로딩 ---
const assets = {
  playerBody: new Image(),
  playerOutfit: new Image(),
  stair: new Image(),
};
let assetsLoaded = 0;
const loadAssets = () => {
  return new Promise((resolve) => {
    const totalAssets = Object.keys(assets).length;
    
    assets.playerBody.src = avatarBodySrc;
    assets.playerBody.onload = () => { assetsLoaded++; if(assetsLoaded === totalAssets) resolve(); };
    
    assets.playerOutfit.src = avatarOutfitSrc;
    assets.playerOutfit.onload = () => { assetsLoaded++; if(assetsLoaded === totalAssets) resolve(); };
    
    assets.stair.src = gemImageSrc;
    assets.stair.onload = () => { assetsLoaded++; if(assetsLoaded === totalAssets) resolve(); };
  });
};

// --- 1. 게임 초기화/시작/재시작 ---
onMounted(async () => {
  await loadAssets(); 
  
  const wrapper = gameWrapperRef.value;
  canvasWidth = wrapper.clientWidth;
  canvasHeight = wrapper.clientHeight;
  gameCanvasRef.value.width = canvasWidth;
  gameCanvasRef.value.height = canvasHeight;
  
  startGameLogic();
});

onUnmounted(() => {
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
});

const startGameLogic = async () => {
  gameStatus.value = 'loading';
  try {
    await startGameFunc(); // 백엔드에 100P 지불
    initGame();
    gameStatus.value = 'playing';
    gameLoopId = requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error("게임 시작 오류:", error);
    alert(`게임 시작 실패: ${error.message}`);
    gameStatus.value = 'lost';
  }
};
const initGame = () => {
  ctx = gameCanvasRef.value.getContext('2d');
  score.value = 0;
  alchemyDust.value = 0;
  earnedGold.value = 0;
  finalPointsAwarded.value = 0;
  cameraY = 0;
  gameSpeed = 1.0;
  currentStairIndex = 0;
  isClearing.value = false; // [★추가★]
  
  stairs.value = [];
  const stairWidth = canvasWidth / 2.5;
  const stairHeight = 30;
  
  stairs.value.push({
    x: (canvasWidth / 4) - (stairWidth / 2),
    y: canvasHeight - 100,
    width: stairWidth,
    height: stairHeight,
    side: 'left',
    disappearTimer: 2.0 
  });
  
  for (let i = 1; i < 20; i++) {
    spawnStair();
  }
  
  const startStair = stairs.value[0];
  player.x = startStair.x + (stairWidth / 2) - (player.width / 2);
  player.y = startStair.y - player.height;
  player.targetSide = 'left';
};

const restartGame = () => {
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  startGameLogic();
};
const goToDashboard = () => router.push('/dashboard');

// --- 2. 게임 루프 (Update/Draw) ---
let lastTime = 0;
const gameLoop = (timestamp) => {
  if (gameStatus.value !== 'playing') return;
  
  const deltaTime = (timestamp - lastTime) / 1000 || 0;
  lastTime = timestamp;
  
  update(deltaTime);
  draw();
  gameLoopId = requestAnimationFrame(gameLoop);
};

const update = (deltaTime) => {
  const currentStair = stairs.value[currentStairIndex];
  if (currentStair) {
    currentStair.disappearTimer -= deltaTime * gameSpeed;
    if (currentStair.disappearTimer <= 0) {
      handleGameOver("시간 초과!");
      return;
    }
  }

  const targetCameraY = (canvasHeight * 0.6) - player.y;
  cameraY += (targetCameraY - cameraY) * 0.1; 

  if (player.y > cameraY + canvasHeight) {
    handleGameOver("추락!");
    return;
  }
  
  // [★수정★] 100점마다 속도 증가 (score.value % 100 === 0은 프레임마다 호출되어 버그 발생)
  if (score.value > 0 && score.value % 100 === 0 && score.value / 100 > (gameSpeed - 1) * 10) {
    gameSpeed += 0.1; 
  }
};

const draw = () => {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  ctx.save();
  ctx.translate(0, cameraY);
  
  stairs.value.forEach(stair => {
    const opacity = Math.max(0, stair.disappearTimer / 2.0);
    ctx.globalAlpha = opacity;
    ctx.drawImage(assets.stair, stair.x, stair.y, stair.width, stair.height);
    
    ctx.globalAlpha = 1.0;
    if (stair.reward === 'dust') {
      ctx.font = '24px sans-serif';
      ctx.fillText('💎', stair.x + stair.width / 2 - 12, stair.y - 15);
    } else if (stair.reward === 'gold') {
      ctx.font = '24px sans-serif';
      ctx.fillText('🌟', stair.x + stair.width / 2 - 12, stair.y - 15);
    }
  });
  
  ctx.drawImage(assets.playerBody, player.x, player.y, player.width, player.height);
  ctx.drawImage(assets.playerOutfit, player.x, player.y, player.width, player.height);

  ctx.restore(); 
};

// --- 3. 조작 (핵심 로직) ---
const handleTap = () => {
  if (gameStatus.value !== 'playing' || isClearing.value) return;

  const currentStair = stairs.value[currentStairIndex];
  const nextStair = stairs.value[currentStairIndex + 1];
  
  if (!currentStair || !nextStair) return;

  const nextSide = player.targetSide === 'left' ? 'right' : 'left';
  
  if (nextStair.side === nextSide) {
    currentStairIndex++;
    score.value++;
    
    if (nextStair.reward === 'dust') {
      alchemyDust.value++;
      nextStair.reward = null; 
      showComboMessage("+1 💎");
    } else if (nextStair.reward === 'gold') {
      earnedGold.value += 10;
      nextStair.reward = null; 
      showComboMessage("+10 G");
    }
    
    player.x = nextStair.x + (nextStair.width / 2) - (player.width / 2);
    player.y = nextStair.y - player.height;
    player.targetSide = nextSide;
    
    spawnStair();
    
    // ▼▼▼ [★핵심 수정 5★] 퀘스트 업데이트는 백엔드(endSaltStepGame)에서 하므로 이 줄 삭제 ▼▼▼
    // updateQuestProgress(auth.currentUser.uid, 'playSaltStep', 1);
    // ▲▲▲ (수정 완료) ▲▲▲

  } else {
    handleGameOver("잘못된 스텝!");
  }
};

const showComboMessage = (msg) => {
  comboMessage.value = msg;
  setTimeout(() => { comboMessage.value = ''; }, 1000);
};

// --- 4. 계단 스폰 ---
const spawnStair = () => {
  const lastStair = stairs.value[stairs.value.length - 1];
  const newSide = lastStair.side === 'left' ? 'right' : 'left';
  const stairWidth = canvasWidth / 2.5;
  const stairHeight = 30;
  const newX = (newSide === 'left')
    ? (canvasWidth / 4) - (stairWidth / 2) 
    : (canvasWidth * 0.75) - (stairWidth / 2); 
  
  let reward = null;
  if (stairs.value.length % 30 === 0) reward = 'dust';
  if (stairs.value.length % 100 === 0) reward = 'gold';

  stairs.value.push({
    x: newX,
    y: lastStair.y - 120, 
    width: stairWidth,
    height: stairHeight,
    side: newSide,
    disappearTimer: 2.0 / gameSpeed, 
    reward: reward
  });
  
  if (stairs.value.length > currentStairIndex + 20) {
    stairs.value.shift();
    currentStairIndex--; 
  }
};

// --- 5. 게임 오버 ---
const handleGameOver = async (reason) => {
  if (gameStatus.value !== 'playing') return;
  
  console.log("게임 오버:", reason);
  gameStatus.value = 'lost';
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoopId = null;

  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('saltStepHighScore', score.value);
  }
  
  try {
    const result = await endGameFunc({ 
      score: score.value,
      alchemyDust: alchemyDust.value,
      earnedGold: earnedGold.value
    });
    finalPointsAwarded.value = result.data.awardedPoints || 0;
  } catch (error) {
    console.error("게임 결과 전송 실패:", error);
  }
};
</script>

<style scoped>
.step-game-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background-color: #1a1a2e;
  min-height: 100dvh;
  box-sizing: border-box;
  overflow: hidden; /* 페이지 스크롤 방지 */
}

/* (솔트 알케미 스탯바 재활용) */
.game-stats-glass {
  display: grid;
  grid-template-columns: 1fr 1.5fr 1fr; /* 중앙 점수칸을 더 넓게 */
  width: 100%;
  max-width: 400px;
  padding: 10px 15px;
  background: rgba(44, 62, 80, 0.8);
  color: white;
  border-radius: 12px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 10px;
  z-index: 10;
}
.stat-item { text-align: center; }
.stat-item span { font-size: 0.8rem; color: #bdc3c7; }
.stat-item strong { font-size: 1.2rem; color: #ffffff; }
.stat-item.score strong {
  font-size: 1.8rem;
  color: #f1c40f;
  text-shadow: 0 0 8px #f1c40f;
}
.stat-item-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-end;
}
.stat-item.micro {
  display: flex;
  gap: 5px;
  align-items: baseline;
  text-align: right;
}
.stat-item.micro strong { font-size: 1.1rem; color: #f1c40f; }
.stat-item.micro span { font-size: 0.9rem; }


.game-canvas-wrapper {
  width: 100%;
  max-width: 400px;
  height: 75vh; /* 화면의 75% 높이 */
  max-height: 700px;
  background: linear-gradient(180deg, #3f2b96 0%, #a8c0ff 70%, #f1c40f 100%); /* 하늘 배경 */
  border: 3px solid #78553a;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}
canvas {
  width: 100%;
  height: 100%;
}

/* (콤보 팝업 스타일 재활용) */
.combo-popup {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(46, 204, 113, 0.9);
  color: #fff;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 1.3rem;
  font-weight: bold;
  z-index: 100;
  animation: fadeOut 1s ease forwards;
}
@keyframes fadeOut {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -100%) scale(0.9); }
}

/* (모달 스타일 재활용) */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex; justify-content: center; align-items: center; z-index: 200;
}
.modal-content {
  background: white; padding: 30px; border-radius: 12px;
  text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.modal-content p {
  font-size: 1.2rem;
  line-height: 1.6;
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
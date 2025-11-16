<template>
  <div class="bubble-shooter-page">
    <div class="game-stats-glass">
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
      class="game-canvas-wrapper" 
      ref="gameWrapperRef"
      @mousedown.prevent="handlePointerDown"
      @touchstart.prevent="handlePointerDown"
      @mousemove.prevent="handlePointerMove"
      @touchmove.prevent="handlePointerMove"
      @mouseup.prevent="handlePointerUp"
      @touchend.prevent="handlePointerUp"
    >
      <canvas ref="gameCanvasRef"></canvas>
      <div v-if="comboMessage" class="combo-popup">
        {{ comboMessage }}
      </div>
    </div>
    
    <div class="game-bottom-bar">
      <div class="bubble-holder">
        <strong>NEXT:</strong>
        <div class="bubble-next" :style="{ backgroundColor: getBubbleColor(nextBubbleColor) }">
          </div>
        </div>
      <div class="bubble-holder">
        <strong>SHOTS: {{ shotsLeft }}</strong>
      </div>
    </div>

    <div v-if="gameStatus !== 'playing'" class="modal-overlay">
      <div class="modal-content">
        <h2 v-if="gameStatus === 'loading'">게임 준비 중...</h2>
        <h2 v-if="gameStatus === 'lost'">게임 오버</h2>
        <p v-if="gameStatus === 'lost'">
          최종 점수: {{ score }}<br />
          획득한 가루: {{ alchemyDust }} 💎<br />
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
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
// ▼▼▼ [★핵심 수정★] 'auth' import 제거 (오류 수정) ▼▼▼
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
// ▲▲▲ (수정 완료) ▲▲▲

// ▼▼▼ [★핵심 수정★] 이미지 import 구문 모두 제거 ▼▼▼
// import gem1 from '@/assets/gems/gem_1.png';
// ... (gem2 ~ gem6 import 모두 삭제) ...
// ▲▲▲ (수정 완료) ▲▲▲

// --- Firebase ---
const startGameFunc = httpsCallable(functions, 'startBubbleGame');
const endGameFunc = httpsCallable(functions, 'endBubbleGame');
const router = useRouter();

// --- 게임 상태 ---
const gameStatus = ref('loading');
// ▼▼▼ [★핵심 수정★] 누락된 변수 2개 선언 (오류 수정) ▼▼▼
const isClearing = ref(false); // (콤보/애니메이션 중 입력 방지)
const canDropItem = ref(true); // (버블 발사 쿨다운)
// ▲▲▲ (수정 완료) ▲▲▲
const score = ref(0);
const highScore = ref(localStorage.getItem('bubbleShooterHighScore') || 0);
const alchemyDust = ref(0);
const finalPointsAwarded = ref(0);
const comboMessage = ref('');

// --- Canvas 및 게임 로직 ---
const gameWrapperRef = ref(null);
const gameCanvasRef = ref(null);
let ctx = null;
let gameLoopId = null;
let board = [];
let currentBubble = reactive({ color: 0, x: 0, y: 0 });
let nextBubbleColor = ref(0);
let projectile = null;
let isAiming = false;
let aimAngle = ref(-Math.PI / 2); // (위로)
let shotsLeft = ref(5);

// --- [★핵심★] 게임 설정 (육각 그리드 기준) ---
const COLS = 10;
const ROWS = 13; 
const BUBBLE_RADIUS = 18; 
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const HEX_WIDTH = BUBBLE_DIAMETER * 0.866; 
const HEX_HEIGHT = BUBBLE_DIAMETER * 0.75; 
const COLORS = [1, 2, 3, 4, 5, 6]; // 6가지 젬 컬러
const DEADLINE_Y = HEX_HEIGHT * (ROWS - 1.5);
let boardOffsetY = 0; 
let canvasWidth = 360;
let canvasHeight = 550;
let shooterPos = reactive({ x: canvasWidth / 2, y: canvasHeight - 30 });

// ▼▼▼ [★핵심 수정★] 젬 이미지 로드 관련 코드 모두 제거 ▼▼▼
// const gemImages = reactive({});
// const loadImages = () => { ... };
// ▲▲▲ (수정 완료) ▲▲▲

const getBubbleColor = (colorId) => {
  // (이미지 로드 실패 시, 색상으로 대체)
  const colorMap = { 
    1: '#e74c3c', // 빨강 (Gem 1)
    2: '#2ecc71', // 초록 (Gem 2)
    3: '#3498db', // 파랑 (Gem 3)
    4: '#f1c40f', // 노랑 (Gem 4)
    5: '#9b59b6', // 보라 (Gem 5)
    6: '#e67e22'  // 주황 (Gem 6)
  };
  return colorMap[colorId] || '#bdc3c7'; // (회색)
};

// --- 1. 게임 초기화/시작/재시작 ---
onMounted(() => {
  // ▼▼▼ [★핵심 수정★] await loadImages() 제거 ▼▼▼
  // await loadImages(); 
  startGameLogic();
  // ▲▲▲ (수정 완료) ▲▲▲
  
  // (ResizeObserver 추가: Canvas 크기 조절)
  const observer = new ResizeObserver(entries => {
    if (entries[0] && gameCanvasRef.value) { 
      const width = entries[0].contentRect.width;
      canvasWidth = width;
      canvasHeight = (width / 10) * 15; // 10:15 비율
      gameCanvasRef.value.width = canvasWidth;
      gameCanvasRef.value.height = canvasHeight;
      shooterPos.x = canvasWidth / 2;
      shooterPos.y = canvasHeight - 30;
    }
  });
  if (gameWrapperRef.value) {
    observer.observe(gameWrapperRef.value);
  }
  onUnmounted(() => observer.disconnect());
});

const startGameLogic = async () => {
  gameStatus.value = 'loading';
  try {
    await startGameFunc(); //
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
  if (!gameCanvasRef.value) return; 
  ctx = gameCanvasRef.value.getContext('2d');
  board = Array(ROWS).fill(0).map(() => Array(COLS).fill(0));
  boardOffsetY = 0;
  shotsLeft.value = 5;
  score.value = 0;
  alchemyDust.value = 0;
  finalPointsAwarded.value = 0;
  projectile = null;
  // 5줄 미리 채우기
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r % 2 === 1) && (c === COLS - 1)) continue; // 홀수 줄 마지막 칸 비우기
      board[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
  }
  spawnBubble();
  spawnBubble();
};
const restartGame = () => {
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  startGameLogic();
};
const goToDashboard = () => router.push('/dashboard');

// --- 2. 게임 루프 (Update/Draw) ---
const gameLoop = () => {
  if (gameStatus.value !== 'playing') {
    if(gameLoopId) cancelAnimationFrame(gameLoopId); // [★추가★] 루프 확실히 중단
    return; 
  }
  update();
  draw();
  gameLoopId = requestAnimationFrame(gameLoop);
};
const update = () => {
  if (!projectile) return;
  
  projectile.x += projectile.dx;
  projectile.y += projectile.dy;

  // 1. 벽 충돌 (좌/우)
  if (projectile.x - BUBBLE_RADIUS < 0 || projectile.x + BUBBLE_RADIUS > canvasWidth) {
    projectile.dx *= -1; // x속도 반전
    projectile.x = Math.max(BUBBLE_RADIUS, Math.min(projectile.x, canvasWidth - BUBBLE_RADIUS));
  }
  // 2. 천장 충돌
  if (projectile.y - BUBBLE_RADIUS < boardOffsetY) {
    snapProjectileToGrid();
    return;
  }
  // 3. 버블 충돌
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bubble = board[r][c];
      if (bubble) {
        const bubblePos = getBubbleCoords(r, c);
        const dx = projectile.x - bubblePos.x;
        const dy = projectile.y - bubblePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BUBBLE_DIAMETER - 5) { // (충돌 판정)
          snapProjectileToGrid();
          return;
        }
      }
    }
  }
};
const draw = () => {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1. 보드 그리기
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bubbleColor = board[r][c];
      if (bubbleColor) {
        const pos = getBubbleCoords(r, c);
        drawBubble(pos.x, pos.y, bubbleColor);
      }
    }
  }
  // 2. 발사체 그리기
  if (projectile) {
    drawBubble(projectile.x, projectile.y, projectile.color);
  }
  // 3. 현재 버블 그리기 (발사대에)
  if (currentBubble.color) {
    drawBubble(shooterPos.x, shooterPos.y, currentBubble.color);
  }
  // 4. 조준선 그리기
  if (isAiming) {
    drawAimingLine();
  }
  // 5. 데드라인
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(0, DEADLINE_Y, canvasWidth, 3);
};

// --- 3. 조작 (터치/마우스) ---
const handlePointerDown = (e) => {
  if (gameStatus.value !== 'playing' || !canDropItem.value) return;
  isAiming = true;
  updateAim(e);
};
const handlePointerMove = (e) => {
  if (!isAiming) return;
  updateAim(e);
};
const handlePointerUp = () => {
  if (!isAiming || !canDropItem.value) return;
  isAiming = false;
  fireBubble();
};
const updateAim = (e) => {
  if (!gameCanvasRef.value) return; 
  const rect = gameCanvasRef.value.getBoundingClientRect();
  const pos = (e.touches ? e.touches[0] : e);
  const x = pos.clientX - rect.left;
  const y = pos.clientY - rect.top;
  
  let angle = Math.atan2(y - shooterPos.y, x - shooterPos.x);
  if (angle > -0.1) angle = -0.1;
  if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1;
  aimAngle.value = angle;
};

// --- 4. 핵심 로직 (발사, 스폰, 스냅) ---
const fireBubble = () => {
  if (!currentBubble.color || isClearing.value) return;
  
  projectile = {
    x: shooterPos.x, y: shooterPos.y,
    dx: Math.cos(aimAngle.value) * 10,
    dy: Math.sin(aimAngle.value) * 10,
    color: currentBubble.color
  };
  
  spawnBubble(); // 새 버블 스폰
  canDropItem.value = false;
  shotsLeft.value--;
};
const spawnBubble = () => {
  currentBubble.color = nextBubbleColor.value;
  nextBubbleColor.value = COLORS[Math.floor(Math.random() * COLORS.length)];
};
const snapProjectileToGrid = async () => {
  if (!projectile) return;
  
  // 1. 가장 가까운 빈 육각 그리드 찾기
  let minDist = Infinity;
  let bestPos = { r: 0, c: 0 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 0) { // 빈 칸만
        const pos = getBubbleCoords(r, c);
        const dx = projectile.x - pos.x;
        const dy = projectile.y - pos.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          bestPos = { r, c };
        }
      }
    }
  }
  
  const { r, c } = bestPos;
  board[r][c] = projectile.color;
  const snappedColor = projectile.color;
  projectile = null; // 발사체 제거
  isClearing.value = true; 

  // 2. 매치 찾기
  const matches = findMatches(r, c, snappedColor);
  
  let totalPopped = 0;
  let totalDropped = 0;

  if (matches.length >= 3) {
    totalPopped += matches.length;
    matches.forEach(([r, c]) => board[r][c] = 0); 
    
    const orphans = findOrphans();
    totalDropped += orphans.length;
    orphans.forEach(([r, c]) => board[r][c] = 0);
  }
  
  // 5. 보상 계산
  score.value += totalPopped * 10;
  score.value += totalDropped * 50;
  if (totalDropped >= 5) {
    alchemyDust.value++;
    comboMessage.value = `콤보! +${totalDropped * 50}점 / +1 가루💎`;
    setTimeout(() => comboMessage.value = '', 1500);
  }
  
  // 6. 천장 내리기
  if (shotsLeft.value <= 0) {
    await dropCeiling();
    shotsLeft.value = 5;
  }
  
  // 7. 게임 오버 체크
  if (checkGameOver()) {
    handleGameOver();
  }
  
  isClearing.value = false;
  canDropItem.value = true; // 다음 샷 허용
};

// --- 5. 콤보 로직 (BFS/Flood Fill) ---
const findMatches = (r, c, color) => {
  const matches = [];
  const q = [[r, c]];
  const visited = new Set([`${r},${c}`]);
  
  while (q.length > 0) {
    const [cr, cc] = q.shift();
    if (board[cr] && board[cr][cc] === color) { 
      matches.push([cr, cc]);
      getNeighbors(cr, cc).forEach(([nr, nc]) => {
        if (board[nr] && board[nr][nc] === color && !visited.has(`${nr},${nc}`)) {
          visited.add(`${nr},${nc}`);
          q.push([nr, nc]);
        }
      });
    }
  }
  return matches;
};
const findOrphans = () => {
  const connected = new Set();
  const q = [];
  for (let c = 0; c < COLS; c++) {
    if (board[0][c]) {
      q.push([0, c]);
      connected.add(`0,${c}`);
    }
  }
  while (q.length > 0) {
    const [cr, cc] = q.shift();
    getNeighbors(cr, cc).forEach(([nr, nc]) => {
      if (board[nr] && board[nr][nc] && !connected.has(`${nr},${nc}`)) {
        connected.add(`${nr},${nc}`);
        q.push([nr, nc]);
      }
    });
  }
  const orphans = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && !connected.has(`${r},${c}`)) {
        orphans.push([r, c]);
      }
    }
  }
  return orphans;
};
const getNeighbors = (r, c) => {
  const isOddRow = r % 2 === 1;
  const neighbors = [];
  const dirs = isOddRow
    ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]] // 홀수 줄
    : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]; // 짝수 줄
  
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      neighbors.push([nr, nc]);
    }
  }
  return neighbors;
};
const dropCeiling = () => {
  boardOffsetY += HEX_HEIGHT / 2; // (애니메이션 효과)
  
  const newRow = Array(COLS).fill(0).map((_, c) => {
    if ((0 % 2 === 1) && (c === COLS - 1)) return 0;
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  });
  board.pop(); // 마지막 줄 제거
  board.unshift(newRow); // 새 줄 추가
};

// --- 6. 게임 오버 ---
const checkGameOver = () => {
  for (let c = 0; c < COLS; c++) {
    if (board[ROWS - 2][c]) { // 데드라인 바로 윗줄
      return true;
    }
  }
  return false;
};
const handleGameOver = async () => {
  if (gameStatus.value !== 'playing') return;
  gameStatus.value = 'lost';
  cancelAnimationFrame(gameLoopId);
  gameLoopId = null;

  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem('bubbleShooterHighScore', score.value);
  }
  try {
    const result = await endGameFunc({ 
      score: score.value,
      alchemyDust: alchemyDust.value 
    });
    finalPointsAwarded.value = result.data.awardedPoints || 0;
  } catch (error) {
    console.error("게임 결과 전송 실패:", error);
  }
};

// --- 7. 그리기 헬퍼 ---
const getBubbleCoords = (r, c) => {
  const x = (c * HEX_WIDTH) + (r % 2 === 1 ? HEX_WIDTH / 2 : 0) + BUBBLE_RADIUS;
  const y = (r * HEX_HEIGHT) + BUBBLE_RADIUS + boardOffsetY;
  return { x, y };
};
// ▼▼▼ [★핵심 수정 3★] 이미지 로직 제거, 색상/하이라이트만 그리도록 수정 ▼▼▼
const drawBubble = (x, y, colorId) => {
  // 1. 메인 색상
  ctx.fillStyle = getBubbleColor(colorId);
  ctx.beginPath();
  ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // 2. 입체감을 위한 간단한 하이라이트 추가
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(x - BUBBLE_RADIUS * 0.3, y - BUBBLE_RADIUS * 0.3, BUBBLE_RADIUS * 0.4, 0, Math.PI * 2);
  ctx.fill();
};
// ▲▲▲ (수정 완료) ▲▲▲

const drawAimingLine = () => {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 10]);
  
  let x = shooterPos.x;
  let y = shooterPos.y;
  let angle = aimAngle.value;
  
  ctx.beginPath();
  ctx.moveTo(x, y);
  
  for (let i = 0; i < 50; i++) { // 50 세그먼트
    let dx = Math.cos(angle) * 15;
    let dy = Math.sin(angle) * 15;
    
    // 벽 반사
    if (x + dx - BUBBLE_RADIUS < 0 || x + dx + BUBBLE_RADIUS > canvasWidth) {
      angle = Math.PI - angle;
      dx = Math.cos(angle) * 15;
      dy = Math.sin(angle) * 15;
    }
    
    x += dx;
    y += dy;
    
    if (y < boardOffsetY) break; // 천장
    
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
};
</script>

<style scoped>
.bubble-shooter-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  background-color: #1a1a2e;
  min-height: 100dvh;
  box-sizing: border-box;
}
.game-stats-glass {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  max-width: 380px;
  padding: 10px 20px;
  background: rgba(44, 62, 80, 0.8);
  color: white;
  border-radius: 12px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 10px;
}
.stat-item { text-align: center; }
.stat-item span { font-size: 0.8rem; color: #bdc3c7; }
.stat-item strong { font-size: 1.2rem; color: #ffffff; }

.game-canvas-wrapper {
  width: 100%;
  max-width: 360px;
  aspect-ratio: 10 / 15; /* 10열 15행 비율 */
  background-color: #2c3e50;
  border: 3px solid #78553a;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  touch-action: none; /* 모바일 스크롤 방지 */
}
canvas {
  width: 100%;
  height: 100%;
}
.game-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 360px;
  padding: 10px;
  background: rgba(44, 62, 80, 0.8);
  color: white;
  border-radius: 0 0 12px 12px;
}
.bubble-holder {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: bold;
}
.bubble-next {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid white;
}
.bubble-next img {
  width: 100%;
  height: 100%;
}
.combo-popup {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(241, 196, 15, 0.9);
  color: #2c3e50;
  padding: 15px 30px;
  border-radius: 10px;
  font-size: 1.5rem;
  font-weight: bold;
  z-index: 100;
  animation: fadeOut 1.5s ease forwards;
}
@keyframes fadeOut {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -100%) scale(0.9); }
}

/* ( ... 모달 스타일은 SaltBlockPuzzleGame과 100% 동일 ... ) */
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
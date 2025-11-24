<template>
  <div class="bubble-shooter-page">
    <audio ref="bgmPlayer" src="/sound/freepik-future-disco.mp3" loop preload="auto"></audio>
    
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
        <h2><i class="fas fa-gamepad"></i> 솔트 버블</h2>
        
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
          <div class="status-row">
            <span>내 포인트:</span>
            <strong>{{ userPoints.toLocaleString() }} P</strong>
          </div>
        </div>

        <p class="info-text">
          <span v-if="dailyPlaysLeft > 0">입장료: <strong>100 SaltMate</strong> (일일 횟수 차감)</span>
          <span v-else-if="userTicketCount > 0">입장료: <strong>무료</strong> (티켓 1장 사용 / 보상 50%)</span>
          <span v-else class="text-red">입장 가능한 횟수가 없습니다.<br>티켓을 구매해주세요!</span>
        </p>

        <div class="button-group">
          <button 
            @click="handleStartGame" 
            class="btn-primary btn-lg"
            :disabled="!canStartGame"
          >
            게임 시작
          </button>

          <button 
            @click="buyPlayTicket" 
            class="btn-secondary btn-lg purchase-btn"
            :disabled="isBuying"
          >
            <span v-if="isBuying">구매 중...</span>
            <span v-else><i class="fas fa-shopping-cart"></i> 티켓 구매 (1,000 P)</span>
          </button>
        </div>

        <button @click="goToDashboard" class="btn-text">나가기</button>
      </div>
    </div>
    <div v-if="gameStatus === 'lost'" class="modal-overlay">
      <div class="modal-content">
        <h2>게임 오버</h2>
        <p>
          최종 점수: {{ score }}<br />
          획득한 가루: {{ alchemyDust }} 💎<br />
          <small v-if="isPurchasedSession" style="color: #ff6b6b;">(추가 플레이: 보상 50% 적용)</small><br/>
          <strong>획득한 SaltMate: {{ finalPointsAwarded }} P</strong>
        </p>
        <button @click="refreshAndShowEntry" class="btn-primary">
          다시하기
        </button>
        <button @click="goToDashboard" class="btn-secondary">
          대시보드로 나가기
        </button>
      </div>
    </div>

    <div v-if="gameStatus === 'loading'" class="modal-overlay transparent">
      <div class="loading-spinner"></div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { functions, db, auth } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';

// --- Firebase Functions ---
const startGameFunc = httpsCallable(functions, 'startBubbleGame');
const endGameFunc = httpsCallable(functions, 'endBubbleGame');
const purchasePlaysFunc = httpsCallable(functions, 'purchaseBubblePlays');
const router = useRouter();

// --- BGM 제어 ---
const bgmPlayer = ref(null);
const isSoundPlaying = ref(false);

// --- 게임 상태 ---
const gameStatus = ref('idle'); // idle, playing, lost, loading
const showEntryModal = ref(true); // [신규] 입장 모달 표시 여부
const isClearing = ref(false); 
const canDropItem = ref(true); 
const score = ref(0);
const highScore = ref(localStorage.getItem('bubbleShooterHighScore') || 0);
const alchemyDust = ref(0);
const finalPointsAwarded = ref(0);
const comboMessage = ref('');

// --- [신규] 유저 정보 상태 ---
const dailyPlaysLeft = ref(0);
const userTicketCount = ref(0);
const userPoints = ref(0);
const isBuying = ref(false);
const isPurchasedSession = ref(false);

// --- Canvas 및 게임 로직 변수 ---
const gameWrapperRef = ref(null);
const gameCanvasRef = ref(null);
let ctx = null;
let gameLoopId = null;
let board = [];
let currentBubble = reactive({ color: 0, x: 0, y: 0 });
let nextBubbleColor = ref(0);
let projectile = null;
let isAiming = false;
let aimAngle = ref(-Math.PI / 2); 
let shotsLeft = ref(5);

// --- 게임 설정 ---
const COLS = 10;
const ROWS = 13; 
const BUBBLE_RADIUS = 18; 
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const HEX_WIDTH = BUBBLE_DIAMETER * 0.866; 
const HEX_HEIGHT = BUBBLE_DIAMETER * 0.75; 
const COLORS = [1, 2, 3, 4, 5, 6];
const DEADLINE_Y = HEX_HEIGHT * (ROWS - 1.5);
let boardOffsetY = 0; 
let canvasWidth = 360;
let canvasHeight = 550;
let shooterPos = reactive({ x: canvasWidth / 2, y: canvasHeight - 30 });

// --- Computed ---
const canStartGame = computed(() => {
  // 무료 횟수가 남았거나 티켓이 있어야 함
  if (dailyPlaysLeft.value > 0) return userPoints.value >= 100;
  return userTicketCount.value > 0;
});

// --- [신규] 유저 상태 조회 함수 ---
const fetchUserStatus = async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // 1. 유저 기본 정보 (포인트, 티켓)
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      userPoints.value = data.saltmatePoints || 0;
      userTicketCount.value = data.purchasedBubblePlays || 0;
    }

    // 2. 일일 플레이 횟수
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayStr = new Date(now.getTime() + kstOffset).toISOString().slice(0, 10);
    const countRef = doc(db, 'users', user.uid, 'daily_play_counts', todayStr);
    const countSnap = await getDoc(countRef);
    
    const used = countSnap.exists() ? (countSnap.data().bubbleShooter || 0) : 0;
    dailyPlaysLeft.value = Math.max(0, 10 - used);

  } catch (e) {
    console.error("유저 정보 로드 실패:", e);
  }
};

// --- [신규] 게임 시작 버튼 핸들러 ---
const handleStartGame = () => {
  showEntryModal.value = false;
  startGameLogic();
};

// --- [신규] 재시작 시 팝업 띄우기 ---
const refreshAndShowEntry = async () => {
  gameStatus.value = 'idle';
  await fetchUserStatus(); // 정보 갱신
  showEntryModal.value = true;
};

// --- 1. 초기화 ---
onMounted(async () => {
  // 게임 바로 시작 안함 -> 정보 로드 후 팝업 표시
  await fetchUserStatus();
  
  const observer = new ResizeObserver(entries => {
    if (entries[0] && gameCanvasRef.value) { 
      const width = entries[0].contentRect.width;
      canvasWidth = width;
      canvasHeight = (width / 10) * 15; 
      gameCanvasRef.value.width = canvasWidth;
      gameCanvasRef.value.height = canvasHeight;
      shooterPos.x = canvasWidth / 2;
      shooterPos.y = canvasHeight - 30;
    }
  });
  if (gameWrapperRef.value) observer.observe(gameWrapperRef.value);

  // BGM 준비
  if (bgmPlayer.value) bgmPlayer.value.volume = 0.3;

  onUnmounted(() => {
    observer.disconnect();
    if (bgmPlayer.value) bgmPlayer.value.pause();
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
  });
});

// --- 게임 시작 로직 (서버 호출) ---
const startGameLogic = async () => {
  gameStatus.value = 'loading';
  try {
    const result = await startGameFunc(); 
    isPurchasedSession.value = result.data.isPurchasedPlay || false;

    if (isPurchasedSession.value) {
        console.log("유료 플레이권 사용: 보상 50% 적용됨");
    }

    // BGM 재생
    if (bgmPlayer.value && !isSoundPlaying.value) {
        bgmPlayer.value.play().then(() => isSoundPlaying.value = true).catch(() => {});
    }

    initGame();
    gameStatus.value = 'playing';
    gameLoopId = requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error("게임 시작 오류:", error);
    let msg = error.message;
    if (msg.includes("resource-exhausted")) {
        msg = "입장 가능한 횟수가 없습니다.\n티켓을 구매해주세요!";
    }
    alert(msg);
    
    // 실패 시 다시 입장 팝업으로
    gameStatus.value = 'idle';
    await fetchUserStatus();
    showEntryModal.value = true;
  }
};

// --- 티켓 구매 함수 ---
const buyPlayTicket = async () => {
    if (isBuying.value) return;
    if (!confirm("1,000 SaltMate로 '추가 플레이 10회'를 구매하시겠습니까?\n(주의: 추가 플레이 시 보상은 50%만 지급됩니다)")) return;

    isBuying.value = true;
    try {
        const result = await purchasePlaysFunc();
        alert(result.data.message);
        // 구매 후 정보 갱신
        await fetchUserStatus();
    } catch (error) {
        console.error("구매 실패:", error);
        alert(error.message);
    } finally {
        isBuying.value = false;
    }
};

// ... (이하 게임 로직 함수들: initGame, update, draw, handlePointerDown 등은 기존과 동일하므로 생략하지 않고 포함합니다) ...

const getBubbleColor = (colorId) => {
  const colorMap = { 
    1: '#e74c3c', 2: '#2ecc71', 3: '#3498db', 
    4: '#f1c40f', 5: '#9b59b6', 6: '#e67e22'  
  };
  return colorMap[colorId] || '#bdc3c7';
};

const toggleSound = () => {
  if (!bgmPlayer.value) return;
  if (isSoundPlaying.value) {
    bgmPlayer.value.pause();
    isSoundPlaying.value = false;
  } else {
    bgmPlayer.value.play().then(() => isSoundPlaying.value = true).catch(() => {});
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
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r % 2 === 1) && (c === COLS - 1)) continue; 
      board[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
  }
  spawnBubble();
  spawnBubble();
};

const goToDashboard = () => router.push('/dashboard');

const gameLoop = () => {
  if (gameStatus.value !== 'playing') {
    if(gameLoopId) cancelAnimationFrame(gameLoopId); 
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

  if (projectile.x - BUBBLE_RADIUS < 0 || projectile.x + BUBBLE_RADIUS > canvasWidth) {
    projectile.dx *= -1; 
    projectile.x = Math.max(BUBBLE_RADIUS, Math.min(projectile.x, canvasWidth - BUBBLE_RADIUS));
  }
  if (projectile.y - BUBBLE_RADIUS < boardOffsetY) {
    snapProjectileToGrid();
    return;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bubble = board[r][c];
      if (bubble) {
        const bubblePos = getBubbleCoords(r, c);
        const dx = projectile.x - bubblePos.x;
        const dy = projectile.y - bubblePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BUBBLE_DIAMETER - 5) { 
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
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bubbleColor = board[r][c];
      if (bubbleColor) {
        const pos = getBubbleCoords(r, c);
        drawBubble(pos.x, pos.y, bubbleColor);
      }
    }
  }
  if (projectile) drawBubble(projectile.x, projectile.y, projectile.color);
  if (currentBubble.color) drawBubble(shooterPos.x, shooterPos.y, currentBubble.color);
  if (isAiming) drawAimingLine();
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(0, DEADLINE_Y, canvasWidth, 3);
};

const handlePointerDown = (e) => {
  if (gameStatus.value !== 'playing' || !canDropItem.value) return;
  isAiming = true;
  updateAim(e);
};
const handlePointerMove = (e) => { if (!isAiming) return; updateAim(e); };
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

const fireBubble = () => {
  if (!currentBubble.color || isClearing.value) return;
  projectile = {
    x: shooterPos.x, y: shooterPos.y,
    dx: Math.cos(aimAngle.value) * 10,
    dy: Math.sin(aimAngle.value) * 10,
    color: currentBubble.color
  };
  spawnBubble(); 
  canDropItem.value = false;
  shotsLeft.value--;
};
const spawnBubble = () => {
  currentBubble.color = nextBubbleColor.value;
  nextBubbleColor.value = COLORS[Math.floor(Math.random() * COLORS.length)];
};
const snapProjectileToGrid = async () => {
  if (!projectile) return;
  let minDist = Infinity;
  let bestPos = { r: 0, c: 0 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 0) { 
        const pos = getBubbleCoords(r, c);
        const dx = projectile.x - pos.x;
        const dy = projectile.y - pos.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) { minDist = dist; bestPos = { r, c }; }
      }
    }
  }
  const { r, c } = bestPos;
  board[r][c] = projectile.color;
  const snappedColor = projectile.color;
  projectile = null; 
  isClearing.value = true; 
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
  score.value += totalPopped * 10;
  score.value += totalDropped * 50;
  if (totalDropped >= 5) {
    alchemyDust.value++;
    comboMessage.value = `콤보! +${totalDropped * 50}점 / +1 가루💎`;
    setTimeout(() => comboMessage.value = '', 1500);
  }
  if (shotsLeft.value <= 0) {
    await dropCeiling();
    shotsLeft.value = 5;
  }
  if (checkGameOver()) handleGameOver();
  isClearing.value = false;
  canDropItem.value = true; 
};

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
    if (board[0][c]) { q.push([0, c]); connected.add(`0,${c}`); }
  }
  while (q.length > 0) {
    const [cr, cc] = q.shift();
    getNeighbors(cr, cc).forEach(([nr, nc]) => {
      if (board[nr] && board[nr][nc] && !connected.has(`${nr},${nc}`)) {
        connected.add(`${nr},${nc}`); q.push([nr, nc]);
      }
    });
  }
  const orphans = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] && !connected.has(`${r},${c}`)) orphans.push([r, c]);
    }
  }
  return orphans;
};
const getNeighbors = (r, c) => {
  const isOddRow = r % 2 === 1;
  const neighbors = [];
  const dirs = isOddRow
    ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]] 
    : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]; 
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) neighbors.push([nr, nc]);
  }
  return neighbors;
};
const dropCeiling = () => {
  boardOffsetY += HEX_HEIGHT / 2; 
  const newRow = Array(COLS).fill(0).map((_, c) => {
    if ((0 % 2 === 1) && (c === COLS - 1)) return 0;
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  });
  board.pop(); board.unshift(newRow); 
};

const checkGameOver = () => {
  for (let c = 0; c < COLS; c++) { if (board[ROWS - 2][c]) return true; }
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
      alchemyDust: alchemyDust.value,
      isPurchasedPlay: isPurchasedSession.value
    });
    finalPointsAwarded.value = result.data.awardedPoints || 0;
  } catch (error) {
    console.error("게임 결과 전송 실패:", error);
  }
};
const getBubbleCoords = (r, c) => {
  const x = (c * HEX_WIDTH) + (r % 2 === 1 ? HEX_WIDTH / 2 : 0) + BUBBLE_RADIUS;
  const y = (r * HEX_HEIGHT) + BUBBLE_RADIUS + boardOffsetY;
  return { x, y };
};
const drawBubble = (x, y, colorId) => {
  ctx.fillStyle = getBubbleColor(colorId);
  ctx.beginPath();
  ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(x - BUBBLE_RADIUS * 0.3, y - BUBBLE_RADIUS * 0.3, BUBBLE_RADIUS * 0.4, 0, Math.PI * 2);
  ctx.fill();
};
const drawAimingLine = () => {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 10]);
  let x = shooterPos.x; let y = shooterPos.y; let angle = aimAngle.value;
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let i = 0; i < 50; i++) { 
    let dx = Math.cos(angle) * 15; let dy = Math.sin(angle) * 15;
    if (x + dx - BUBBLE_RADIUS < 0 || x + dx + BUBBLE_RADIUS > canvasWidth) {
      angle = Math.PI - angle; dx = Math.cos(angle) * 15; dy = Math.sin(angle) * 15;
    }
    x += dx; y += dy;
    if (y < boardOffsetY) break; 
    ctx.lineTo(x, y);
  }
  ctx.stroke(); ctx.setLineDash([]);
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
  position: relative;
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
.stat-item { text-align: center; }
.stat-item span { font-size: 0.8rem; color: #bdc3c7; }
.stat-item strong { font-size: 1.2rem; color: #ffffff; }

.game-canvas-wrapper {
  width: 100%;
  max-width: 360px;
  aspect-ratio: 10 / 15; 
  background-color: #2c3e50;
  border: 3px solid #78553a;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  touch-action: none; 
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

/* 플레이권 구매 버튼 */
.purchase-fab {
  position: fixed;
  bottom: 80px; /* 하단 바 위에 위치 */
  right: 20px;
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  color: white;
  border-radius: 30px;
  padding: 8px 16px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  z-index: 50;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  border: 2px solid rgba(255,255,255,0.2);
}
.purchase-fab:active { transform: scale(0.95); }
.purchase-fab.is-loading { opacity: 0.7; pointer-events: none; filter: grayscale(1); }
.fab-icon { position: relative; font-size: 1.2rem; display: flex; align-items: center; }
.plus-badge { position: absolute; top: -5px; right: -8px; background: #ff4757; color: white; font-size: 0.7rem; font-weight: bold; padding: 2px 4px; border-radius: 50%; border: 1px solid white; }
.fab-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
.fab-text .label { font-size: 0.75rem; opacity: 0.9; }
.fab-text .cost { font-size: 0.9rem; font-weight: bold; color: #FFD700; }

/* 입장 팝업 (Entry Modal) */
.entry-modal .modal-content {
  max-width: 400px;
  width: 90%;
  background: linear-gradient(145deg, #2c3e50, #34495e);
  color: white;
  border: 1px solid rgba(255,255,255,0.1);
}
.status-box {
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 15px;
  margin: 20px 0;
}
.status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 1.1rem;
}
.status-row:last-child { margin-bottom: 0; }
.text-green { color: #2ecc71; }
.text-red { color: #e74c3c; }
.text-blue { color: #3498db; }
.info-text {
  margin-bottom: 20px;
  color: #bdc3c7;
  font-size: 0.95rem;
  line-height: 1.5;
}
.button-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.btn-lg {
  width: 100%;
  padding: 14px;
  font-size: 1.1rem;
  border-radius: 10px;
}
.purchase-btn {
  background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
  border: none;
}
.btn-text {
  margin-top: 15px;
  background: none;
  border: none;
  color: #bdc3c7;
  text-decoration: underline;
  cursor: pointer;
}

.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex; justify-content: center; align-items: center; z-index: 200;
}
.modal-overlay.transparent { background-color: rgba(0,0,0,0.3); }
.modal-content {
  background: white; padding: 30px; border-radius: 12px;
  text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  color: #333;
}
.modal-content h2 { margin-top: 0; }
.btn-primary {
  background-color: #007bff; color: white; padding: 12px 25px;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1.1rem; font-weight: bold; margin-top: 10px;
  transition: background-color 0.2s ease; width: 100%; box-sizing: border-box;
}
.btn-primary:hover { background-color: #0056b3; }
.btn-primary:disabled { background-color: #555; cursor: not-allowed; }
.btn-secondary {
  background-color: #6c757d; color: white; padding: 12px 25px;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1.1rem; font-weight: bold; margin-top: 10px;
  transition: background-color 0.2s ease; width: 100%; box-sizing: border-box;
}
.btn-secondary:hover { background-color: #5a6268; }
.loading-spinner {
  display: inline-block; border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #007bff; border-radius: 50%;
  width: 40px; height: 40px; animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
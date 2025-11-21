<template>
  <div class="plinko-page">
    <div class="game-container card glassmorphism">
      <header class="game-header">
        <h2><i class="fas fa-water"></i> 황금 소금 폭포</h2>
        <p>구슬이 어디로 떨어질까요? 대박을 노려보세요!</p>
      </header>

      <div class="canvas-wrapper" ref="canvasWrapper">
        <canvas ref="canvasRef"></canvas>
        
        <div class="multipliers-overlay">
          <div v-for="(mul, index) in multipliers" :key="index" 
               class="multiplier-box" 
               :class="getMultiplierClass(mul)"
               :style="{ transform: activeIndex === index ? 'scale(1.2)' : 'scale(1)' }">
            x{{ mul }}
          </div>
        </div>
      </div>

      <div class="controls-area">
        <div class="bet-control">
          <label>1회 투입 금액</label>
          <div class="bet-buttons">
            <button @click="setBet(100)" :class="{ active: betAmount === 100 }">100</button>
            <button @click="setBet(500)" :class="{ active: betAmount === 500 }">500</button>
            <button @click="setBet(1000)" :class="{ active: betAmount === 1000 }">1K</button>
            <button @click="setBet(5000)" :class="{ active: betAmount === 5000 }">5K</button>
          </div>
          <input type="number" v-model.number="betAmount" class="bet-input" min="100" step="100">
        </div>

        <div class="action-buttons">
          <button @click="dropBall" class="btn-drop" :disabled="isPlaying && !isAutoMode">
            <span v-if="isAutoMode">자동 멈춤</span>
            <span v-else>구슬 떨어뜨리기!</span>
          </button>
          <button @click="toggleAuto" class="btn-auto" :class="{ active: isAutoMode }">
            <i class="fas fa-sync-alt"></i> 자동
          </button>
        </div>
        
        <div class="game-log">
          <p v-if="lastResult" :class="lastResult.profit >= 0 ? 'win' : 'lose'">
            {{ lastResult.message }}
          </p>
          <p v-else>구슬을 떨어뜨려보세요!</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

const canvasRef = ref(null);
const canvasWrapper = ref(null);
const betAmount = ref(100);
const isPlaying = ref(false);
const isAutoMode = ref(false);
const lastResult = ref(null);
const activeIndex = ref(-1);

const multipliers = [100, 10, 5, 2, 0.5, 2, 5, 10, 100];
const rows = 8; 
const pegSize = 4;
const ballSize = 7;
let ctx = null;
let width = 0;
let height = 0;
let animationId = null;

const balls = [];
const pegs = [];
let audioCtx = null;
const isDropping = ref(false);

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
};

const playPingSound = () => {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const freqs = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00];
  osc.frequency.value = freqs[Math.floor(Math.random() * freqs.length)];
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
};

const initBoard = () => {
  const canvas = canvasRef.value;
  if (!canvas || !canvasWrapper.value) return;

  width = canvasWrapper.value.clientWidth;
  height = canvasWrapper.value.clientHeight;
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  pegs.length = 0;
  const spacing = width / (rows + 2);
  const startY = 50;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= row; col++) {
      const x = (width / 2) - (row * spacing / 2) + (col * spacing);
      const y = startY + (row * spacing * 0.8);
      pegs.push({ x, y });
    }
  }
};

const setBet = (amount) => {
  betAmount.value = amount;
};

const getMultiplierClass = (mul) => {
  if (mul >= 100) return 'jackpot';
  if (mul >= 10) return 'high';
  if (mul >= 2) return 'medium';
  return 'low';
};

const dropBall = async () => {
  if (isDropping.value) return;
  if (isPlaying.value && !isAutoMode.value) return;
  
  if (isAutoMode.value && isPlaying.value && !balls.length) { 
      isAutoMode.value = false;
      return;
  }
  
  isDropping.value = true; 
  initAudio();
  isPlaying.value = true;

  try {
    const playFunc = httpsCallable(functions, 'playSaltPlinko');
    const result = await playFunc({ betAmount: betAmount.value });
    const { selectedIndex, multiplier, profit } = result.data;

    balls.push({
      x: width / 2 + (Math.random() - 0.5) * 5, // 랜덤 범위 축소 (5px)
      y: 20,
      vx: 0,
      vy: 0,
      targetIndex: selectedIndex, 
      finished: false,
      resultMessage: profit >= 0 
          ? `🎉 대박! ${multiplier}배! (+${profit.toLocaleString()} P)` 
          : `아쉽네요.. (${profit.toLocaleString()} P)`,
      resultProfit: profit
    });
    
    setTimeout(() => { isDropping.value = false; }, 500);

    if (isAutoMode.value) {
        setTimeout(() => {
            if (isAutoMode.value) {
                dropBall();
            }
        }, 1500); 
    }

  } catch (error) {
    console.error(error);
    alert(error.message);
    isAutoMode.value = false;
    isDropping.value = false;
    
    if (balls.length === 0) {
        isPlaying.value = false;
    }
  }
};

const toggleAuto = () => {
    isAutoMode.value = !isAutoMode.value;
    if (isAutoMode.value && !isPlaying.value) {
        dropBall();
    }
};

const update = () => {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  pegs.forEach(peg => {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, pegSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#fff';
  });
  ctx.shadowBlur = 0; 

  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    
    if (!ball.finished) {
        // 1. 기본 물리
        ball.vy += 0.15; // 중력 (0.2 -> 0.15로 낮춰서 천천히 떨어지게 함)
        ball.y += ball.vy;
        ball.x += ball.vx;

        // 2. [핵심 수정] 유도 로직 (Guidance) 최적화
        const spacing = width / (rows + 2);
        const finalTargetX = (width / 2) - ((multipliers.length * spacing) / 2) + (ball.targetIndex * spacing) + (spacing / 2);

        // [수정] 유도 시작 지점을 화면 하단부(60%)로 늦춤
        if (ball.y > height * 0.6) {
            const dx = finalTargetX - ball.x;
            ball.vx += dx * 0.005; // [수정] 유도 힘 대폭 감소 (0.01 -> 0.005)
            ball.vx *= 0.95; // 속도 감쇠
        }

        // 3. 충돌 처리
        for (const peg of pegs) {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < ballSize + pegSize) {
                playPingSound();
                // [수정] 반발력 감소 (-0.5 -> -0.3)
                ball.vy *= -0.3; 
                ball.vx += (Math.random() - 0.5) * 1.5; // 랜덤 튐 감소
                ball.y -= 2; 
                
                // [수정] 충돌 시 유도 힘도 감소 (0.3 -> 0.1)
                if (ball.x < finalTargetX) ball.vx += 0.1;
                else ball.vx -= 0.1;

                break;
            }
        }
        
        // [신규] 최대 속도 제한 (공이 날아가는 현상 방지)
        if (ball.vx > 3) ball.vx = 3;
        if (ball.vx < -3) ball.vx = -3;
        
        // 4. 바닥 처리
        if (ball.y > height - 30) {
            ball.x = finalTargetX; 
            ball.finished = true;
            activeIndex.value = ball.targetIndex;
            lastResult.value = { message: ball.resultMessage, profit: ball.resultProfit };
            setTimeout(() => { activeIndex.value = -1; }, 500);
            
            balls.splice(i, 1);
            
            if (balls.length === 0 && !isAutoMode.value) {
                isPlaying.value = false;
            }
            continue; 
        }
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFD700';
  }
  ctx.shadowBlur = 0;

  animationId = requestAnimationFrame(update);
};

onMounted(async () => {
    await nextTick();
    window.addEventListener('resize', initBoard);
    initBoard();
    update();
});

onUnmounted(() => {
    window.removeEventListener('resize', initBoard);
    cancelAnimationFrame(animationId);
    if(audioCtx) audioCtx.close();
});
</script>

<style scoped>
/* (스타일은 기존과 동일) */
.plinko-page {
  padding: 20px;
  min-height: 100vh;
  background-color: #1a1a2e;
  display: flex;
  justify-content: center;
  align-items: center;
}
.game-container {
  width: 100%;
  max-width: 600px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
  text-align: center;
  color: #fff;
}
.game-header h2 {
  font-size: 2rem;
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  margin-bottom: 5px;
}
.game-header p {
  color: #bdc3c7;
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.canvas-wrapper {
  position: relative;
  width: 100%;
  height: 400px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 20px;
}
canvas {
  width: 100%;
  height: 100%;
}

.multipliers-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: space-evenly;
  padding-bottom: 5px;
}
.multiplier-box {
  width: 30px;
  height: 25px;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.7rem;
  font-weight: bold;
  transition: transform 0.2s;
  box-shadow: 0 -2px 5px rgba(0,0,0,0.2);
}
.low { background: #95a5a6; color: #2c3e50; }
.medium { background: #3498db; color: #fff; }
.high { background: #e67e22; color: #fff; }
.jackpot { background: #e74c3c; color: #fff; box-shadow: 0 0 10px #e74c3c; }

.controls-area {
  background: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 15px;
}
.bet-control label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 10px;
  color: #bdc3c7;
}
.bet-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
}
.bet-buttons button {
  background: transparent;
  border: 1px solid #4a4a4a;
  color: #fff;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.bet-buttons button.active {
  background: #FFD700;
  color: #000;
  border-color: #FFD700;
}
.bet-input {
  width: 100px;
  padding: 8px;
  border-radius: 5px;
  border: none;
  text-align: center;
  font-weight: bold;
  margin-bottom: 15px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 15px;
}
.btn-drop {
  flex: 2;
  background: linear-gradient(135deg, #FFC107, #FF9800);
  border: none;
  padding: 15px;
  border-radius: 10px;
  color: #000;
  font-weight: 900;
  font-size: 1.2rem;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(255, 193, 7, 0.3);
  transition: transform 0.1s;
}
.btn-drop:active { transform: scale(0.98); }
.btn-drop:disabled { background: #555; color: #888; cursor: not-allowed; box-shadow: none; }

.btn-auto {
  flex: 1;
  background: #2c3e50;
  border: 1px solid #4a4a4a;
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
}
.btn-auto.active {
  background: #27ae60;
  border-color: #2ecc71;
  animation: pulse 1s infinite;
}

.game-log {
  font-size: 0.9rem;
  height: 20px;
}
.win { color: #2ecc71; font-weight: bold; }
.lose { color: #e74c3c; }

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(46, 204, 113, 0); }
  100% { box-shadow: 0 0 0 0 rgba(46, 204, 113, 0); }
}
</style>
<template>
  <div class="plinko-page">
    <div class="game-container card glassmorphism">
      <header class="game-header">
        <h2><i class="fas fa-water"></i> 황금 소금 폭포</h2>
        <p>구슬이 떨어지는 곳에 운명이 있습니다!</p>
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
            <button @click="setBet(150)" :class="{ active: betAmount === 150 }">150</button>
            <button @click="setBet(200)" :class="{ active: betAmount === 200 }">200</button>
            <button @click="setBet(300)" :class="{ active: betAmount === 300 }">300</button>
          </div>
          <p class="current-bet">현재 베팅: <strong>{{ betAmount }} P</strong></p>
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

const multipliers = [3, 2.5, 2, 1.5, 0.5, 1.5, 2, 2.5, 3];
const rows = 12; 
const pegSize = 4;
let ballSize = 6; // 반응형
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
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
};

const initBoard = () => {
  const canvas = canvasRef.value;
  if (!canvas || !canvasWrapper.value) return;

  width = canvasWrapper.value.clientWidth;
  height = canvasWrapper.value.clientHeight;

  // 모바일 화면 대응
  if (width < 600) {
      ballSize = 4; 
  } else {
      ballSize = 6;
  }
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  pegs.length = 0;
  const spacing = width / (rows + 2);
  const startY = 40;

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
  if (mul >= 3) return 'jackpot';
  if (mul >= 2) return 'high';
  if (mul >= 1.5) return 'medium';
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
      x: width / 2 + (Math.random() - 0.5) * 4, 
      y: 10,
      vx: 0,
      vy: 0,
      targetIndex: selectedIndex, 
      finished: false,
      resultMessage: profit >= 0 
          ? `🎉 축하합니다! ${multiplier}배! (+${profit.toLocaleString()} P)` 
          : `아쉽네요.. (${profit.toLocaleString()} P)`,
      resultProfit: profit
    });
    
    setTimeout(() => { isDropping.value = false; }, 500);

    if (isAutoMode.value) {
        setTimeout(() => {
            if (isAutoMode.value) dropBall();
        }, 1200); 
    }

  } catch (error) {
    console.error(error);
    alert(error.message);
    isAutoMode.value = false;
    isDropping.value = false;
    if (balls.length === 0) isPlaying.value = false;
  }
};

const toggleAuto = () => {
    isAutoMode.value = !isAutoMode.value;
    if (isAutoMode.value && !isPlaying.value) dropBall();
};

// [핵심 수정] 물리 엔진 업데이트
const update = () => {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);

  // 핀 그리기
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  pegs.forEach(peg => {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, pegSize, 0, Math.PI * 2);
    ctx.fill();
  });

  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    
    if (!ball.finished) {
        // 1. 기본 물리
        ball.vy += 0.25; 
        ball.vy *= 0.99; 
        ball.vx *= 0.98; 
        
        ball.x += ball.vx;
        ball.y += ball.vy;

        // 2. 유도 로직
        const spacing = width / (rows + 2);
        const finalTargetX = (width / 2) - ((multipliers.length * spacing) / 2) + (ball.targetIndex * spacing) + (spacing / 2);

        if (ball.y > height * 0.5) { 
            const dx = finalTargetX - ball.x;
            ball.vx += dx * 0.008; 
            ball.vx *= 0.96; 
        }

        // 3. [핵심] 충돌 처리 개선
        for (const peg of pegs) {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const minDist = ballSize + pegSize;
            
            if (dist < minDist) {
                playPingSound();

                // [수정 A] 겹침 방지: 공을 핀 바깥으로 즉시 밀어냄 (필수)
                const angle = Math.atan2(dy, dx);
                const pushOut = minDist - dist + 0.5; 
                ball.x += Math.cos(angle) * pushOut;
                ball.y += Math.sin(angle) * pushOut;

                // [수정 B] 튀는 힘 감소: 위로 튀는 것을 억제 (-0.4 -> -0.2)
                ball.vy *= -0.2; 
                
                // [수정 C] 측면 반발력: 충돌 각도에 따라 옆으로 밀어냄
                ball.vx += Math.cos(angle) * 0.8;
                
                // 약간의 랜덤성
                ball.vx += (Math.random() - 0.5) * 0.5; 
                
                // 목표 방향 미세 유도
                if (ball.x < finalTargetX) ball.vx += 0.1;
                else ball.vx -= 0.1;

                break;
            }
        }
        
        if (ball.vx > 4) ball.vx = 4; 
        if (ball.vx < -4) ball.vx = -4;
        
        // 4. 바닥 도착
        if (ball.y > height - 30) {
            if (Math.abs(ball.x - finalTargetX) > 15) {
                ball.x += (finalTargetX - ball.x) * 0.3;
            } else {
                ball.finished = true;
                activeIndex.value = ball.targetIndex;
                lastResult.value = { message: ball.resultMessage, profit: ball.resultProfit };
                setTimeout(() => { activeIndex.value = -1; }, 300);
                balls.splice(i, 1);
                
                if (balls.length === 0 && !isAutoMode.value) {
                    isPlaying.value = false;
                }
                continue;
            }
        }
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.shadowBlur = 8;
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
  font-size: 1.8rem;
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
  height: 450px;
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
  width: 10%;
  height: 25px;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.7rem;
  font-weight: bold;
  transition: transform 0.1s;
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
.bet-control { margin-bottom: 15px; }
.bet-control label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 10px;
  color: #bdc3c7;
}
.bet-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
}
.bet-buttons button {
  background: transparent;
  border: 1px solid #4a4a4a;
  color: #fff;
  padding: 6px 12px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9rem;
}
.bet-buttons button.active {
  background: #FFD700;
  color: #000;
  border-color: #FFD700;
  font-weight: bold;
}
.current-bet {
  font-size: 1rem;
  color: #fff;
  margin: 0;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.btn-auto.active {
  background: #27ae60;
  border-color: #2ecc71;
}

.game-log {
  font-size: 0.9rem;
  min-height: 20px;
}
.win { color: #2ecc71; font-weight: bold; }
.lose { color: #e74c3c; }
</style>
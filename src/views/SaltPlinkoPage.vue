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

// 게임 설정
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
  if (!canvas || !canvasWrapper.value) return; // 방어 코드

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

// [★수정★] dropBall 함수 로직 개선
const dropBall = async () => {
  // 1. 수동 모드인데 이미 플레이 중이면 중단
  if (isPlaying.value && !isAutoMode.value) return;
  
  // 2. 자동 모드 끄기 요청이 들어온 경우
  if (isAutoMode.value && isPlaying.value && !balls.length) { 
      // 공이 없을 때만 멈춤 (공이 있으면 다 떨어지고 멈춤)
      isAutoMode.value = false;
      return;
  }
  
  initAudio();
  isPlaying.value = true;

  try {
    const playFunc = httpsCallable(functions, 'playSaltPlinko');
    const result = await playFunc({ betAmount: betAmount.value });
    const { selectedIndex, multiplier, profit } = result.data;

    const spacing = width / (rows + 2);
    
    balls.push({
      x: width / 2 + (Math.random() - 0.5) * 10,
      y: 20,
      vx: 0,
      vy: 0,
      targetIndex: selectedIndex,
      finished: false,
      // 결과 메시지는 나중에 할당하거나 여기서 미리 할당
      resultMessage: profit >= 0 
          ? `🎉 대박! ${multiplier}배! (+${profit.toLocaleString()} P)` 
          : `아쉽네요.. (${profit.toLocaleString()} P)`,
      resultProfit: profit
    });

    // [★수정★] 자동 모드일 때 다음 공 예약 (재귀 호출)
    if (isAutoMode.value) {
        // 1.5초 뒤에 다음 공 발사 (단, 자동 모드가 유지되고 있을 때만)
        setTimeout(() => {
            if (isAutoMode.value) {
                dropBall();
            }
        }, 1500); 
    }

  } catch (error) {
    console.error(error);
    alert(error.message); // 에러 메시지 표시 (예: 포인트 부족)
    isAutoMode.value = false; // 에러 발생 시 자동 모드 해제
    
    // 공이 하나도 없으면 플레이 상태 해제
    if (balls.length === 0) {
        isPlaying.value = false;
    }
  }
};

const toggleAuto = () => {
    isAutoMode.value = !isAutoMode.value;
    // 자동 모드를 켰는데 현재 플레이 중이 아니라면 즉시 시작
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
        ball.vy += 0.2;
        ball.y += ball.vy;
        ball.x += ball.vx;

        for (const peg of pegs) {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < ballSize + pegSize) {
                playPingSound();
                ball.vy *= -0.5;
                ball.vx += (Math.random() - 0.5) * 2;
                ball.y -= 2;
                
                const spacing = width / (rows + 2);
                const finalTargetX = (width / 2) - ((rows) * spacing / 2) + (ball.targetIndex * spacing) + (spacing / 2);
                
                if (ball.y > height * 0.4) {
                    if (ball.x < finalTargetX) ball.vx += 0.5;
                    else ball.vx -= 0.5;
                }
                break;
            }
        }
        
        if (ball.y > height - 30) {
            ball.finished = true;
            activeIndex.value = ball.targetIndex;
            lastResult.value = { message: ball.resultMessage, profit: ball.resultProfit };
            setTimeout(() => { activeIndex.value = -1; }, 500);
            
            balls.splice(i, 1);
            
            // [★수정★] 공이 다 사라졌고 자동 모드가 아니면 종료
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

/* 캔버스 영역 */
.canvas-wrapper {
  position: relative;
  width: 100%;
  height: 400px; /* 게임판 높이 */
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 20px;
}
canvas {
  width: 100%;
  height: 100%;
}

/* 하단 배율 박스 */
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
.low { background: #95a5a6; color: #2c3e50; } /* 0.5배 (회색) */
.medium { background: #3498db; color: #fff; } /* 2배 (파랑) */
.high { background: #e67e22; color: #fff; } /* 5~10배 (주황) */
.jackpot { background: #e74c3c; color: #fff; box-shadow: 0 0 10px #e74c3c; } /* 100배 (빨강) */

/* 컨트롤 영역 */
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
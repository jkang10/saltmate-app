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
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

const canvasRef = ref(null);
const canvasWrapper = ref(null);
const betAmount = ref(100);
const isPlaying = ref(false);
const isAutoMode = ref(false);
const lastResult = ref(null);
const activeIndex = ref(-1); // 공이 들어간 바구니 인덱스 (애니메이션용)

// 게임 설정
const multipliers = [100, 10, 5, 2, 0.5, 2, 5, 10, 100];
const rows = 8; // 핀 줄 수
const pegSize = 4;
const ballSize = 7;
let ctx = null;
let width = 0;
let height = 0;
let animationId = null;

// 물리 객체들
const balls = [];
const pegs = [];

// 오디오 컨텍스트 (효과음용)
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
  
  // 랜덤 피치 (실로폰 느낌)
  const freqs = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00];
  osc.frequency.value = freqs[Math.floor(Math.random() * freqs.length)];
  
  osc.type = 'sine';
  
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
};

// 핀(Peg) 초기화
const initBoard = () => {
  const canvas = canvasRef.value;
  width = canvasWrapper.value.clientWidth;
  height = canvasWrapper.value.clientHeight;
  
  // 레티나 대응
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  pegs.length = 0;
  const spacing = width / (rows + 2); // 간격 계산
  const startY = 50;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= row; col++) {
      const x = (width / 2) - (row * spacing / 2) + (col * spacing);
      const y = startY + (row * spacing * 0.8); // 0.8은 수직 간격 조정
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

// 공 떨어뜨리기
const dropBall = async () => {
  if (isPlaying.value && !isAutoMode.value) return;
  if (isAutoMode.value && isPlaying.value) {
      // 자동 모드 끄기
      isAutoMode.value = false;
      return;
  }
  
  initAudio(); // 사운드 준비
  isPlaying.value = true;

  try {
    const playFunc = httpsCallable(functions, 'playSaltPlinko');
    const result = await playFunc({ betAmount: betAmount.value });
    const { selectedIndex, multiplier, profit } = result.data;

    // 공 생성
    const spacing = width / (rows + 2);
    const targetX = (width / 2) - ((rows) * spacing / 2) + (selectedIndex * spacing) + (spacing / 2);
    
    // [핵심] 서버 결과(selectedIndex)에 도달하도록 목표 지점 설정
    balls.push({
      x: width / 2 + (Math.random() - 0.5) * 10, // 시작은 중앙 부근
      y: 20,
      vx: 0,
      vy: 0,
      targetIndex: selectedIndex, // 목표 바구니 인덱스
      finished: false
    });

    // 결과 메시지 준비
    const msg = profit >= 0 
        ? `🎉 대박! ${multiplier}배! (+${profit.toLocaleString()} P)` 
        : `아쉽네요.. (${profit.toLocaleString()} P)`;
    
    // 공이 바닥에 닿았을 때 보여줄 결과 저장 (클로저 대신 객체 속성으로)
    balls[balls.length-1].resultMessage = msg;
    balls[balls.length-1].resultProfit = profit;

    if (isAutoMode.value) {
        setTimeout(dropBall, 1500); // 1.5초마다 자동 투하
    } else {
        // 자동 모드가 아니면 공이 다 떨어질 때쯤 상태 해제는 updateLoop에서 처리
    }

  } catch (error) {
    console.error(error);
    alert(error.message);
    isAutoMode.value = false;
    isPlaying.value = false;
  }
};

const toggleAuto = () => {
    isAutoMode.value = !isAutoMode.value;
    if (isAutoMode.value && !isPlaying.value) {
        dropBall();
    }
};

// 애니메이션 루프
const update = () => {
  ctx.clearRect(0, 0, width, height);

  // 핀 그리기
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  pegs.forEach(peg => {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, pegSize, 0, Math.PI * 2);
    ctx.fill();
    // 빛나는 효과
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#fff';
  });
  ctx.shadowBlur = 0; // 초기화

  // 공 업데이트 및 그리기
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    
    if (!ball.finished) {
        // 간단한 물리 + 유도 로직
        ball.vy += 0.2; // 중력
        ball.y += ball.vy;
        ball.x += ball.vx;

        // 핀 충돌 처리
        let hit = false;
        for (const peg of pegs) {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < ballSize + pegSize) {
                // 충돌!
                playPingSound();
                
                // 반사 (단순화)
                ball.vy *= -0.5; // 탄성
                ball.vx += (Math.random() - 0.5) * 2; // 랜덤 튐
                ball.y -= 2; // 겹침 방지
                hit = true;
                
                // [핵심 유도 로직] 목표 방향으로 미세하게 밈
                const spacing = width / (rows + 2);
                const finalTargetX = (width / 2) - ((rows) * spacing / 2) + (ball.targetIndex * spacing) + (spacing / 2);
                
                if (ball.y > height * 0.4) { // 절반 이상 내려왔을 때 유도 시작
                    if (ball.x < finalTargetX) ball.vx += 0.5;
                    else ball.vx -= 0.5;
                }
                break; // 한 프레임에 하나의 핀만 충돌
            }
        }
        
        // 바닥 도착 확인
        if (ball.y > height - 30) {
            ball.finished = true;
            activeIndex.value = ball.targetIndex;
            lastResult.value = { message: ball.resultMessage, profit: ball.resultProfit };
            setTimeout(() => { activeIndex.value = -1; }, 500); // 하이라이트 끄기
            
            // 배열에서 제거 (메모리 관리)
            balls.splice(i, 1);
            
            if (balls.length === 0 && !isAutoMode.value) {
                isPlaying.value = false;
            }
            continue; // 다음 루프로
        }
    }

    // 공 그리기
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700'; // 황금색
    ctx.fill();
    // 공 광원 효과
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFD700';
  }
  ctx.shadowBlur = 0;

  animationId = requestAnimationFrame(update);
};

onMounted(() => {
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
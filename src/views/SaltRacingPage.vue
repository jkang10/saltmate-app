<template>
  <div class="racing-page">
    <div class="game-container card glassmorphism">
      <header class="game-header">
        <h2><i class="fas fa-flag-checkered"></i> 솔트 레이싱</h2>
        <p>가장 컨디션이 좋아 보이는 선수에게 응원을 보내세요!</p>
      </header>

      <div class="track-display">
        <canvas ref="canvasRef"></canvas>
        
        <div v-if="showResult" class="result-overlay" :class="{ 'win': gameResult?.isWin }">
          <h3>{{ resultMessage }}</h3>
          <div class="winner-announce">
            🏆 1등: <strong>{{ runners[gameResult?.winnerIndex]?.name }}</strong>
          </div>
          <p v-if="gameResult?.isWin" class="prize-text">
            +{{ gameResult.winnings.toLocaleString() }} SaltMate 획득!
          </p>
          <button @click="resetGame" class="btn-retry">다음 경기 준비</button>
        </div>

        <div class="commentary-box" v-if="isPlaying">
          <p>{{ currentCommentary }}</p>
        </div>
      </div>

      <div class="controls-area" :class="{ 'disabled': isPlaying }">
        <div class="runner-selection">
          <h4>우승 후보 선택 (배당 4.5배)</h4>
          <div class="runners-grid">
            <div 
              v-for="(runner, index) in runners" 
              :key="index"
              class="runner-card"
              :class="{ 'selected': selectedRunner === index }"
              @click="selectRunner(index)"
            >
              <div class="runner-img-box">
                <img :src="runnerImages[index].src" alt="runner" class="runner-preview-img" />
              </div>
              <div class="runner-info">
                <span class="name">{{ runner.name }}</span>
                <span class="trait">{{ runner.trait }}</span>
              </div>
              <div class="check-mark" v-if="selectedRunner === index">
                <i class="fas fa-check-circle"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="bet-action">
          <div class="amount-selector">
            <button @click="betAmount = 100" :class="{ active: betAmount === 100 }">100</button>
            <button @click="betAmount = 500" :class="{ active: betAmount === 500 }">500</button>
            <button @click="betAmount = 1000" :class="{ active: betAmount === 1000 }">1K</button>
            <button @click="betAmount = 5000" :class="{ active: betAmount === 5000 }">5K</button>
          </div>
          <button @click="startGame" class="btn-start" :disabled="isPlaying || selectedRunner === null">
            <span v-if="isPlaying">경기 진행 중...</span>
            <span v-else>
              {{ selectedRunner !== null ? `${runners[selectedRunner].name}에게` : '' }} 
              {{ betAmount }} P 걸기
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

// [핵심] 이미지 임포트 (파일명 주의: jpg/png 섞여있음)
import runner1Src from '@/assets/racing/runner1.jpg';
import runner2Src from '@/assets/racing/runner2.jpg';
import runner3Src from '@/assets/racing/runner3.jpg';
import runner4Src from '@/assets/racing/runner4.jpg';
import runner5Src from '@/assets/racing/runner5.png';

// 이미지 객체 미리 생성
const runnerImages = [new Image(), new Image(), new Image(), new Image(), new Image()];
runnerImages[0].src = runner1Src;
runnerImages[1].src = runner2Src;
runnerImages[2].src = runner3Src;
runnerImages[3].src = runner4Src;
runnerImages[4].src = runner5Src;

const runners = [
  { name: '소금 요정', trait: '막판 스퍼트' },
  { name: '황금 광부', trait: '꾸준한 속도' },
  { name: '심해 거북', trait: '안정적인 주행' },
  { name: '크리스탈', trait: '변칙적인 움직임' },
  { name: '메테오', trait: '폭발적인 스타트' },
];

const canvasRef = ref(null);
const selectedRunner = ref(null);
const betAmount = ref(100);
const isPlaying = ref(false);
const showResult = ref(false);
const gameResult = ref(null);
const currentCommentary = ref("선수들이 출발선에 정렬했습니다.");

let ctx = null;
let animationId = null;
const racerPositions = ref([0, 0, 0, 0, 0]);

const selectRunner = (index) => {
  selectedRunner.value = index;
};

const startGame = async () => {
  if (selectedRunner.value === null) return alert("응원할 선수를 선택해주세요!");
  if (!confirm(`${betAmount.value} SaltMate를 걸고 경기를 시작하시겠습니까?`)) return;

  isPlaying.value = true;
  showResult.value = false;
  racerPositions.value = [0, 0, 0, 0, 0];
  currentCommentary.value = "3... 2... 1... 출발!!";

  try {
    const playFunc = httpsCallable(functions, 'playSaltRacing');
    const result = await playFunc({ 
      betAmount: betAmount.value,
      selectedRunner: selectedRunner.value 
    });
    gameResult.value = result.data;
    animateRace(result.data.winnerIndex);

  } catch (error) {
    console.error(error);
    alert(error.message);
    isPlaying.value = false;
  }
};

const animateRace = (winnerIndex) => {
  let frameCount = 0;
  const finishLine = 800;
  
  const loop = () => {
    frameCount++;
    if (!canvasRef.value) return; // 방어 코드

    ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    drawTrack();

    let allFinished = true;

    racerPositions.value = racerPositions.value.map((pos, index) => {
      if (pos >= finishLine) return pos;
      allFinished = false;
      
      let speed = Math.random() * 3 + 2; 
      if (index === winnerIndex && pos > finishLine * 0.6) speed += 1.5; 
      if (index !== winnerIndex && pos > finishLine * 0.8 && pos > racerPositions.value[winnerIndex]) speed *= 0.5;

      return pos + speed;
    });

    drawRunners(frameCount);

    if (frameCount % 60 === 0 && !allFinished) updateCommentary();

    if (!allFinished) {
      animationId = requestAnimationFrame(loop);
    } else {
      setTimeout(() => { showResult.value = true; }, 1000);
    }
  };
  loop();
};

const updateCommentary = () => {
    const maxPos = Math.max(...racerPositions.value);
    const leaderIdx = racerPositions.value.indexOf(maxPos);
    const leaderName = runners[leaderIdx].name;
    
    const comments = [
        `${leaderName} 선수가 치고 나갑니다!`,
        `치열한 순위 다툼이 벌어지고 있습니다!`,
        `아직 승부는 알 수 없습니다!`,
        `${leaderName}, 엄청난 속도입니다!`,
        `막판 스퍼트가 시작됩니다! 과연 우승은?`
    ];
    currentCommentary.value = comments[Math.floor(Math.random() * comments.length)];
};

const drawTrack = () => {
    const w = canvasRef.value.width;
    const h = canvasRef.value.height;
    const laneHeight = h / 5;

    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 15]);
    
    for(let i=1; i<5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * laneHeight);
        ctx.lineTo(w, i * laneHeight);
        ctx.stroke();
    }
    ctx.setLineDash([]);

    const finishX = w - 50;
    ctx.fillStyle = '#ecf0f1';
    for(let i=0; i<h; i+=20) {
        if ((i/20)%2 === 0) ctx.fillRect(finishX, i, 10, 10);
        else ctx.fillRect(finishX + 10, i, 10, 10);
    }
};

// [핵심 수정] 이미지 그리기
const drawRunners = (frameCount) => {
    const w = canvasRef.value.width;
    const h = canvasRef.value.height;
    const laneHeight = h / 5;
    const finishLine = 800;

    racerPositions.value.forEach((pos, index) => {
        const screenX = (pos / finishLine) * (w - 100) + 20; 
        const screenY = index * laneHeight + (laneHeight / 2);
        
        // [연출] 달릴 때 위아래로 흔들리는 효과 (Bobbing)
        const bobbing = Math.sin(frameCount * 0.5) * 3; 

        // 그림자 (타원)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX + 15, screenY + 20, 15, 5, 0, 0, Math.PI*2);
        ctx.fill();

        // 캐릭터 이미지 그리기 (크기 50x50)
        // 이미지가 로드되었는지 확인
        if (runnerImages[index].complete) {
            ctx.drawImage(runnerImages[index], screenX - 25, screenY - 25 + bobbing, 50, 50);
        }

        // 등번호 (머리 위)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(index + 1, screenX, screenY - 35 + bobbing);
    });
};

const resetGame = () => {
    showResult.value = false;
    isPlaying.value = false;
    currentCommentary.value = "다음 경기를 준비 중입니다...";
    drawTrack();
    racerPositions.value = [0,0,0,0,0];
    // 초기 위치에 캐릭터 그리기 (frameCount = 0)
    drawRunners(0);
};

const resultMessage = computed(() => {
    if (!gameResult.value) return '';
    return gameResult.value.isWin ? '🎉 승리했습니다! 🎉' : '아쉽게 패배했습니다...';
});

onMounted(() => {
    const canvas = canvasRef.value;
    const dpr = window.devicePixelRatio || 1;
    // 캔버스 크기 고정 (CSS 반응형과 별개)
    canvas.width = 800 * dpr;
    canvas.height = 400 * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    // 이미지 로드 완료 대기 후 초기화 (간단히 처리)
    setTimeout(() => {
        drawTrack();
        drawRunners(0);
    }, 100);
});

onUnmounted(() => {
    cancelAnimationFrame(animationId);
});
</script>

<style scoped>
.racing-page {
  padding: 20px;
  min-height: 100vh;
  background-color: #1a1a2e;
  display: flex;
  justify-content: center;
  align-items: center;
}
.game-container {
  width: 100%;
  max-width: 800px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 20px;
  color: #fff;
}
.game-header { text-align: center; margin-bottom: 20px; }
.game-header h2 { color: #FFD700; margin-bottom: 5px; }
.game-header p { color: #bdc3c7; font-size: 0.9rem; }

.track-display {
  position: relative;
  width: 100%;
  background: #2c3e50;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid #4a69bd;
  margin-bottom: 20px;
}
canvas {
  width: 100%;
  height: auto;
  display: block;
}

.commentary-box {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.7);
  padding: 8px 20px;
  border-radius: 20px;
  border: 1px solid #f1c40f;
}
.commentary-box p {
  margin: 0;
  color: #f1c40f;
  font-weight: bold;
  font-size: 0.9rem;
  white-space: nowrap;
}

.result-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.85);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.3s;
  z-index: 10;
}
.result-overlay.win h3 { color: #2ecc71; }
.winner-announce { font-size: 1.5rem; margin: 15px 0; }
.winner-announce strong { color: #FFD700; }
.prize-text { color: #FFD700; font-size: 1.2rem; font-weight: bold; margin-bottom: 20px; }
.btn-retry {
  padding: 10px 25px;
  background: #3498db;
  border: none;
  color: white;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}

.controls-area { transition: opacity 0.3s; }
.controls-area.disabled { opacity: 0.5; pointer-events: none; }

.runner-selection h4 { margin-bottom: 15px; color: #bdc3c7; font-size: 1rem; }
.runners-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}
.runner-card {
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.runner-card.selected {
  border-color: #FFD700;
  background: rgba(255, 215, 0, 0.1);
}
.runner-img-box {
  width: 60px; height: 60px; 
  display: flex; justify-content: center; align-items: center;
  margin-bottom: 5px;
}
.runner-preview-img {
  width: 100%; height: 100%; object-fit: contain;
}

.runner-info { text-align: center; }
.runner-info .name { display: block; font-weight: bold; font-size: 0.9rem; }
.runner-info .trait { display: block; font-size: 0.7rem; color: #aaa; }
.check-mark {
  position: absolute; top: 5px; right: 5px; color: #2ecc71;
}

.bet-action {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.amount-selector {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.amount-selector button {
  background: transparent;
  border: 1px solid #666;
  color: #ccc;
  padding: 5px 15px;
  border-radius: 20px;
  cursor: pointer;
}
.amount-selector button.active {
  border-color: #FFD700;
  color: #FFD700;
  background: rgba(255, 215, 0, 0.1);
}
.btn-start {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
}
.btn-start:disabled { background: #555; cursor: not-allowed; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
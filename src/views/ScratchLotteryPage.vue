<template>
  <div class="lottery-page">
    <header class="game-header">
      <h2><i class="fas fa-ticket-alt"></i> 매일매일 행운 복권</h2>
      <p>은색 부분을 긁어 같은 그림 3개가 나오면 당첨!</p>
    </header>

    <div class="lottery-card-container">
      <div class="scratch-card" ref="cardRef">
        
        <div class="grid-layer">
          <div v-for="(icon, index) in resultIcons" :key="index" class="grid-item">
            <img :src="getIconSrc(icon)" :alt="`Icon ${icon}`" class="icon-img" />
          </div>
        </div>

        <canvas 
          ref="canvasRef"
          class="scratch-canvas"
          @mousedown="startScratch"
          @mousemove="scratch"
          @mouseup="stopScratch"
          @mouseleave="stopScratch"
          @touchstart.prevent="startScratch"
          @touchmove.prevent="scratch"
          @touchend.prevent="stopScratch"
        ></canvas>

        <div v-if="!isPlaying && !gameResult" class="overlay-msg">
          <button @click="buyTicket" class="btn-buy" :disabled="isLoading">
            <span v-if="isLoading">구매 중...</span>
            <span v-else>복권 구매하기 (100 P)</span>
          </button>
        </div>
        
        <div v-if="!isPlaying && gameResult" class="result-overlay" :class="{ 'win': gameResult.prizeAmount > 0 }">
          <h3>{{ resultMessage }}</h3>
          <p v-if="gameResult.prizeAmount > 0" class="prize-amount">+{{ gameResult.prizeAmount.toLocaleString() }} SaltMate</p>
          <button @click="resetGame" class="btn-retry">다시 하기</button>
        </div>
      </div>
    </div>
    
    <div class="rules-card">
      <h4><i class="fas fa-info-circle"></i> 게임 규칙</h4>
      <ul>
        <li>1회 구매 비용: <strong>100 SaltMate</strong></li>
        <li>하루 최대 <strong>5회</strong>까지 참여 가능합니다.</li>
        <li>같은 그림이 <strong>3개</strong> 나오면 해당 금액 당첨!</li>
        <li><strong>1등:</strong> 5,000 P / <strong>2등:</strong> 1,000 P / <strong>3등:</strong> 500 P</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

// 아이콘 이미지
import iconLoss from '@/assets/gems/gem_1.png';
import iconSmall from '@/assets/gems/gem_2.png';
import iconMedium from '@/assets/gems/gem_4.png';
import iconBig from '@/assets/gems/gem_6.png';

const canvasRef = ref(null);
const cardRef = ref(null);
const isDrawing = ref(false);
const isLoading = ref(false);
const isPlaying = ref(false); // '긁고 있는 중' 상태
const gameResult = ref(null);
const resultIcons = ref([0,0,0,0,0,0]);

const getIconSrc = (id) => {
  switch(id) {
    case 1: return iconSmall;
    case 2: return iconMedium;
    case 3: return iconBig;
    default: return iconLoss;
  }
};

const resultMessage = computed(() => {
  if (!gameResult.value) return '';
  if (gameResult.value.prizeAmount > 0) return '🎉 축하합니다! 당첨! 🎉';
  return '아쉽네요... 다음 기회에!';
});

const initCanvas = () => {
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const width = cardRef.value.clientWidth;
  const height = cardRef.value.clientHeight;
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.opacity = '1'; // 캔버스 보이게 설정

  ctx.globalCompositeOperation = 'source-over'; // 덮어쓰기 모드
  ctx.fillStyle = '#C0C0C0'; // 은색
  ctx.fillRect(0, 0, width, height);
  
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('여기를 긁어보세요!', width / 2, height / 2);
  
  ctx.globalCompositeOperation = 'destination-out'; // 지우기 모드 전환
};

const buyTicket = async () => {
  if (!confirm("100 SaltMate를 사용하여 복권을 구매하시겠습니까?")) return;
  
  isLoading.value = true;
  try {
    const playFunc = httpsCallable(functions, 'playScratchLottery');
    const result = await playFunc();
    
    gameResult.value = result.data;
    resultIcons.value = result.data.icons;
    
    // [핵심] 캔버스를 먼저 초기화하고 게임 시작 상태로 변경
    await nextTick();
    initCanvas();
    isPlaying.value = true; 
    
  } catch (error) {
    console.error("복권 구매 실패:", error);
    alert(error.message);
  } finally {
    isLoading.value = false;
  }
};

const getPos = (e) => {
  const rect = canvasRef.value.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
};

const startScratch = (e) => {
  if (!isPlaying.value) return;
  isDrawing.value = true;
  scratch(e);
};

const scratch = (e) => {
  if (!isDrawing.value || !isPlaying.value) return;
  const pos = getPos(e);
  const ctx = canvasRef.value.getContext('2d');
  
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
  ctx.fill();
  
  // [성능 최적화] 너무 자주 검사하지 않도록 함 (쓰로틀링 대신 간단히 처리)
  // 실제로는 requestAnimationFrame 등을 사용할 수 있으나 여기선 간단히
};

const stopScratch = () => {
  isDrawing.value = false;
  if (isPlaying.value) {
      checkScratchPercent();
  }
};

const checkScratchPercent = () => {
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  // [주의] getImageData는 리소스를 많이 사용하므로 mouseup/touchend 시점에만 호출하는 것이 좋습니다.
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  const totalPixels = pixels.length / 4;
  
  const step = 32; // 샘플링 간격
  let sampleCount = 0;
  let clearedCount = 0;

  for (let i = 0; i < totalPixels; i += step) {
    sampleCount++;
    if (pixels[i * 4 + 3] === 0) { // 투명도 0 (지워짐)
      clearedCount++;
    }
  }

  const percent = (clearedCount / sampleCount) * 100;
  
  if (percent > 40) { // [수정] 40%만 긁어도 공개되도록 기준 완화
    finishGame();
  }
};

const finishGame = () => {
    isPlaying.value = false; // 게임 종료 상태로 변경
    if(canvasRef.value) {
        canvasRef.value.style.opacity = '0'; // 캔버스 숨김 애니메이션
    }
};

const resetGame = () => {
  gameResult.value = null;
  isPlaying.value = false;
  if (canvasRef.value) {
     canvasRef.value.style.opacity = '1';
     // 초기화면(구매 버튼) 상태로 돌아감
     initCanvas(); // 은색 다시 덮기
  }
};

onMounted(async () => {
    await nextTick();
    if(canvasRef.value) initCanvas();
});
</script>

<style scoped>
/* (스타일은 기존과 동일합니다) */
.lottery-page {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.game-header h2 {
  color: #E0A800;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  margin-bottom: 5px;
}
.game-header p {
  color: #666;
  font-size: 0.95rem;
  margin-bottom: 30px;
}

.lottery-card-container {
  width: 100%;
  max-width: 350px;
  aspect-ratio: 3 / 2;
  position: relative;
  border-radius: 15px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  overflow: hidden;
  background-color: #fff;
  border: 4px solid #E0A800;
  margin-bottom: 30px;
}

.scratch-card {
  width: 100%;
  height: 100%;
  position: relative;
}

.grid-layer {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  padding: 10px;
  gap: 10px;
  box-sizing: border-box;
  background-color: #fefefe;
}
.grid-item {
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px dashed #ddd;
  border-radius: 8px;
}
.icon-img {
  width: 60%;
  height: auto;
  object-fit: contain;
}

.scratch-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  cursor: url('https://cdn-icons-png.flaticon.com/32/240/240847.png') 16 16, auto;
  touch-action: none;
  transition: opacity 0.5s ease;
}

.overlay-msg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255,255,255,0.3);
}

.btn-buy {
  padding: 15px 30px;
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #FFC107, #FF9800);
  border: none;
  border-radius: 50px;
  box-shadow: 0 4px 15px rgba(255, 152, 0, 0.4);
  cursor: pointer;
  transition: transform 0.2s;
}
.btn-buy:active { transform: scale(0.95); }
.btn-buy:disabled { background: #ccc; cursor: not-allowed; box-shadow: none; }

.result-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 30;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.5s;
}
.result-overlay.win {
  background: rgba(255, 243, 205, 0.95);
}
.result-overlay h3 {
  font-size: 1.8rem;
  margin-bottom: 10px;
  color: #333;
}
.prize-amount {
  font-size: 1.5rem;
  font-weight: bold;
  color: #E0A800;
  margin-bottom: 20px;
}
.btn-retry {
  padding: 10px 25px;
  border: 2px solid #333;
  background: transparent;
  border-radius: 25px;
  font-weight: bold;
  cursor: pointer;
}

.rules-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 10px;
  text-align: left;
  width: 100%;
  max-width: 350px;
  font-size: 0.9rem;
  color: #555;
}
.rules-card h4 { margin-top: 0; margin-bottom: 10px; color: #333; }
.rules-card ul { padding-left: 20px; margin: 0; }
.rules-card li { margin-bottom: 5px; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
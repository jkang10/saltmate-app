<template>
  <div class="page-container hidden-object-page">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner-large"></div>
      <p>게임을 불러오는 중...</p>
    </div>

    <div v-if="countdown.visible" class="countdown-overlay" :key="countdown.number">
      <span class="countdown-number">{{ countdown.number }}</span>
    </div>

    <header v-if="level" class="page-header">
      <h1><i class="fas fa-search"></i> 숨은그림찾기</h1>
      <p>이미지 속에 숨겨진 <strong>황금 소금 결정, 희귀 미네랄, 고대 유물</strong> 3가지를 찾아보세요!</p>
    </header>

    <div v-if="level" class="game-layout">
      <aside class="ui-panel card">
        <div class="panel-header timer-container">
          <h3><i class="fas fa-hourglass-half"></i> 남은 시간</h3>
          <span class="timer">{{ timer }}</span>
        </div>
        <div class="panel-subheader">
          <h4><i class="fas fa-list-ul"></i> 찾아야 할 물건</h4>
        </div>
        <ul class="object-list">
          <li v-for="obj in level.objectsToFind" :key="obj.id" :class="{ 'found': isFound(obj.id) }">
            <div class="checkbox">
              <i v-if="isFound(obj.id)" class="fas fa-check"></i>
            </div>
            <span>{{ obj.name }}</span>
          </li>
        </ul>
      </aside>

      <main class="image-area" ref="imageAreaRef" @click="handleImageClick" @touchstart.prevent="handleImageClick">
        <img :src="resolvedImageUrl" alt="숨은그림찾기 배경" @load="onImageLoad" />
        
        <div 
          v-for="found in foundObjects" 
          :key="found.id" 
          class="found-marker" 
          :style="getMarkerStyle(found.id)"
        >
          <div class="sparkle"></div>
        </div>

        <div
          v-for="marker in clickMarkers"
          :key="marker.id"
          class="click-ripple"
          :style="{ top: marker.y + 'px', left: marker.x + 'px' }"
        ></div>
      </main>
    </div>
    
    <div v-if="gameResult.status" class="game-over-modal">
      <div class="modal-content">
        <h2>{{ gameResult.title }}</h2>
        <p>{{ gameResult.message }}</p>
        <router-link to="/dashboard" class="btn-primary">대시보드로 돌아가기</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, computed } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'vue-router';

const isLoading = ref(true);
const level = ref(null);
const foundObjects = ref([]);
const timer = ref(60);
const imageAreaRef = ref(null);
const gameResult = reactive({ status: null, title: '', message: '' });
const imageDimensions = reactive({ naturalWidth: 0, naturalHeight: 0 });
const router = useRouter();
let timerInterval = null;
const clickMarkers = ref([]);
let clickMarkerId = 0;

// [핵심 추가] 중앙 카운트다운을 위한 상태 변수
const countdown = reactive({ visible: false, number: 0 });

const resolvedImageUrl = computed(() => {
  if (!level.value?.imageUrl) return '';
  try {
    return require(`@/assets/game_assets/${level.value.imageUrl}`);
  } catch (e) {
    console.error(`이미지를 불러올 수 없습니다: ${level.value.imageUrl}`);
    return '';
  }
});

const isFound = (objectId) => {
    return foundObjects.value.some(f => f.id === objectId);
};

const getMarkerStyle = (objectId) => {
    if (!level.value || !imageAreaRef.value) return {};
    const objToFind = level.value.objectsToFind.find(o => o.id === objectId);
    if (!objToFind || !objToFind.coords) return {};
    const img = imageAreaRef.value.querySelector('img');
    if (!img || imageDimensions.naturalWidth === 0) return {};
    const displayRect = img.getBoundingClientRect();
    const scale = displayRect.width / imageDimensions.naturalWidth;
    return {
        left: `${objToFind.coords.x * scale}px`,
        top: `${objToFind.coords.y * scale}px`,
        width: `${objToFind.coords.width * scale}px`,
        height: `${objToFind.coords.height * scale}px`,
    };
};

const onImageLoad = (event) => {
    imageDimensions.naturalWidth = event.target.naturalWidth;
    imageDimensions.naturalHeight = event.target.naturalHeight;
};

const handleImageClick = async (event) => {
    if (!imageAreaRef.value || gameResult.status) return;
    const img = imageAreaRef.value.querySelector('img');
    if (!img || imageDimensions.naturalWidth === 0) return;
    const rect = imageAreaRef.value.getBoundingClientRect();
    const clickX = event.touches ? event.touches[0].clientX : event.clientX;
    const clickY = event.touches ? event.touches[0].clientY : event.clientY;
    const displayX = clickX - rect.left;
    const displayY = clickY - rect.top;
    const markerId = clickMarkerId++;
    clickMarkers.value.push({ id: markerId, x: displayX, y: displayY });
    setTimeout(() => {
        clickMarkers.value = clickMarkers.value.filter(m => m.id !== markerId);
    }, 500);
    const imgRect = img.getBoundingClientRect();
    const scale = imageDimensions.naturalWidth / imgRect.width;
    const clickCoords = {
        x: (clickX - imgRect.left) * scale,
        y: (clickY - imgRect.top) * scale
    };
    for (const obj of level.value.objectsToFind) {
        if (!isFound(obj.id)) {
            const { x, y, width, height } = obj.coords;
            const objectCenterX = x + width / 2;
            const objectCenterY = y + height / 2;
            const distance = Math.sqrt(Math.pow(clickCoords.x - objectCenterX, 2) + Math.pow(clickCoords.y - objectCenterY, 2));
            const toleranceRadius = Math.sqrt(width*width + height*height) / 2 * 1.5;

            if (distance < toleranceRadius) {
                try {
                    const foundHiddenObject = httpsCallable(functions, 'foundHiddenObject');
                    const result = await foundHiddenObject({ objectId: obj.id });
                    if (result.data.correct) {
                        foundObjects.value.push({ id: obj.id });
                        if (result.data.allFound) {
                            endGame('win', result.data.reward);
                        }
                    }
                } catch (e) { console.error("오브젝트 확인 오류:", e); }
                return;
            }
        }
    }
};

const endGame = (status, reward = 0) => {
    clearInterval(timerInterval);
    countdown.visible = false; // [핵심 추가] 게임 종료 시 카운트다운 숨김
    gameResult.status = status;
    if (status === 'win') {
        gameResult.title = '🎉 모든 물건 발견! 🎉';
        gameResult.message = `성공 보상으로 ${reward.toLocaleString()} SaltMate를 획득했습니다!`;
    } else {
        gameResult.title = '⏱️ 시간 초과 ⏱️';
        gameResult.message = '아쉽지만 다음 기회에 다시 도전해주세요.';
    }
};

onMounted(async () => {
  try {
    const startHiddenObjectGame = httpsCallable(functions, 'startHiddenObjectGame');
    const result = await startHiddenObjectGame();
    level.value = result.data.level;
    isLoading.value = false;
    timerInterval = setInterval(() => {
        timer.value--;

        // [핵심 추가] 10초 이하일 때 중앙 카운트다운 표시
        if (timer.value <= 10 && timer.value > 0) {
            countdown.visible = true;
            countdown.number = timer.value;
        } else {
            countdown.visible = false;
        }

        if (timer.value <= 0) {
            endGame('lose');
        }
    }, 1000);
  } catch (e) {
    console.error("게임 시작 오류:", e);
    alert(`게임 시작 중 오류가 발생했습니다: ${e.message}`);
    router.push('/dashboard');
  }
});

onUnmounted(() => {
    clearInterval(timerInterval);
});
</script>

<style scoped>
/* style 태그의 내용은 거의 동일하며, 하단에 신규 스타일만 추가됩니다. */
.hidden-object-page {
  display: flex; flex-direction: column; justify-content: flex-start;
  align-items: center; padding: 20px; background: #f0f2f5; min-height: calc(100vh - 70px);
}
.page-header { text-align: center; margin-bottom: 20px; width: 100%; }
.loading-overlay { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: rgba(255, 255, 255, 0.9); z-index: 100; }
.game-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; width: 100%; max-width: 1400px; }
@media (max-width: 992px) {
  .game-layout { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .ui-panel.card { flex-direction: row; align-items: center; justify-content: space-around; }
  .panel-subheader { display: none; }
  .timer-container { border-bottom: none; margin-bottom: 0; }
  .object-list { display: flex; gap: 15px; }
}
@media (max-width: 480px) {
    .ui-panel.card { flex-direction: column; }
    .timer-container { border-bottom: 1px solid #eee; width: 100%; margin-bottom: 15px; }
}
.ui-panel.card { background: white; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); padding: 20px; display: flex; flex-direction: column; }
.panel-header { text-align: center; padding-bottom: 15px; }
.timer-container { margin-bottom: 20px; border-bottom: 1px solid #eee; }
.timer { font-family: monospace; font-size: 2.5em; font-weight: bold; color: #dc3545; }
.panel-subheader { text-align: center; margin-bottom: 15px; }
.object-list { list-style: none; padding: 0; flex-grow: 1; }
.object-list li { display: flex; align-items: center; gap: 12px; font-size: 1.1em; padding: 12px; border-radius: 8px; }
.object-list li.found { color: #999; text-decoration: line-through; background-color: #f8f9fa; }
.checkbox { width: 22px; height: 22px; border: 2px solid #ccc; border-radius: 50%; display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
li.found .checkbox { border-color: #28a745; background-color: #28a745; color: white; }
.image-area { position: relative; cursor: pointer; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); -webkit-tap-highlight-color: transparent; }
.image-area img { display: block; width: 100%; height: auto; }
.click-ripple { position: absolute; border-radius: 50%; background-color: rgba(255, 255, 255, 0.7); width: 20px; height: 20px; transform: translate(-50%, -50%); animation: ripple-effect 0.5s ease-out forwards; pointer-events: none; }
@keyframes ripple-effect { from { transform: translate(-50%, -50%) scale(0); opacity: 1; } to { transform: translate(-50%, -50%) scale(5); opacity: 0; } }

/* [핵심 수정] 발견한 오브젝트에 원형 테두리를 추가합니다. */
.found-marker {
  position: absolute;
  border: 4px solid #ffdd40; /* 눈에 띄는 노란색 계열 테두리 */
  border-radius: 50%;
  box-shadow: 0 0 20px #ffd700, inset 0 0 15px rgba(255, 215, 0, 0.5);
  transform: scale(0);
  animation: found-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  pointer-events: none;
}
@keyframes found-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.sparkle { position: absolute; width: 100%; height: 100%; background-image: radial-gradient(circle, white 10%, transparent 11%), radial-gradient(circle, white 10%, transparent 11%); background-size: 30px 30px; background-position: 0 0, 15px 15px; animation: sparkle-anim 0.8s ease-out forwards; }
@keyframes sparkle-anim { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }

/* [핵심 추가] 중앙 카운트다운 효과 스타일 */
.countdown-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001; /* 다른 모든 요소 위에 표시 */
  pointer-events: none; /* 클릭 방해하지 않도록 설정 */
}
.countdown-number {
  font-size: 20vw; /* 화면 너비에 비례하는 큰 글씨 */
  font-weight: bold;
  color: #dc3545; /* 빨간색 */
  text-shadow: 0 0 20px rgba(0,0,0,0.5);
  animation: countdown-pulse 1s ease-out forwards;
}
@keyframes countdown-pulse {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}

.game-over-modal { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background-color: rgba(0,0,0,0.7); z-index: 100; }
.modal-content { background: white; padding: 40px; border-radius: 16px; text-align: center; width: 90%; max-width: 400px; }
</style>
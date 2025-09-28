<<template>
  <div class="page-container hidden-object-page">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner-large"></div>
      <p>게임을 불러오는 중...</p>
    </div>

    <div v-if="level" class="game-container">
      <div class="image-area" ref="imageAreaRef" @click="handleImageClick">
        <img :src="level.imageUrl" alt="숨은그림찾기 배경" @load="onImageLoad" />
        <div v-for="found in foundObjects" :key="found.id" class="found-marker" :style="getMarkerStyle(found.id)"></div>
      </div>

      <div class="ui-panel card">
        <h3>찾아야 할 물건</h3>
        <ul class="object-list">
          <li v-for="obj in level.objectsToFind" :key="obj.id" :class="{ 'found': isFound(obj.id) }">
            <i class="fas fa-check-circle"></i> {{ obj.name }}
          </li>
        </ul>
        <p class="timer">남은 시간: {{ timer }}초</p>
      </div>
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
import { ref, onMounted, onUnmounted, reactive } from 'vue';
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

const isFound = (objectId) => {
    return foundObjects.value.some(f => f.id === objectId);
};

const getMarkerStyle = (objectId) => {
    if (!level.value || !imageAreaRef.value) return {};
    const obj = level.value.objectsToFind.find(o => o.id === objectId);
    if (!obj) return {};

    const displayRect = imageAreaRef.value.querySelector('img').getBoundingClientRect();
    const scale = displayRect.width / imageDimensions.naturalWidth;
    
    return {
        left: `${obj.coords.x * scale}px`,
        top: `${obj.coords.y * scale}px`,
        width: `${obj.coords.width * scale}px`,
        height: `${obj.coords.height * scale}px`,
    };
};

const onImageLoad = (event) => {
    imageDimensions.naturalWidth = event.target.naturalWidth;
    imageDimensions.naturalHeight = event.target.naturalHeight;
};

const handleImageClick = async (event) => {
    if (!imageAreaRef.value || gameResult.status) return;
    const img = imageAreaRef.value.querySelector('img');
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const scale = imageDimensions.naturalWidth / rect.width;
    
    const clickCoords = {
        x: (event.clientX - rect.left) * scale,
        y: (event.clientY - rect.top) * scale
    };
    
    for (const obj of level.value.objectsToFind) {
        if (!isFound(obj.id)) {
            const { x, y, width, height } = obj.coords;
            const isCorrect = (clickCoords.x >= x && clickCoords.x <= x + width) &&
                              (clickCoords.y >= y && clickCoords.y <= y + height);
            
            if (isCorrect) {
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
.hidden-object-page { display: flex; justify-content: center; align-items: center; padding: 20px; }
.game-container { display: flex; gap: 20px; }
.image-area { position: relative; cursor: pointer; }
.image-area img { max-width: 800px; border-radius: 8px; }
.found-marker { position: absolute; border: 3px solid #ffd700; border-radius: 50%; /* ... */ }
.ui-panel { width: 250px; }
.object-list { list-style: none; padding: 0; }
.object-list li.found { text-decoration: line-through; color: #888; }
.game-over-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  z-index: 100;
  text-align: center;
  width: 90%;
  max-width: 400px;
}
.game-over-modal h2 {
  font-size: 2em;
  margin: 0 0 20px;
}
.game-over-modal p {
  font-size: 1.2em;
  color: #555;
  margin-bottom: 30px;
}
.btn-primary {
  padding: 12px 25px;
  border: none;
  background-color: #007bff;
  color: white;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  font-size: 1.1em;
}
</style>
<template>
  <div class="crystal-page">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>나의 소금 결정을 불러오는 중...</p>
    </div>

    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 나만의 소금 결정 키우기</h1>
      <p>매일 정성을 쏟아 세상에 단 하나뿐인 당신의 결정을 완성하세요.</p>
    </header>

    <div class="card game-container">
      <div class="crystal-display-area">
        <div class="crystal-stage">
          <div :class="['crystal-aura', `tier-${userTier}`]" v-if="crystal.level >= 4"></div>
          <img :src="crystalImage" :class="['crystal-image', `level-${crystal.level}`]" alt="소금 결정" />
        </div>
      </div>

      <div v-if="crystal.level < 5" class="growth-section">
        <div class="level-info">
          <h3>{{ crystal.level }}단계: {{ crystalNames[crystal.level] }}</h3>
          <p>다음 단계까지 {{ requiredPoints - crystal.growthPoints }} 포인트 남음</p>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{width: `${(crystal.growthPoints / requiredPoints) * 100}%`}"></div>
        </div>
        <div class="action-grid">
          <button @click="performAction('water')" :disabled="isProcessing || dailyActions.watered" class="action-button">
            <i class="fas fa-tint"></i> 물 주기 (+10)
          </button>
          <button @click="performAction('sunlight')" :disabled="isProcessing || dailyActions.sunlit" class="action-button">
            <i class="fas fa-sun"></i> 햇볕 쬐기 (+5)
          </button>
          <button @click="performAction('mineral')" :disabled="isProcessing || dailyActions.mineralized" class="action-button">
            <i class="fas fa-gem"></i> 미네랄 주기 (+5)
          </button>
        </div>
      </div>

      <div v-else class="final-section">
        <h3>궁극의 결정: {{ crystalNames[5] }}</h3>
        <p>축하합니다! 당신의 결정이 최종 형태로 성장했습니다.</p>
        <div class="final-actions">
          <button @click="performAction('harvest')" :disabled="isProcessing" class="btn-harvest">
            <i class="fas fa-hand-holding-usd"></i> 수확하기 (50,000 SaltMate 획득)
          </button>
          <button @click="performAction('createHeirloom')" :disabled="isProcessing" class="btn-heirloom">
            <i class="fas fa-archive"></i> 명예의 결정으로 제작 (3,000 SaltMate 소모)
          </button>
        </div>
      </div>
    </div>
     <router-link to="/crystal-hall" class="hall-of-fame-link">
      <i class="fas fa-landmark"></i> 명예의 결정실 보러가기
    </router-link>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { auth, db, functions } from '@/firebaseConfig';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useRouter } from 'vue-router';

export default {
  name: 'SaltCrystalPage',
  setup() {
    const isLoading = ref(true);
    const isProcessing = ref(false);
    const userTier = ref('BRONZE');
    const crystal = ref({
      level: 1,
      growthPoints: 0,
      lastAction: {},
    });
    const dailyActions = ref({
      watered: false,
      sunlit: false,
      mineralized: false,
    });

    const crystalNames = ["", "결정 씨앗", "원석", "결정체", "크리스탈", "궁극의 결정"];
    const requiredPoints = computed(() => [0, 50, 150, 300, 500][crystal.value.level] || 0);

    const crystalImage = computed(() => {
      try {
        // 각 레벨에 맞는 이미지 파일을 /src/assets/game_assets/ 폴더에 crystal_lv1.png ~ crystal_lv5.png 이름으로 저장해야 합니다.
        // 5단계 이미지는 등급별로 crystal_lv5_bronze.png, crystal_lv5_infinite.png 와 같이 별도로 필요합니다.
        if (crystal.value.level < 5) {
          return require(`@/assets/game_assets/crystal_lv${crystal.value.level}.png`);
        } else {
          return require(`@/assets/game_assets/crystal_lv5_${userTier.value.toLowerCase()}.png`);
        }
      } catch (e) {
        return require('@/assets/crystal.png'); // 기본 이미지
      }
    });

    const checkDailyActions = (lastActionData) => {
        const todayStr = new Date(new Date().getTime() + 9*60*60*1000).toISOString().slice(0, 10);
        dailyActions.value.watered = lastActionData.water === todayStr;
        dailyActions.value.sunlit = lastActionData.sunlight === todayStr;
        dailyActions.value.mineralized = lastActionData.mineral === todayStr;
    };

    const fetchCrystalState = async () => {
      try {
        const functionsWithRegion = getFunctions(auth.app, "asia-northeast3");
        const getCrystalState = httpsCallable(functionsWithRegion, 'getCrystalState');
        const result = await getCrystalState();
        crystal.value = result.data;
        checkDailyActions(result.data.lastAction || {});

        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        if(userDoc.exists) userTier.value = userDoc.data().tier || 'BRONZE';

      } catch (error) {
        console.error("결정 정보 로딩 실패:", error);
        alert(`오류: ${error.message}`);
      } finally {
        isLoading.value = false;
      }
    };

    const performAction = async (action) => {
      isProcessing.value = true;
      try {
        let func, payload;
        const functionsWithRegion = getFunctions(auth.app, "asia-northeast3");

        if (['water', 'sunlight', 'mineral'].includes(action)) {
          func = httpsCallable(functionsWithRegion, 'growCrystal');
          payload = { action };
        } else if (['harvest', 'createHeirloom'].includes(action)) {
          if(!confirm(action === 'harvest' ? '정말로 수확하시겠습니까?' : '3,000 SaltMate를 사용하여 명예의 결정으로 제작하시겠습니까?')) {
            isProcessing.value = false;
            return;
          }
          func = httpsCallable(functionsWithRegion, 'finalizeCrystal');
          payload = { action };
        }
        
        const result = await func(payload);
        
        if (['harvest', 'createHeirloom'].includes(action)) {
          alert(result.data.message);
          crystal.value = { level: 1, growthPoints: 0, lastAction: {} }; // 상태 초기화
          checkDailyActions({});
        } else {
          crystal.value = result.data;
          checkDailyActions(result.data.lastAction || {});
        }

      } catch (error) {
        console.error(`${action} 작업 실패:`, error);
        alert(`오류: ${error.message}`);
      } finally {
        isProcessing.value = false;
      }
    };

    onMounted(() => {
      if (auth.currentUser) {
        fetchCrystalState();
      } else {
        isLoading.value = false;
      }
    });

    return {
      isLoading,
      isProcessing,
      crystal,
      dailyActions,
      userTier,
      crystalNames,
      requiredPoints,
      crystalImage,
      performAction,
    };
  }
}
</script>

<style scoped>
.crystal-page {
  padding: 20px;
  background: linear-gradient(to bottom, #141e30, #243b55);
  min-height: calc(100vh - 70px);
  color: #fff;
}
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 100;
}
.page-header { text-align: center; margin: 50px 0; }
.page-header h1 { font-size: 2.5em; }
.page-header p { font-size: 1.1em; color: #bdc3c7; }
.game-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.crystal-display-area {
  height: 350px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 30px;
}
.crystal-stage { position: relative; }
.crystal-image {
  max-width: 300px;
  max-height: 300px;
  transition: all 1s ease-in-out;
  animation: float 4s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}
.crystal-image.level-1 { width: 80px; }
.crystal-image.level-2 { width: 120px; }
.crystal-image.level-3 { width: 180px; filter: drop-shadow(0 0 15px #fff); }
.crystal-image.level-4 { width: 240px; filter: drop-shadow(0 0 30px #fff); }
.crystal-image.level-5 { width: 300px; filter: drop-shadow(0 0 50px #fff); }

.crystal-aura {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: aura-pulse 3s infinite alternate;
}
.crystal-aura.tier-vvip { background: radial-gradient(circle, rgba(255,215,0,0.5) 0%, rgba(255,215,0,0) 70%); }
.crystal-aura.tier-infinite { background: radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 70%); }
@keyframes aura-pulse { from { transform: scale(0.8); opacity: 0.5; } to { transform: scale(1.2); opacity: 1; } }

.growth-section, .final-section { text-align: center; }
.level-info h3 { font-size: 1.8em; margin: 0; }
.progress-bar { height: 20px; background: rgba(0,0,0,0.3); border-radius: 10px; margin: 20px 0; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #66a6ff, #89f7fe); transition: width 0.5s ease; border-radius: 10px; }
.action-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.action-button {
  padding: 15px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
}
.action-button:disabled { background: rgba(0,0,0,0.2); color: #777; cursor: not-allowed; }
.final-section h3 { font-size: 2em; }
.final-actions { display: flex; justify-content: center; gap: 20px; margin-top: 30px; }
.btn-harvest, .btn-heirloom {
  padding: 15px 30px;
  font-size: 1.1em;
  font-weight: bold;
}
.btn-harvest { background-color: #28a745; }
.btn-heirloom { background-color: #9b59b6; }
.hall-of-fame-link { display: block; text-align: center; margin-top: 30px; color: #3498db; }
</style>
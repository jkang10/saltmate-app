<template>
  <div class="crystal-hall-page">
    <header class="hall-header">
      <h1><i class="fas fa-landmark"></i> 명예의 결정실</h1>
      <p>수많은 노력으로 탄생한 영롱한 결정 소금석들을 감상해보세요.</p>
    </header>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>결정 소금석들을 불러오는 중...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p><i class="fas fa-exclamation-triangle"></i> 데이터를 불러오는 중 오류가 발생했습니다: {{ error }}</p>
      <button @click="fetchHeirlooms" class="btn-refresh"><i class="fas fa-sync-alt"></i> 다시 시도</button>
    </div>

    <div v-else-if="heirlooms.length === 0" class="empty-state">
      <p>아직 명예의 결정 소금석이 전시되지 않았습니다. 첫 번째 제작자가 되어보세요!</p>
      <router-link to="/salt-crystal-game" class="btn-primary">
        <i class="fas fa-gem"></i> 나의 결정 키우러 가기
      </router-link>
    </div>

    <div v-else class="crystal-grid">
      <div v-for="heirloom in heirlooms" :key="heirloom.id" class="heirloom-card">
        <div class="heirloom-image-container">
          <div :class="['card-aura', `tier-${heirloom.tier.toLowerCase()}`]"></div>
          <img :src="getHeirloomImage(heirloom.tier)" alt="명예의 결정" class="heirloom-image" />
        </div>
        <div class="heirloom-info">
          <h3>{{ heirloom.ownerName }}님의 결정</h3>
          <p class="tier-info">등급: <span :class="`tier-text tier-${heirloom.tier.toLowerCase()}`">{{ heirloom.tier }}</span></p>
          <p class="date-info">제작일: {{ formatDate(heirloom.createdAt) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export default {
  name: 'CrystalHallPage',
  setup() {
    const heirlooms = ref([]);
    const isLoading = ref(true);
    const error = ref(null);

    const getHeirloomImage = (tier) => {
      // 등급별 최종 결정을 명예의 결정 이미지로 사용
      try {
        return require(`@/assets/game_assets/crystal_lv5_${tier.toLowerCase()}.png`);
      } catch (e) {
        return require('@/assets/crystal.png'); // 대체 이미지
      }
    };

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return "N/A";
      return timestamp.toDate().toLocaleDateString("ko-KR", {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    };

    const fetchHeirlooms = async () => {
      isLoading.value = true;
      error.value = null;
      try {
        const q = query(
          collection(db, "crystalHeirlooms"),
          orderBy("createdAt", "desc"),
          limit(50) // 최대 50개까지 전시 (조절 가능)
        );
        const querySnapshot = await getDocs(q);
        heirlooms.value = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (e) {
        console.error("명예의 결정실 데이터 로딩 실패:", e);
        error.value = e.message;
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(fetchHeirlooms);

    return {
      heirlooms,
      isLoading,
      error,
      getHeirloomImage,
      formatDate,
      fetchHeirlooms, // 오류 시 재시도 버튼을 위해 노출
    };
  }
};
</script>

<style scoped>
.crystal-hall-page {
  padding: 20px;
  background: linear-gradient(to bottom, #1a2a3a, #0f1c2a); /* 어둡고 신비로운 배경 */
  min-height: calc(100vh - 70px);
  color: #e0e0e0;
  text-align: center;
}

.hall-header {
  margin: 50px 0;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  max-width: 800px;
  margin: 50px auto;
}

.hall-header h1 {
  font-size: 3em;
  color: #fff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.hall-header p {
  font-size: 1.2em;
  color: #a0a0a0;
  margin-top: 10px;
}

.loading-state, .empty-state, .error-state {
  padding: 80px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  max-width: 600px;
  margin: 50px auto;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.spinner {
  border: 6px solid rgba(255, 255, 255, 0.2);
  border-left-color: #7289da; /* Discord blue */
  border-radius: 50%;
  width: 60px;
  height: 60px;
  animation: spin 1.2s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.btn-primary {
  background-color: #7289da;
  color: white;
  padding: 12px 25px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 1.1em;
  transition: background-color 0.3s ease;
  margin-top: 20px;
  display: inline-block;
}

.btn-primary:hover {
  background-color: #677bc4;
}

.crystal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 40px;
  max-width: 1200px;
  margin: 50px auto;
}

.heirloom-card {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  backdrop-filter: blur(5px);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.heirloom-card:hover {
  transform: translateY(-10px) scale(1.02);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
}

.heirloom-image-container {
  position: relative;
  width: 100%;
  padding-bottom: 100%; /* 정사각형 */
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.heirloom-image {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 80%;
  max-height: 80%;
  object-fit: contain;
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.4));
  animation: float-small 3s ease-in-out infinite alternate;
}

@keyframes float-small {
  0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
  50% { transform: translate(-50%, -50%) translateY(-10px); }
}

.card-aura {
  position: absolute;
  inset: 10%; /* 이미지보다 약간 작게 */
  border-radius: 50%;
  opacity: 0.6;
  filter: blur(15px);
  animation: aura-pulse-small 4s infinite alternate;
}

@keyframes aura-pulse-small {
  0%, 100% { transform: scale(0.95); opacity: 0.5; }
  50% { transform: scale(1.05); opacity: 0.7; }
}

.card-aura.tier-bronze { background: radial-gradient(circle, rgba(205, 127, 50, 0.8), rgba(205, 127, 50, 0)); }
.card-aura.tier-premium { background: radial-gradient(circle, rgba(192, 192, 192, 0.8), rgba(192, 192, 192, 0)); }
.card-aura.tier-vip { background: radial-gradient(circle, rgba(255, 215, 0, 0.8), rgba(255, 215, 0, 0)); }
.card-aura.tier-vvip { background: radial-gradient(circle, rgba(220, 220, 220, 0.8), rgba(220, 220, 220, 0)); }
.card-aura.tier-infinite { background: radial-gradient(circle, rgba(135, 206, 250, 0.8), rgba(147, 112, 219, 0), rgba(255, 105, 180, 0.8)); } /* 여러 색상 그라데이션 */

.heirloom-info {
  text-align: center;
}

.heirloom-info h3 {
  font-size: 1.5em;
  color: #fff;
  margin-bottom: 10px;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
}

.tier-info, .date-info {
  font-size: 0.95em;
  color: #a0a0a0;
  margin-bottom: 5px;
}

.tier-text {
  font-weight: bold;
}
.tier-text.tier-bronze { color: #cd7f32; }
.tier-text.tier-premium { color: #c0c0c0; }
.tier-text.tier-vip { color: #ffd700; }
.tier-text.tier-vvip { color: #e0e0e0; }
.tier-text.tier-infinite { color: #8a2be2; } /* 보라색 계열 */
</style>
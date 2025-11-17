<template>
  <div class="ranking-widget card premium-glass">
    <div class="widget-header">
      <h3><i class="fas fa-chart-line"></i> 주간 GOLD 수익 랭킹</h3>
      <p>지난주 최고의 트레이더</p>
    </div>
    <div v-if="loading" class="loading-spinner"></div>
    <div v-else-if="rankings.length > 0" class="podium-container">
      <div v-if="rankings[1]" class="podium-item rank-2">
        <div class="podium-rank"><i class="fas fa-medal"></i> 2</div>
        <div class="player-name">{{ rankings[1].userName }}</div>
        <div class="player-score">{{ rankings[1].totalWinnings.toLocaleString() }} G</div>
      </div>
      <div v-if="rankings[0]" class="podium-item rank-1">
        <div class="podium-rank"><i class="fas fa-trophy"></i> 1</div>
        <div class="player-name">{{ rankings[0].userName }}</div>
        <div class="player-score">{{ rankings[0].totalWinnings.toLocaleString() }} G</div>
      </div>
      <div v-if="rankings[2]" class="podium-item rank-3">
        <div class="podium-rank"><i class="fas fa-award"></i> 3</div>
        <div class="player-name">{{ rankings[2].userName }}</div>
        <div class="player-score">{{ rankings[2].totalWinnings.toLocaleString() }} G</div>
      </div>
    </div>
    <p v-else class="no-data">지난주 랭킹 데이터가 없습니다.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebaseConfig";

const rankings = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const getRankings = httpsCallable(functions, "getWeeklyGoldRankings");
    const result = await getRankings();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("주간 골드 랭킹 로딩 실패:", error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* (TokenMine.vue와 유사한 프리미엄 테마) */
.premium-glass {
  background: rgba(10, 0, 20, 0.7) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(170, 70, 255, 0.3) !important;
  color: #f0f0f0 !important;
  padding: 20px;
  border-radius: 15px;

  /* ▼▼▼ [★핵심 수정 1★] 카드 높이를 100%로 강제하는 flex 속성을 제거합니다. ▼▼▼ */
  /* display: flex; */
  /* flex-direction: column; */
  /* height: 100%; */
  /* ▲▲▲ (수정 완료) ▲▲▲ */
}
.widget-header { text-align: center; margin-bottom: 25px; }
.widget-header h3 {
  font-size: 1.6em;
  font-weight: 700;
  color: #fff;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  text-shadow: 0 0 8px rgba(208, 159, 255, 0.7);
}
.widget-header p { font-size: 0.9em; color: #bdc3c7; margin-top: 5px; }

.podium-container {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 5px; 
  height: 200px;

  /* ▼▼▼ [★핵심 수정 2★] 'auto' 대신 고정 여백을 다시 사용합니다. (겹치지 않을 만큼) ▼▼▼ */
  margin-top: 45px; 
  /* ▲▲▲ (수정 완료) ▲▲▲ */
}

.podium-item {
  flex-basis: 32%; 
  max-width: 120px; 
  padding: 15px 10px;
  border-radius: 10px 10px 0 0;
  text-align: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  transition: all 0.3s ease;
}
.podium-rank { font-size: 1.5em; font-weight: bold; margin-bottom: 10px; }
.player-name { font-size: 1.1em; font-weight: 600; margin-bottom: 5px; color: #fff; }
.player-score { font-size: 1em; font-weight: 500; color: #f0f0f0; }

.rank-1 {
  background: linear-gradient(135deg, #FFD700, #E0A800);
  color: #2c3e50;
  height: 100%;
  border: 2px solid #FFD700;
}
.rank-1 .player-name, .rank-1 .player-score { color: #2c3e50; }

.rank-2 {
  background: linear-gradient(135deg, #C0C0C0, #A9A9A9);
  color: #2c3e50;
  height: 85%;
  border: 2px solid #C0C0C0;
}
.rank-2 .player-name, .rank-2 .player-score { color: #2c3e50; }

.rank-3 {
  background: linear-gradient(135deg, #CD7F32, #A0522D);
  color: #fff;
  height: 70%;
  border: 2px solid #CD7F32;
}

.no-data { 
  text-align: center; 
  padding: 20px; 
  color: #94a3b8; 
  
  /* ▼▼▼ [★핵심 수정 3★] flex 관련 auto 마진을 제거합니다. ▼▼▼ */
  /* margin-top: auto; */
  /* margin-bottom: auto; */
  /* ▲▲▲ (수정 완료) ▲▲▲ */
}
.loading-spinner {
  /* ▼▼▼ [★핵심 수정 4★] 'auto' 마진을 일반 마진으로 되돌립니다. ▼▼▼ */
  margin: 40px auto; 
  /* ▲▲▲ (수정 완료) ▲▲▲ */
  
  display: block;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #FFD700;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
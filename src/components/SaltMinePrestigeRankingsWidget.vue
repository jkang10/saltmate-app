<template>
  <div class="prestige-ranking-widget card">
    <div class="widget-header">
      <h3><i class="fas fa-crown"></i> 환생의 전당</h3>
      <p>가장 많이 환생한 불멸의 광부들</p>
    </div>
    <div v-if="loading" class="loading-spinner"></div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li v-for="(player, index) in rankings" :key="index" :class="['rank-item', 'rank-' + (index + 1)]">
        <div class="rank-badge">{{ index + 1 }}</div>
        <span class="player-name">{{ player.userName }}</span>
        <span class="player-level">Lv.{{ player.prestigeLevel }}</span>
      </li>
    </ul>
    <p v-else class="no-data">아직 환생한 유저가 없습니다.</p>
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
    const getRankings = httpsCallable(functions, "getSaltMinePrestigeRankings");
    const result = await getRankings();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("환생 랭킹 로딩 실패:", error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.prestige-ranking-widget {
  background: linear-gradient(145deg, #1e293b, #334155);
  color: #e2e8f0;
  border: 1px solid #475569;
}
.widget-header { text-align: center; margin-bottom: 20px; }
.widget-header h3 {
  font-size: 1.6em;
  color: #f1c40f;
  text-shadow: 0 0 10px #f1c40f;
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.widget-header p { font-size: 0.9em; color: #94a3b8; margin-top: 5px; }
.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.rank-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.3s ease;
}
.rank-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.03);
}
.rank-badge {
  font-weight: bold;
  font-size: 1.1em;
  width: 30px;
  text-align: center;
  color: #cbd5e1;
}
.player-name { flex-grow: 1; font-weight: 500; }
.player-level { font-weight: bold; font-size: 1.2em; color: #f1c40f; }
.rank-1 .rank-badge { color: #f1c40f; }
.rank-2 .rank-badge { color: #e0e0e0; }
.rank-3 .rank-badge { color: #cd7f32; }
.no-data { text-align: center; color: #94a3b8; }
.loading-spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
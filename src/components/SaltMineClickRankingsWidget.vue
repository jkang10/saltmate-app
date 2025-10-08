<template>
  <div class="click-ranking-widget card">
    <div class="widget-header">
      <h3><i class="fas fa-hand-pointer"></i> 광클의 제왕</h3>
    </div>
    <div v-if="loading" class="loading-spinner"></div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li v-for="(player, index) in rankings" :key="index">
        <div class="rank-icon">
          <span v-if="index === 0">🥇</span>
          <span v-else-if="index === 1">🥈</span>
          <span v-else-if="index === 2">🥉</span>
        </div>
        <span class="player-name">{{ player.userName }}</span>
        <span class="player-clicks">{{ player.totalClicks.toLocaleString() }} <small>클릭</small></span>
      </li>
    </ul>
    <p v-else class="no-data">랭킹 데이터가 없습니다.</p>
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
    const getRankings = httpsCallable(functions, "getSaltMineClickRankings");
    const result = await getRankings();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("클릭 랭킹 로딩 실패:", error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.click-ranking-widget {
  background-color: #e7f1ff;
  border: 1px solid #b3d4ff;
  transition: all 0.3s ease;
}
.click-ranking-widget:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
}
.widget-header { text-align: center; margin-bottom: 15px; }
.widget-header h3 {
  font-size: 1.6em;
  color: #0056b3;
  display: flex; align-items: center; justify-content: center; gap: 10px;
}
.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }

/* [핵심 수정] li 요소를 flex 대신 grid로 변경하여 간격을 조절합니다. */
li {
  display: grid;
  grid-template-columns: auto 1fr auto; /* 아이콘(auto) - 이름(나머지공간) - 클릭수(auto) */
  gap: 10px; /* 요소들 사이의 간격 */
  align-items: baseline;
  padding: 10px;
  background-color: #fff;
  border-radius: 8px;
}
.rank-icon { font-size: 1.5em; }
.player-name { font-size: 1.1em; font-weight: 600; color: #333; }
.player-clicks { font-size: 1.2em; font-weight: bold; color: #007bff; white-space: nowrap; }
.player-clicks small { font-size: 0.8em; color: #666; }

.no-data { text-align: center; padding: 20px; color: #666; }
.loading-spinner {
  margin: 20px auto;
  display: block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
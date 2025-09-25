<template>
  <div class="widget-card enchant-rank-widget">
    <div class="widget-header">
      <h4><i class="fas fa-hammer"></i> 소금 강화 랭킹 TOP 7</h4>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <ul v-else-if="rankings.length > 0" class="ranking-list">
        <li v-for="(player, index) in rankings" :key="player.userId" :class="getRankClass(index)">
          <span class="rank">{{ index + 1 }}</span>
          <span class="name">{{ player.userName }}</span>
          <span class="score">+{{ player.level }} {{ player.itemName }}</span>
        </li>
      </ul>
      <div v-else class="no-data">
        <p>랭킹 데이터가 없습니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const isLoading = ref(true);
const rankings = ref([]);

const getRankClass = (index) => {
  if (index === 0) return 'rank-1';
  if (index === 1) return 'rank-2';
  if (index === 2) return 'rank-3';
  return '';
};

const fetchRankings = async () => {
  isLoading.value = true;
  try {
    const getEnchantRankings = httpsCallable(functions, 'getEnchantRankings');
    const result = await getEnchantRankings();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("강화 랭킹 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchRankings);
</script>

<style scoped>
.widget-card { background-color: #4a4a4a; color: #ecf0f1; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; }
.widget-header { margin-bottom: 15px; text-align: center; }
.widget-header h4 { margin: 0; font-size: 1.2em; }
.widget-body { flex-grow: 1; }
.ranking-list { list-style: none; padding: 0; margin: 0; }
.ranking-list li { display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; align-items: center; padding: 10px; border-radius: 5px; }
.ranking-list li:not(:last-child) { border-bottom: 1px solid #5a5a5a; }
.rank { font-weight: bold; font-size: 1.1em; text-align: center; }
.name { font-weight: 500; }
.score { font-family: monospace; font-size: 1.1em; color: #ffd700; }
.rank-1 { background-color: rgba(241, 196, 15, 0.2); }
.rank-1 .rank { color: #f1c40f; }
.rank-2 { background-color: rgba(192, 192, 192, 0.2); }
.rank-2 .rank { color: #c0c0c0; }
.rank-3 { background-color: rgba(205, 127, 50, 0.2); }
.rank-3 .rank { color: #cd7f32; }
.loading-spinner, .no-data { text-align: center; padding: 20px; color: #95a5a6; }
.loading-spinner { border: 3px solid rgba(255, 255, 255, 0.2); border-top-color: #fff; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
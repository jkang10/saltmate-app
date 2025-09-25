<template>
  <div class="widget-card enchant-rank-widget">
    <div class="widget-header">
      <h4><i class="fas fa-hammer"></i> 소금 강화 랭킹 TOP 7</h4>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <ul v-else-if="rankings.length > 0" class="ranking-list">
        <li v-for="(player, index) in rankings" :key="player.userId" :class="`rank-${index + 1}`">
          <span class="rank" v-html="getRankIcon(index)"></span>
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

// 기존 getRankClass 함수를 삭제하고 아래 함수로 교체합니다.
const getRankIcon = (index) => {
  if (index === 0) return '<i class="fas fa-crown"></i>';
  if (index === 1) return '<i class="fas fa-medal"></i>';
  if (index === 2) return '<i class="fas fa-award"></i>';
  return index + 1;
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
.widget-card { background-color: #2c3e50; color: #ecf0f1; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
.widget-header { margin-bottom: 15px; text-align: center; }
.widget-header h4 { margin: 0; font-size: 1.2em; color: white; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.widget-body { flex-grow: 1; }
.ranking-list { list-style: none; padding: 0; margin: 0; }
.ranking-list li { 
  display: grid; 
  grid-template-columns: 40px 1fr auto; 
  gap: 10px; 
  align-items: center; 
  padding: 12px 15px; 
  border-radius: 8px;
  transition: all 0.3s ease;
  border-bottom: 1px solid #34495e;
}
.ranking-list li:last-child {
    border-bottom: none;
}
.ranking-list li:hover {
    transform: translateX(5px);
    background-color: rgba(255, 255, 255, 0.05);
}

.rank { font-weight: bold; font-size: 1.2em; text-align: center; }
.name { font-weight: 500; font-size: 1.05em; }
.score { font-family: monospace; font-size: 1.1em; font-weight: bold; color: #ffd700; }

/* --- 1등 스타일 (매우 화려하게) --- */
.rank-1 {
  background-size: 400% 400%;
  animation: rainbow-glow 4s ease infinite;
  background-image: linear-gradient(-45deg, #ffdd57, #ff9f43, #ff6b81, #2f3542);
  color: #1e272e;
  transform: scale(1.03);
  box-shadow: 0 0 20px rgba(255, 221, 87, 0.7);
}
.rank-1 .name { color: #1e272e; font-weight: 700; }
.rank-1 .score { color: #d63031; text-shadow: 0 0 5px white; }
.rank-1 .rank .fa-crown { color: #fbc531; animation: crown-shine 2s infinite; }

/* --- 2등 스타일 (고급스럽게) --- */
.rank-2 {
  background-color: rgba(236, 240, 241, 0.1);
  box-shadow: inset 0 0 10px rgba(189, 195, 199, 0.3);
}
.rank-2 .rank .fa-medal { color: #c0c0c0; text-shadow: 0 0 5px #fff; }
.rank-2 .name { color: #ecf0f1; }

/* --- 3등 스타일 --- */
.rank-3 .rank .fa-award { color: #cd7f32; }

.loading-spinner, .no-data { text-align: center; padding: 20px; color: #95a5a6; }
.loading-spinner { border: 3px solid rgba(255, 255, 255, 0.2); border-top-color: #fff; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }

/* --- 애니메이션 키프레임 --- */
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes rainbow-glow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

@keyframes crown-shine {
  0%, 100% { filter: drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #fbc531); }
  50% { filter: drop-shadow(0 0 5px #fff) drop-shadow(0 0 15px #f1c40f); }
}
</style>
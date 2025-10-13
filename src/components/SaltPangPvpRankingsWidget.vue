<template>
  <div class="widget-card pvp-rank-widget">
    <div class="widget-header">
      <h4><i class="fas fa-fist-raised"></i> 주간 대전 랭킹 TOP 7</h4>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <ul v-else-if="rankings.length > 0" class="ranking-list">
        <li v-for="(player, index) in rankings" :key="player.userId" :class="['rank-item', 'rank-' + (index + 1)]">
          <span class="rank">{{ index + 1 }}</span>
          <span class="name">{{ player.userName }}</span>
          <span class="wins">{{ player.wins }}승</span>
        </li>
      </ul>
      <div v-else class="no-data">
        <p>지난주 랭킹 데이터가 없습니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const isLoading = ref(true);
const rankings = ref([]);

// ▼▼▼ [핵심 수정] '지난주'의 weekId를 더 안정적으로 계산하는 로직으로 변경 ▼▼▼
const lastWeekId = computed(() => {
  const now = new Date();
  // 오늘이 월요일이든 아니든, 어제로 날짜를 돌리면 항상 '지난주'에 속하게 됨
  const yesterday = new Date(now.setDate(now.getDate() - 1));
  const dayOfWeek = yesterday.getDay(); // 0=일, 1=월, ..., 6=토
  // 해당 주의 월요일을 계산
  const diff = yesterday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
  const lastMonday = new Date(yesterday.setDate(diff));
  
  return lastMonday.toISOString().slice(0, 10);
});
// ▲▲▲

const fetchRankings = async () => {
  isLoading.value = true;
  try {
    const q = query(
      collection(db, `leaderboards/pvp_weekly_wins/${lastWeekId.value}`),
      orderBy("rank", "asc"),
      limit(7)
    );
    const snapshot = await getDocs(q);
    rankings.value = snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("주간 대전 랭킹 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchRankings);
</script>

<style scoped>
.widget-card {
  background: linear-gradient(135deg, #485461 0%, #28313b 100%);
  color: #fff;
  border-radius: 15px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}
.widget-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}
.widget-header { 
  text-align: center; 
  border-bottom: 1px solid rgba(255,255,255,0.2); 
  padding-bottom: 10px; 
  margin-bottom: 15px; 
}
.widget-header h4 { 
  margin: 0; 
  font-size: 1.3em; 
  font-weight: 700; 
}
.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;}
.rank-item { 
  display: grid; 
  grid-template-columns: 30px 1fr auto; 
  gap: 15px; 
  align-items: center; 
  padding: 8px 10px; 
  border-radius: 8px; 
  transition: background-color 0.2s; 
  background-color: rgba(255,255,255,0.05);
}
.rank-item:hover { background-color: rgba(255,255,255,0.1); }
.rank { font-weight: bold; font-size: 1.1em; text-align: center; color: #bdc3c7; }
.name { font-weight: 500; font-size: 1.05em; }
.wins { font-family: monospace; font-size: 1.1em; font-weight: bold; }

.rank-1 .rank { color: #f1c40f; }
.rank-2 .rank { color: #c0c0c0; }
.rank-3 .rank { color: #cd7f32; }

.loading-spinner, .no-data { text-align: center; padding: 30px 0; color: #bdc3c7; }
</style>
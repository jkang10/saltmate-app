<template>
  <div class="widget-card">
    <div class="widget-header">
      <h4><i class="fas fa-trophy"></i> 주간 명예의 전당</h4>
      <div class="tabs">
        <button @click="activeTab = 'saltKing'" :class="{active: activeTab === 'saltKing'}">소금왕</button>
        <button @click="activeTab = 'seaExplorer'" :class="{active: activeTab === 'seaExplorer'}">해양탐험가</button>
      </div>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <ul v-else-if="currentRankings.length > 0" class="ranking-list">
        <li v-for="(player, index) in currentRankings" :key="player.id" :class="getRankClass(index)">
          <span class="rank">{{ index + 1 }}</span>
          <span class="name">{{ player.userName }}</span>
          <span class="score">{{ player.score.toLocaleString() }} {{ activeTab === 'saltKing' ? 'Salt' : '물' }}</span>
        </li>
      </ul>
      <div v-else class="no-data">
        <p>지난 주 기록이 없습니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'; // watch 추가
import { db } from '@/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const isLoading = ref(true);
const activeTab = ref('saltKing');
const rankings = ref({
  saltKing: [],
  seaExplorer: [],
});

// 기존 computed 속성은 그대로 사용합니다.
const currentRankings = computed(() => {
  return rankings.value[activeTab.value];
});

const getRankClass = (index) => {
  if (index === 0) return 'rank-1';
  if (index === 1) return 'rank-2';
  if (index === 2) return 'rank-3';
  return '';
};

const fetchRankings = async () => {
  isLoading.value = true;
  try {
    // [핵심 수정] 서버의 날짜 계산 로직과 100% 동일하게 수정합니다.
    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    const lastWeekId = lastMonday.toISOString().slice(0, 10);

    const challengeId = activeTab.value; // 현재 활성화된 탭의 랭킹을 가져옵니다.

    const q = query(
      collection(db, 'challenges'),
      where('weekId', '==', lastWeekId),
      where('challengeId', '==', challengeId),
      orderBy('rank', 'asc'),
      limit(3)
    );
    const snapshot = await getDocs(q);
    rankings.value[challengeId] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  } catch (error) {
    console.error(`주간 챌린지(${activeTab.value}) 랭킹 로딩 실패:`, error);
  } finally {
    isLoading.value = false;
  }
};

// [핵심 추가] 탭이 변경될 때마다 fetchRankings 함수를 다시 호출합니다.
watch(activeTab, fetchRankings);

// 컴포넌트가 처음 로드될 때 '소금왕' 랭킹을 가져옵니다.
onMounted(fetchRankings);
</script>

<style scoped>
.widget-card {
  background-color: #2c3e50;
  color: #ecf0f1;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.widget-header {
  margin-bottom: 15px;
}
.widget-header h4 {
  margin: 0 0 10px 0;
  font-size: 1.2em;
  text-align: center;
}
.tabs {
  display: flex;
  justify-content: center;
  background-color: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 5px;
}
.tabs button {
  flex: 1;
  padding: 8px;
  border: none;
  background-color: transparent;
  color: #bdc3c7;
  font-weight: bold;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
}
.tabs button.active {
  background-color: #3498db;
  color: white;
}
.widget-body {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.ranking-list li {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 5px;
}
.ranking-list li:not(:last-child) {
  border-bottom: 1px solid #34495e;
}
.rank {
  font-weight: bold;
  font-size: 1.1em;
  text-align: center;
}
.name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.score {
  font-family: monospace;
  font-size: 1.1em;
}
.rank-1 { background-color: rgba(241, 196, 15, 0.2); }
.rank-1 .rank { color: #f1c40f; }
.rank-2 { background-color: rgba(192, 192, 192, 0.2); }
.rank-2 .rank { color: #c0c0c0; }
.rank-3 { background-color: rgba(205, 127, 50, 0.2); }
.rank-3 .rank { color: #cd7f32; }
.loading-spinner, .no-data { text-align: center; padding: 20px; color: #95a5a6; }
.loading-spinner {
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
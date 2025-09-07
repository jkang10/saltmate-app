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
import { ref, onMounted, computed } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const isLoading = ref(true);
const activeTab = ref('saltKing');
const rankings = ref({
  saltKing: [],
  seaExplorer: [],
});

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
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    const lastWeekId = lastMonday.toISOString().slice(0, 10);

    const challenges = ['saltKing', 'seaExplorer'];
    for (const challengeId of challenges) {
      const q = query(
        collection(db, 'challenges'),
        where('weekId', '==', lastWeekId),
        where('challengeId', '==', challengeId),
        orderBy('rank', 'asc'),
        limit(3)
      );
      const snapshot = await getDocs(q);
      rankings.value[challengeId] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (error) {
    console.error("주간 챌린지 랭킹 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchRankings);
</script>

<style scoped>
.widget-card { 
    background: linear-gradient(135deg, #4b6cb7 0%, #182848 100%); 
    color: #fff; 
    border-radius: 15px; 
    padding: 20px; 
    display: flex; 
    flex-direction: column; 
    box-shadow: 0 10px 30px rgba(0,0,0,0.2); 
    overflow: hidden; /* [신규] 빛나는 효과를 위해 추가 */
    position: relative; /* [신규] 빛나는 효과를 위해 추가 */
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
.week-info { 
    font-size: 0.85em; 
    color: #bdc3c7; 
}
.ranking-list { 
    list-style: none; 
    padding: 0; 
    margin: 0; 
}
.ranking-list li { 
    display: grid; 
    grid-template-columns: 40px 1fr auto; 
    gap: 10px; 
    align-items: center; 
    padding: 12px 10px; 
    border-radius: 8px; 
    transition: background-color 0.2s; 
    border-bottom: 1px solid rgba(255,255,255,0.1);
}
.ranking-list li:last-child {
    border-bottom: none;
}
.ranking-list li:hover { 
    background-color: rgba(255,255,255,0.1); 
}
.rank { 
    font-weight: bold; 
    font-size: 1.2em; 
    text-align: center; 
}
.name { 
    font-weight: 500; 
    font-size: 1.1em; 
}
.score { 
    font-family: monospace; 
    font-size: 1.2em; 
    font-weight: bold; 
}

/* --- [핵심 수정] 1등 스타일 강화 --- */
.rank-1 { 
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.2));
    box-shadow: inset 0 0 15px rgba(255, 215, 0, 0.3);
    border-bottom: 1px solid rgba(255, 215, 0, 0.3);
}
.rank-1 .rank, .rank-1 .name, .rank-1 .score {
    color: #fff;
    text-shadow: 0 0 8px rgba(255, 215, 0, 0.7);
}
.rank .fa-crown { 
    color: #ffd700; /* 금색 */
    animation: crown-glow 2s ease-in-out infinite;
}

@keyframes crown-glow {
    0%, 100% { filter: drop-shadow(0 0 3px #ffd700); }
    50% { filter: drop-shadow(0 0 10px #ffed8a); }
}

/* --- 나머지 순위 스타일 (기존과 동일) --- */
.rank-2 .rank { color: #c0c0c0; }
.rank-3 .rank { color: #cd7f32; }

.widget-footer { 
    text-align: center; 
    font-size: 0.8em; 
    color: #95a5a6; 
    margin-top: 15px; 
    padding-top: 10px; 
    border-top: 1px solid rgba(255,255,255,0.2); 
}
.loading-spinner, .no-data { 
    text-align: center; 
    padding: 30px 0; 
    color: #bdc3c7; 
}
.no-data p { 
    margin: 0; 
    line-height: 1.4; 
}
</style>
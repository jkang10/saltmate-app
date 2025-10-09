<template>
  <div class="widget-card ranked-widget">
    <div class="widget-header">
      <h4><i class="fas fa-chess-king"></i> 솔트팡 주간 랭킹전</h4>
      <span class="week-info">{{ weekInfo }}</span>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <ul v-else-if="rankings.length > 0" class="ranking-list">
        <li v-for="(player, index) in rankings" :key="player.id" :class="getRankClass(index)">
          <span class="rank">
            <i v-if="index === 0" class="fas fa-crown"></i>
            <span v-else>{{ index + 1 }}</span>
          </span>
          <span class="name">{{ player.username }}</span>
          <span class="score">{{ player.score.toLocaleString() }} 점</span>
        </li>
      </ul>
      <div v-else class="no-data">
        <p>이번 주 랭킹이<br/>집계 중입니다.</p>
      </div>
    </div>
    <div class="widget-footer">
      <p>매주 월요일 0시에 순위가 집계됩니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'; // onUnmounted 추가
import { db } from '@/firebaseConfig';
// [수정] onSnapshot을 추가로 import 합니다.
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const isLoading = ref(true);
const rankings = ref([]);
let unsubscribe = null; // [신규] 실시간 리스너를 해제하기 위한 변수

const getMonday = (d) => {
  d = new Date(d);
  const day = d.getDay(),
        diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

const weekId = computed(() => {
  return getMonday(new Date()).toISOString().slice(0, 10);
});

const weekInfo = computed(() => {
    const start = getMonday(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getMonth()+1}.${start.getDate()} ~ ${end.getMonth()+1}.${end.getDate()}`;
});


const getRankClass = (index) => {
  if (index === 0) return 'rank-1';
  if (index === 1) return 'rank-2';
  if (index === 2) return 'rank-3';
  return '';
};

// [핵심 수정] fetchRankings 함수를 실시간으로 데이터를 수신하는 로직으로 변경합니다.
const listenToRankings = () => {
  isLoading.value = true;
  
  const q = query(
    collection(db, 'saltPangRanked', weekId.value, 'scores'),
    orderBy('score', 'desc'),
    limit(3)
  );
  
  // onSnapshot을 사용하여 데이터 변경을 실시간으로 감지합니다.
  unsubscribe = onSnapshot(q, (snapshot) => {
    rankings.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    isLoading.value = false;
  }, (error) => {
    console.error("솔트팡 랭킹전 실시간 로딩 실패:", error);
    isLoading.value = false;
  });
};

onMounted(listenToRankings);

// [신규] 컴포넌트가 사라질 때 실시간 리스너를 정리하여 메모리 누수를 방지합니다.
onUnmounted(() => {
    if(unsubscribe) {
        unsubscribe();
    }
});
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
    overflow: hidden;
    position: relative;
    transition: all 0.3s ease; /* [추가] 부드러운 애니메이션 효과를 위해 추가 */
}

/* [추가] 마우스 호버 시 위로 이동하고 그림자 효과를 강화 */
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
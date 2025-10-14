<template>
  <div class="widget-card pvp-rank-widget">
    <div class="widget-header">
      <h4><i class="fas fa-fist-raised"></i> 주간 대전 랭킹 TOP 7</h4>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <ul v-else-if="rankings.length > 0" class="ranking-list">
<li v-for="(player, index) in rankings" :key="player.userId" :class="['rank-item', 'rank-' + (index + 1)]">
  <span class="rank-medal">
    <i v-if="index === 0" class="fas fa-medal gold"></i>
    <i v-else-if="index === 1" class="fas fa-medal silver"></i>
    <i v-else-if="index === 2" class="fas fa-medal bronze"></i>
    <span v-else>{{ index + 1 }}</span>
  </span>
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
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=일, 1=월, ..., 6=토

  // 1. 오늘 날짜를 기준으로 이번 주의 월요일을 찾습니다.
  const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const thisMonday = new Date(today.setDate(diffToMonday));

  // 2. 찾은 이번 주 월요일에서 7일을 빼서 지난주 월요일을 계산합니다.
  const lastMonday = new Date(thisMonday.setDate(thisMonday.getDate() - 7));
  
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
.name { font-weight: 500; font-size: 1.05em; }
.wins { font-family: monospace; font-size: 1.1em; font-weight: bold; }

.loading-spinner, .no-data { text-align: center; padding: 30px 0; color: #bdc3c7; }
.rank-medal { 
  font-weight: bold; 
  font-size: 1.2em; 
  text-align: center; 
  width: 30px; /* 아이콘/숫자 공간 확보 */
  display: flex;
  justify-content: center;
  align-items: center;
}
.rank-medal .fas.fa-medal { font-size: 1.5em; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.rank-medal .fas.fa-medal.gold { color: #FFD700; } /* 금색 */
.rank-medal .fas.fa-medal.silver { color: #C0C0C0; } /* 은색 */
.rank-medal .fas.fa-medal.bronze { color: #CD7F32; } /* 동색 */

/* 1등 스타일 */
.rank-item.rank-1 {
  background: linear-gradient(45deg, #f0e1a1, #ffd700); /* 황금 그라데이션 */
  box-shadow: 0 5px 15px rgba(255, 215, 0, 0.4);
  border: 2px solid #ffcc00;
  color: #333;
  padding: 10px 12px;
}
.rank-item.rank-1 .name { font-size: 1.15em; font-weight: 800; color: #1a1a1a; }
.rank-item.rank-1 .wins { font-size: 1.2em; color: #1a1a1a; text-shadow: 0 1px 2px rgba(0,0,0,0.1); }

/* 2등 스타일 */
.rank-item.rank-2 {
  background: linear-gradient(45deg, #e0e0e0, #c0c0c0); /* 은색 그라데이션 */
  box-shadow: 0 3px 10px rgba(192, 192, 192, 0.4);
  border: 1px solid #b0b0b0;
  color: #444;
  padding: 9px 12px;
}
.rank-item.rank-2 .name { font-size: 1.1em; font-weight: 700; color: #2a2a2a; }
.rank-item.rank-2 .wins { font-size: 1.15em; color: #2a2a2a; }

/* 3등 스타일 */
.rank-item.rank-3 {
  background: linear-gradient(45deg, #d8bc8b, #cd7f32); /* 동색 그라데이션 */
  box-shadow: 0 2px 8px rgba(205, 127, 50, 0.4);
  border: 1px solid #b36b2b;
  color: #555;
  padding: 8px 12px;
}
.rank-item.rank-3 .name { font-size: 1.05em; font-weight: 600; color: #3a3a3a; }
.rank-item.rank-3 .wins { font-size: 1.1em; color: #3a3a3a; }

/* 일반 랭크 아이템 (4위 이하) */
.rank-item:not(.rank-1):not(.rank-2):not(.rank-3) {
  background-color: rgba(255,255,255,0.05); /* 기본 투명도 유지 */
  border: none; /* 상위권과의 차별 */
}
.rank-item:not(.rank-1):not(.rank-2):not(.rank-3):hover { 
  background-color: rgba(255,255,255,0.1); 
}
.rank-item:not(.rank-1):not(.rank-2):not(.rank-3) .rank-medal span { color: #bdc3c7; } /* 4위 이하 순위 번호 색상 */
.rank-item:not(.rank-1):not(.rank-2):not(.rank-3) .name { color: #fff; }
.rank-item:not(.rank-1):not(.rank-2):not(.rank-3) .wins { color: #fff; }

/* 기존 .rank 스타일은 위 .rank-medal로 대체되므로 삭제 */
.rank { display: none; } /* 기존 .rank 요소를 숨김 */
</style>
<template>
  <div class="feature-card ranking-widget">
    <div class="card-icon"><i class="fas fa-shield-alt"></i></div>
    <h3>솔트 가디언즈 TOP 7 <span class="daily-badge">일일</span></h3>
    
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-small"></div>
      <p>랭킹 불러오는 중...</p>
    </div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li v-for="(player, index) in rankings" :key="player.userId" :class="['rank-item', 'rank-' + (index + 1)]">
        <div class="rank-badge">
          <i v-if="index === 0" class="fas fa-crown gold-crown"></i>
          <i v-else-if="index === 1" class="fas fa-medal silver-medal"></i>
          <i v-else-if="index === 2" class="fas fa-award bronze-award"></i>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <div class="player-info">
          <span class="player-name">{{ player.userName }}</span>
          <span class="player-score">{{ player.score.toLocaleString() }}점</span>
        </div>
      </li>
    </ul>
    <div v-else class="no-data">
      <i class="fas fa-exclamation-circle"></i>
      <p>어제자 랭킹이 없습니다.</p>
      <small>오늘 게임에 참여하여 첫 랭커가 되어보세요!</small>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const rankings = ref([]);
const isLoading = ref(true);

const fetchRankings = async () => {
  try {
    // 한국 시간 기준 어제 날짜 계산
    const kstOffset = 9 * 60 * 60 * 1000;
    const now = new Date();
    // UTC 기준으로 현재 날짜를 구하고, 거기서 하루를 빼고 KST Offset을 더합니다.
    const yesterday = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0); // UTC 어제 0시
    const yesterdayKST = new Date(yesterday.getTime() + kstOffset); // KST 어제 0시

    const yesterdayId = yesterdayKST.toISOString().slice(0, 10); // YYYY-MM-DD 포맷
    
    console.log(`Fetching Salt Guardians rankings for: ${yesterdayId}`);

    const q = query(
      collection(db, `leaderboards/salt_guardians_daily/${yesterdayId}`),
      orderBy("score", "desc"),
      limit(7)
    );
    const snapshot = await getDocs(q);
    rankings.value = snapshot.docs.map(doc => doc.data());
    
    if (rankings.value.length === 0) {
      console.log(`No Salt Guardians rankings found for ${yesterdayId}`);
    }

  } catch (error) {
    console.error("솔트 가디언즈 랭킹 로딩 오류:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchRankings);

</script>

<style scoped>

.ranking-widget {
  display: flex;
  flex-direction: column;
  padding: 30px;
  background: linear-gradient(145deg, #ffffff, #f0f2f5);
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}
.ranking-widget:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.12);
}
.card-icon {
  font-size: 2.2em;
  color: #3498db;
  margin-bottom: 15px;
  text-align: center;
}
.ranking-widget h3 {
  font-size: 1.8em;
  color: #2c3e50;
  margin-bottom: 20px;
  text-align: center;
  position: relative;
  padding-bottom: 10px;
  /* [핵심 수정] flexbox를 사용하여 제목과 뱃지를 정렬합니다. */
  display: flex;
  flex-direction: column; /* 세로로 쌓음 */
  align-items: center;   /* 가운데 정렬 */
  gap: 8px;              /* 제목과 뱃지 사이 간격 */
}
.ranking-widget h3::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background-color: #3498db;
  border-radius: 2px;
}
.daily-badge {
  background-color: #3498db;
  color: white;
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 0.7em;
  /* [핵심 수정] 위치 관련 속성 제거 (flexbox가 처리) */
  /* margin-left: 8px; */
  /* vertical-align: middle; */
}

/* --- 이하 스타일은 기존과 동일 --- */
.loading-state, .no-data {
  flex-grow: 1; display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  font-style: italic; color: #7f8c8d; min-height: 150px;
}
.no-data i { font-size: 2em; color: #bdc3c7; margin-bottom: 10px; }
.no-data p { margin: 5px 0; font-size: 1.1em; }
.no-data small { font-size: 0.9em; color: #95a5a6; }
.spinner-small {
  border: 3px solid rgba(52, 152, 219, 0.2);
  border-top-color: #3498db;
  border-radius: 50%;
  width: 30px; height: 30px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.rank-item {
  display: flex; align-items: center; background: #f8f9fa; padding: 12px 15px;
  border-radius: 10px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease; overflow: hidden; position: relative; border: 1px solid #e0e6ed;
}
.rank-item:hover { transform: translateX(5px); box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08); background: #e9f0f7; }
.rank-badge {
  width: 35px; height: 35px; display: flex; justify-content: center;
  align-items: center; font-weight: bold; font-size: 1.2em;
  color: #7f8c8d; background-color: #ecf0f1; border-radius: 50%;
  margin-right: 15px; flex-shrink: 0; position: relative;
  z-index: 2; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}
.rank-badge .fas { font-size: 1.4em; }
.rank-1 .rank-badge {
  background: linear-gradient(45deg, #FFD700, #FFC72C);
  color: #8B4513; box-shadow: 0 0 15px rgba(255, 215, 0, 0.7);
  animation: pulse 1.5s infinite alternate; border: 2px solid #FFD700;
}
.gold-crown { color: #8B4513 !important; }
.rank-2 .rank-badge {
  background: linear-gradient(45deg, #C0C0C0, #A8A8A8);
  color: #34495e; box-shadow: 0 0 10px rgba(192, 192, 192, 0.5);
  border: 2px solid #C0C0C0;
}
.silver-medal { color: #34495e !important; }
.rank-3 .rank-badge {
  background: linear-gradient(45deg, #CD7F32, #B87333);
  color: #7f8c8d; box-shadow: 0 0 8px rgba(205, 127, 50, 0.4);
  border: 2px solid #CD7F32;
}
.bronze-award { color: #7f8c8d !important; }
.rank-1::before, .rank-2::before, .rank-3::before {
  content: ''; position: absolute; top: 0; left: 0;
  width: 100%; height: 100%; background: rgba(255,255,255,0.1);
  transform: translateX(-100%); animation: shine 3s infinite; z-index: 1;
}
@keyframes shine {
  0% { transform: translateX(-100%) skewX(-30deg); }
  60% { transform: translateX(100%) skewX(-30deg); }
  100% { transform: translateX(100%) skewX(-30deg); }
}
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 15px rgba(255, 215, 0, 0.7); }
  100% { transform: scale(1.05); box-shadow: 0 0 25px rgba(255, 215, 0, 0.9); }
}
.player-info { flex-grow: 1; display: flex; justify-content: space-between; align-items: center; }
.player-name {
  font-weight: 600; color: #34495e; font-size: 1.05em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.player-score {
  font-weight: bold; color: #2980b9; font-size: 1.1em;
  margin-left: 10px; flex-shrink: 0;
}
</style>
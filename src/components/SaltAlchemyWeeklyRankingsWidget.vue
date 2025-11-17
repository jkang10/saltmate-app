<template>
  <div class="rank-card alchemy-rank-card">
    <div class="rank-header">
      <h3><i class="fas fa-flask"></i> 솔트 알케미 주간 랭킹</h3>
      <span>(지난주 TOP 7)</span>
    </div>
    
    <div v-if="loading" class="loading-spinner-container">
      <div class="loading-spinner"></div>
    </div>
    
    <ul v-else-if="rankings.length > 0" class="rank-list">
      <li v-for="(user, index) in rankings" :key="user.id" class="rank-item" :class="getRankClass(index)">
        <span class="rank-number">{{ user.rank }}</span>
        <span class="rank-name">
          <i v-if="user.rank === 1" class="fas fa-crown"></i>
          <i v-else-if="user.rank === 2" class="fas fa-medal silver"></i>
          <i v-else-if="user.rank === 3" class="fas fa-medal bronze"></i>
          {{ user.userName || '익명' }}
        </span>
        <span class="rank-score">{{ user.score.toLocaleString() }} 점</span>
      </li>
    </ul>

    <div v-else class="no-data">
      <i class="fas fa-ghost"></i>
      <p>지난주 랭킹 데이터가 집계 중이거나 없습니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const rankings = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    // 1. 지난주 ID 계산 (KST 기준)
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    const lastWeekId = lastMonday.toISOString().slice(0, 10);
    
    // 2. 백엔드가 집계한 '주간 랭킹' 경로를 쿼리
    const q = query(
      collection(db, `leaderboards/alchemy_weekly_winners/${lastWeekId}`), 
      orderBy('rank', 'asc'), // 랭킹 순으로 정렬
      limit(7)
    );

    const snapshot = await getDocs(q);
    rankings.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    loading.value = false;
  } catch (error) {
    console.error("솔트 알케미 주간 랭킹 로딩 실패:", error);
    loading.value = false;
  }
});

// 순위별 CSS 클래스를 반환하는 함수
const getRankClass = (index) => {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return '';
};
</script>

<style scoped>
/* (이 스타일은 'SaltAlchemyRankingsWidget'와 동일합니다) */
.rank-card {
  background: rgba(44, 62, 80, 0.7);
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  color: #ecf0f1;
  text-align: center;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.alchemy-rank-card {
  background: linear-gradient(145deg, #4a0e97, #2c3e50);
  border-color: #9b59b6;
  box-shadow: 0 0 20px rgba(155, 89, 182, 0.5);
}

.rank-header {
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 10px;
}
.rank-header h3 {
  margin: 0;
  font-size: 1.4rem;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.rank-header h3 .fa-flask {
  color: #f1c40f;
  text-shadow: 0 0 8px #f1c40f;
}
.rank-header span {
  font-size: 0.9rem;
  color: #bdc3c7;
}

.loading-spinner-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
  min-height: 150px;
}
.loading-spinner {
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top: 4px solid #9b59b6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.rank-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex-grow: 1;
  
  /* ▼▼▼ [★핵심 수정★] 아래 2줄을 삭제하거나 주석 처리합니다. ▼▼▼ */
  /* overflow-y: auto; */
  /* max-height: 300px; */
  /* ▲▲▲ (수정 완료) ▲▲▲ */
}
.rank-item {
  display: grid;
  grid-template-columns: 40px 1fr 100px;
  align-items: center;
  padding: 10px 5px;
  border-radius: 8px;
  transition: background-color 0.3s ease;
}
.rank-item:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.rank-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.rank-number {
  font-size: 1.1rem;
  font-weight: bold;
  color: #bdc3c7;
}
.rank-name {
  text-align: left;
  font-size: 1rem;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rank-score {
  text-align: right;
  font-size: 1.1rem;
  font-weight: 700;
  color: #f1c40f;
}

.rank-item.gold .rank-name,
.rank-item.gold .fa-crown {
  color: #ffd700;
  text-shadow: 0 0 5px #ffd700;
}
.rank-item.silver .rank-name,
.rank-item.silver .fa-medal.silver {
  color: #c0c0c0;
  text-shadow: 0 0 5px #c0c0c0;
}
.rank-item.bronze .rank-name,
.rank-item.bronze .fa-medal.bronze {
  color: #cd7f32;
  text-shadow: 0 0 5px #cd7f32;
}

.no-data {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
  min-height: 150px;
  color: #bdc3c7;
  opacity: 0.7;
}
.no-data .fa-ghost {
  font-size: 3rem;
  margin-bottom: 10px;
}
</style>
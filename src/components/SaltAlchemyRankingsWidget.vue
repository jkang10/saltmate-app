<template>
  <div class="rank-card alchemy-rank-card">
    <div class="rank-header">
      <h3><i class="fas fa-flask"></i> 솔트 알케미 랭킹</h3>
      <span>(최고 점수)</span>
    </div>
    
    <div v-if="loading" class="loading-spinner-container">
      <div class="loading-spinner"></div>
    </div>
    
    <ul v-else-if="rankings.length > 0" class="rank-list">
      <li v-for="(user, index) in rankings" :key="user.id" class="rank-item" :class="getRankClass(index)">
        <span class="rank-number">{{ index + 1 }}</span>
        <span class="rank-name">
          <i v-if="index === 0" class="fas fa-crown"></i>
          <i v-else-if="index === 1" class="fas fa-medal silver"></i>
          <i v-else-if="index === 2" class="fas fa-medal bronze"></i>
          {{ user.name || '익명' }}
        </span>
        <span class="rank-score">{{ user.alchemyHighScore.toLocaleString() }} 점</span>
      </li>
    </ul>

    <div v-else class="no-data">
      <i class="fas fa-ghost"></i>
      <p>아직 랭킹 데이터가 없습니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const rankings = ref([]);
const loading = ref(true);
let unsubscribe = null;

onMounted(() => {
  // 'users' 컬렉션에서 'alchemyHighScore' 필드를 기준으로 내림차순 정렬하여 상위 10명을 가져옵니다.
  // 'alchemyHighScore' 필드가 users 문서에 저장되어 있어야 합니다.
  const q = query(
    collection(db, 'users'), 
    orderBy('alchemyHighScore', 'desc'), 
    limit(10)
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    rankings.value = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      alchemyHighScore: doc.data().alchemyHighScore || 0
    })).filter(user => user.alchemyHighScore > 0); // 점수가 0점 초과인 유저만 표시
    loading.value = false;
  }, (error) => {
    console.error("솔트 알케미 랭킹 로딩 실패:", error);
    loading.value = false;
  });
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
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
/* 기본 랭킹 카드 스타일 (기존 위젯과 유사) */
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

/* ▼▼▼ [★핵심 추가★] 알케미 랭킹 전용 스타일 ▼▼▼ */
.alchemy-rank-card {
  background: linear-gradient(145deg, #4a0e97, #2c3e50); /* 어두운 보라색 -> 남색 */
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
  color: #f1c40f; /* 연금술 아이콘은 금색 */
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
  border-top: 4px solid #9b59b6; /* 보라색 스피너 */
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
  overflow-y: auto; /* 내용이 많아지면 스크롤 */
  max-height: 300px; /* 최대 높이 제한 */
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

/* 상위 랭킹 스타일 */
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
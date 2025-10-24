<template>
  <div class="ranking-widget-container click-king-widget card">
    <div class="widget-header">
      <i class="fas fa-bolt header-icon"></i>
      <h3 class="widget-title">광클의 제왕</h3>
      <p class="widget-subtitle">가장 빠른 손가락을 가진 전설들</p>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner-small-light"></div>
      <p>랭킹 정보를 불러오는 중...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p><i class="fas fa-exclamation-triangle"></i> {{ error }}</p>
    </div>

    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li v-for="(ranker, index) in limitedRankings" :key="ranker.userId" :class="['ranking-item', `rank-${index + 1}`]">
        <div class="rank-indicator">
          <template v-if="index === 0">
            <i class="fas fa-crown crown-icon"></i>
          </template>
          <template v-else-if="index === 1">
            <i class="fas fa-medal silver-medal"></i>
          </template>
          <template v-else-if="index === 2">
            <i class="fas fa-medal bronze-medal"></i>
          </template>
          <template v-else>
            <span class="rank-number">{{ index + 1 }}</span>
          </template>
        </div>
        <span class="ranker-name">{{ ranker.userName }}</span>
        <span class="ranker-score">{{ ranker.clicks.toLocaleString() }} 클릭</span>
      </li>
    </ul>

    <div v-else class="no-data">
      <p><i class="fas fa-info-circle"></i> 아직 랭킹 정보가 없습니다.</p>
    </div>

    <div class="widget-footer">
      <router-link to="/rankings/saltmine-click" class="more-link">
        전체 랭킹 보기 <i class="fas fa-arrow-right"></i>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebaseConfig'; // Firebase db 인스턴스 import

const rankings = ref([]);
const isLoading = ref(true);
const error = ref(null);
let unsubscribe = null;

// 표시할 랭킹 아이템 수 (절반 정도로 줄이기 위해 4개로 설정)
const DISPLAY_LIMIT = 4;

const limitedRankings = computed(() => {
  return rankings.value.slice(0, DISPLAY_LIMIT);
});

onMounted(() => {
  const rankingsRef = collection(db, 'saltMineClickRankings'); // 실제 컬렉션 이름으로 변경
  const q = query(rankingsRef, orderBy('clicks', 'desc'), limit(7)); // 총 7개 가져와서 내부에서 4개만 표시

  unsubscribe = onSnapshot(q, (snapshot) => {
    const fetchedRankings = [];
    snapshot.forEach((doc) => {
      fetchedRankings.push({ id: doc.id, ...doc.data() });
    });
    rankings.value = fetchedRankings;
    isLoading.value = false;
    error.value = null;
  }, (err) => {
    console.error("광클 랭킹 불러오기 실패:", err);
    error.value = "랭킹 정보를 불러오지 못했습니다.";
    isLoading.value = false;
  });
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<style scoped>
/* 전체 위젯 컨테이너 */
.ranking-widget-container {
  background: linear-gradient(135deg, #2c3e50, #34495e); /* 어두운 그라데이션 배경 */
  color: #ecf0f1; /* 밝은 텍스트 색상 */
  padding: 0; /* 내부에서 패딩 처리 */
  border-radius: 12px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  overflow: hidden; /* 내부 요소가 넘치지 않도록 */
  max-height: 320px; /* 세로 길이 절반 정도로 줄이기 */
  display: flex;
  flex-direction: column;
}

/* 위젯 헤더 (타이틀/서브타이틀) */
.widget-header {
  text-align: center;
  padding: 20px 20px 15px; /* 상단 패딩 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.header-icon {
  font-size: 2.2em;
  color: #f1c40f; /* 번개 아이콘 색상 */
  margin-bottom: 8px;
}
.widget-title {
  font-size: 1.6em;
  font-weight: 700;
  margin: 0;
  color: #f1c40f; /* 제목 색상 강조 */
}
.widget-subtitle {
  font-size: 0.9em;
  color: #bdc3c7;
  margin-top: 5px;
  margin-bottom: 0;
}

/* 랭킹 리스트 */
.ranking-list {
  list-style: none;
  padding: 10px 20px; /* 좌우 패딩 유지, 상하 패딩 조정 */
  margin: 0;
  flex-grow: 1; /* 남은 공간 차지 */
  overflow-y: auto; /* 내용이 넘칠 경우 스크롤 */
  -webkit-overflow-scrolling: touch; /* iOS 스크롤 부드럽게 */
}
/* 스크롤바 스타일링 (선택적) */
.ranking-list::-webkit-scrollbar { width: 4px; }
.ranking-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
.ranking-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.ranking-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }


.ranking-item {
  display: flex;
  align-items: center;
  padding: 10px 0; /* 상하 패딩 줄이기 */
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08); /* 점선 구분선 */
  font-size: 1em;
}
.ranking-item:last-child {
  border-bottom: none; /* 마지막 아이템은 구분선 없음 */
}

.rank-indicator {
  width: 30px; /* 랭크 표시 공간 고정 */
  text-align: center;
  flex-shrink: 0;
}
.rank-number {
  font-size: 0.9em;
  font-weight: 600;
  color: #bdc3c7;
}

/* 아이콘 랭크 (1~3위) */
.crown-icon {
  color: #f1c40f; /* 금색 */
  font-size: 1.3em;
}
.silver-medal {
  color: #b3c3c6; /* 은색 */
  font-size: 1.2em;
}
.bronze-medal {
  color: #cd7f32; /* 동색 */
  font-size: 1.2em;
}

.ranker-name {
  flex-grow: 1; /* 이름이 남은 공간 차지 */
  font-weight: 500;
  color: #ecf0f1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 10px;
}
.ranker-score {
  font-weight: 700;
  color: #f39c12; /* 점수 색상 강조 */
  font-size: 1.1em;
  flex-shrink: 0;
}

/* 로딩 및 에러 상태 */
.loading-state, .error-state, .no-data {
  text-align: center;
  padding: 20px;
  font-size: 0.95em;
  color: #bdc3c7;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.spinner-small-light { /* 기존 스피너 스타일 */
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}
.error-state i, .no-data i {
    margin-right: 8px;
    color: #e74c3c;
}

/* 위젯 푸터 (전체 랭킹 보기 링크) */
.widget-footer {
  padding: 15px 20px;
  text-align: center;
  background-color: rgba(0, 0, 0, 0.1); /* 약간 어두운 배경 */
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.more-link {
  color: #3498db; /* 밝은 파랑 링크 */
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95em;
  transition: color 0.2s;
}
.more-link:hover {
  color: #5dade2;
}
.more-link i {
    margin-left: 5px;
    font-size: 0.8em;
}

/* 애니메이션 */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
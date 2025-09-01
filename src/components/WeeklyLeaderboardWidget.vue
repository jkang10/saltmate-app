<template>
  <div class="weekly-top7-widget card">
    <div class="widget-header">
      <i class="fas fa-trophy trophy-icon"></i>
      <h3>주간 TOP 7</h3>
      <p class="subtitle">지난 주 SaltMate 획득 랭킹</p>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>랭킹을 불러오는 중...</p>
    </div>

    <div v-else-if="topWinners.length > 0" class="winners-list">
      <transition-group name="flip-list" tag="ul">
	<li v-for="winner in topWinners" :key="winner.id" :class="['winner-item', `rank-${winner.rank}`]">
	<div class="rank-badge">
            <template v-if="winner.rank === 1">
              <i class="fas fa-crown gold-crown"></i>
            </template>
            <template v-else-if="winner.rank === 2">
              <i class="fas fa-medal silver-medal"></i>
            </template>
            <template v-else-if="winner.rank === 3">
              <i class="fas fa-medal bronze-medal"></i>
            </template>
            <template v-else>
              {{ winner.rank }}
            </template>
          </div>
          <span class="winner-name">{{ winner.userName }}</span>
          <span class="winner-points">{{ winner.totalWinnings.toLocaleString() }} SaltMate</span>
          <div v-if="winner.rank <= 3" class="rank-effect"></div>
        </li>
      </transition-group>
    </div>

    <div v-else class="no-data">
      <i class="fas fa-sad-tear"></i>
      <p>지난 주 랭킹 데이터가 아직 없습니다.</p>
      <p class="small-text">매주 월요일 새로운 랭킹이 집계됩니다!</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const topWinners = ref([]);
const isLoading = ref(true);
let unsubscribe = null;

const getLastMondayDateString = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 일요일=0, 월요일=1, ...
  // 오늘이 월요일(1)이면 7일 전, 화요일(2)이면 8일 전 ... 일요일(0)이면 6일 전
  const diff = today.getDate() - dayOfWeek - (dayOfWeek === 0 ? -1 : 6);
  const lastMonday = new Date(today.setDate(diff));
  
  const year = lastMonday.getFullYear();
  const month = (lastMonday.getMonth() + 1).toString().padStart(2, '0');
  const day = lastMonday.getDate().toString().padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const fetchWeeklyWinners = async () => {
  isLoading.value = true;
  try {
    const weekId = getLastMondayDateString();
    const leaderboardRef = collection(db, 'leaderboards', 'weekly_winners', weekId);
    const q = query(leaderboardRef, orderBy('rank', 'asc'), limit(7));
    
    const querySnapshot = await getDocs(q);
    const winners = [];
    querySnapshot.forEach(doc => {
      winners.push({ id: doc.id, ...doc.data() });
    });
    topWinners.value = winners;

  } catch (error) {
    console.error("주간 TOP 7 랭킹 로딩 중 오류:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchWeeklyWinners();
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<style scoped>
.weekly-top7-widget {
  background: linear-gradient(135deg, #1a237e 0%, #303f9f 100%); /* Deep Blue Gradient */
  color: #e3f2fd;
  border-radius: 20px;
  padding: 25px 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  position: relative;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  transition: all 0.5s ease-in-out; /* 위젯 자체의 부드러운 전환 */
}

/* 위젯 호버 효과 추가 */
.weekly-top7-widget:hover {
  transform: translateY(-5px) scale(1.01);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
}

.widget-header {
  text-align: center;
  margin-bottom: 25px;
  position: relative;
}

.trophy-icon {
  font-size: 3.8em; /* 아이콘 크기 더 키움 */
  color: #ffc107; /* Gold color */
  margin-bottom: 10px;
  animation: glow 1.5s ease-in-out infinite alternate, bounceIn 1s ease-out; /* 빛나는 애니메이션 + 나타날 때 바운스 효과 */
  display: inline-block; /* 애니메이션 적용을 위해 */
}

@keyframes glow {
  from { text-shadow: 0 0 8px rgba(255, 193, 7, 0.7); }
  to { text-shadow: 0 0 20px rgba(255, 193, 7, 1), 0 0 30px rgba(255, 193, 7, 0.8); }
}

@keyframes bounceIn {
  0%, 20%, 40%, 60%, 80%, 100% {
    -webkit-transition-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
    transition-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
  }
  0% {
    opacity: 0;
    -webkit-transform: scale3d(.3, .3, .3);
    transform: scale3d(.3, .3, .3);
  }
  20% {
    -webkit-transform: scale3d(1.1, 1.1, 1.1);
    transform: scale3d(1.1, 1.1, 1.1);
  }
  40% {
    -webkit-transform: scale3d(.9, .9, .9);
    transform: scale3d(.9, .9, .9);
  }
  60% {
    opacity: 1;
    -webkit-transform: scale3d(1.03, 1.03, 1.03);
    transform: scale3d(1.03, 1.03, 1.03);
  }
  80% {
    -webkit-transform: scale3d(.97, .97, .97);
    transform: scale3d(.97, .97, .97);
  }
  100% {
    opacity: 1;
    -webkit-transform: scale3d(1, 1, 1);
    transform: scale3d(1, 1, 1);
  }
}

.widget-header h3 {
  font-size: 2.5em; /* 제목 크기 더 키움 */
  font-weight: 900; /* 더 굵게 */
  margin: 10px 0 5px;
  color: #ffffff;
  letter-spacing: 2px; /* 자간 넓힘 */
  text-transform: uppercase;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5); /* 그림자 강화 */
}

.subtitle {
  font-size: 1.2em; /* 부제목 크기 키움 */
  color: #bbdefb;
  margin-top: 8px;
  font-style: italic;
  font-weight: 300;
}

.loading-state, .no-data {
  text-align: center;
  padding: 40px 20px;
  font-size: 1.1em;
  color: #90caf9;
  min-height: 200px; /* 최소 높이 설정 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.loading-state .spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #ffeb3b;
  border-radius: 50%;
  width: 35px; /* 스피너 크기 키움 */
  height: 35px;
  animation: spin 1s linear infinite;
  margin: 0 auto 18px;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.no-data i {
    font-size: 2.8em; /* 아이콘 크기 키움 */
    margin-bottom: 18px;
    color: #e57373;
}
.no-data p {
    margin-bottom: 5px;
    font-size: 1.15em;
    font-weight: 500;
}
.no-data .small-text {
    font-size: 0.95em;
    margin-top: 8px;
    color: #a7d9ff;
}

.winners-list {
  margin-top: 25px;
}

.winners-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.winner-item {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15); /* 배경색 투명도 조정 */
  padding: 18px 25px; /* 패딩 증가 */
  margin-bottom: 15px; /* 간격 증가 */
  border-radius: 15px; /* 둥근 모서리 증가 */
  font-size: 1.2em; /* 폰트 크기 증가 */
  font-weight: 700; /* 더 굵게 */
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); /* 그림자 강화 */
  transition: all 0.4s ease-in-out;
  position: relative;
  overflow: hidden; /* 랭크 효과를 위해 */
  cursor: pointer; /* 호버 시 커서 변경 */
  color: #ffffff; /* 기본 텍스트 색상 */
  transform-style: preserve-3d; /* 3D 변환 유지 */
}

/* 랭크 아이템 호버 효과 */
.winner-item:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateX(5px) scale(1.02);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
}

.rank-badge {
  width: 40px; /* 뱃지 크기 키움 */
  height: 40px;
  min-width: 40px; /* flexbox에서 크기 고정 */
  min-height: 40px;
  background: linear-gradient(45deg, #00b0ff, #80d8ff); /* 밝은 파랑 그라데이션 */
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.2em; /* 랭크 숫자 크기 키움 */
  font-weight: 900;
  color: #1a237e; /* 뱃지 숫자 색상 */
  margin-right: 18px; /* 간격 증가 */
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.winner-item.rank-1 .rank-badge {
  background: linear-gradient(45deg, #FFD700, #FFEA00); /* 1위 골드 */
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.8), 0 0 25px rgba(255, 215, 0, 0.6);
}
.winner-item.rank-2 .rank-badge {
  background: linear-gradient(45deg, #C0C0C0, #E0E0E0); /* 2위 실버 */
  box-shadow: 0 0 10px rgba(192, 192, 192, 0.7);
}
.winner-item.rank-3 .rank-badge {
  background: linear-gradient(45deg, #CD7F32, #DAA520); /* 3위 브론즈 */
  box-shadow: 0 0 8px rgba(205, 127, 50, 0.7);
}

.rank-badge i {
  font-size: 1.6em; /* 왕관, 메달 아이콘 크기 키움 */
  line-height: 1; /* 아이콘 정렬 */
}
.gold-crown { color: #FFA726; } /* 더 밝은 골드 */
.silver-medal { color: #E0E0E0; }
.bronze-medal { color: #CD7F32; }

.winner-name {
  flex-grow: 1;
  text-align: left;
  color: #e3f2fd;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
}

.winner-points {
  font-size: 1.15em; /* 포인트 폰트 크기 증가 */
  color: #ffeb3b; /* 강조되는 노란색 */
  font-weight: 800;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.4);
  background: rgba(0,0,0,0.2);
  padding: 5px 10px;
  border-radius: 8px;
  margin-left: 15px;
}

/* 1~3위 랭크 아이템에 추가되는 반짝이 효과 */
.rank-effect {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: none; /* 기본 transition 무시 */
}

.winner-item.rank-1:hover .rank-effect,
.winner-item.rank-2:hover .rank-effect,
.winner-item.rank-3:hover .rank-effect {
  animation: shine 1.2s forwards;
}

@keyframes shine {
  0% { left: -100%; }
  100% { left: 100%; }
}


/* --- FLIP 애니메이션 (리스트 항목이 업데이트될 때 적용) --- */
.flip-list-move {
  transition: transform 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}
.flip-list-enter-active,
.flip-list-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}
.flip-list-enter-from,
.flip-list-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-30px);
}
.flip-list-leave-active {
  position: absolute; /* 사라지는 요소가 다른 요소에 영향을 주지 않도록 */
}

</style>
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
        <li v-for="winner in displayedWinners" :key="winner.userId" :class="['winner-item', `rank-${winner.rank}`]">
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
          <span class="winner-points">{{ winner.totalWinnings.toLocaleString() }}</span>
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
import { ref, onMounted, computed } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const topWinners = ref([]);
const isLoading = ref(true);

const getLastMondayDateString = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 일요일=0, 월요일=1, ...
  // 오늘이 월요일(1)이면 7일 전, 화요일(2)이면 8일 전 ... 일요일(0)이면 6일 전
  const diff = today.getDate() - dayOfWeek - (dayOfWeek === 0 ? -1 : 6); // 일요일은 6일 전, 월요일은 7일 전
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

// 상위 7명만 표시 (혹시 모를 더 많은 데이터가 있어도 잘림 방지)
const displayedWinners = computed(() => topWinners.value.slice(0, 7));


onMounted(() => {
  fetchWeeklyWinners();
});

</script>

<style scoped>
.weekly-top7-widget {
  background: linear-gradient(135deg, #1a237e 0%, #303f9f 100%); /* Deep Blue Gradient */
  color: #e3f2fd;
  border-radius: 20px;
  padding: 20px 20px; /* 패딩 감소로 길이 조절 */
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  position: relative;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  transition: all 0.5s ease-in-out;
  display: flex; /* 내부 요소 정렬을 위해 추가 */
  flex-direction: column; /* 세로 정렬 */
  justify-content: space-between; /* 상하 여백 배분 */
}

/* 위젯 호버 효과 추가 */
.weekly-top7-widget:hover {
  transform: translateY(-5px) scale(1.01);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
}

.widget-header {
  text-align: center;
  margin-bottom: 20px; /* 간격 감소 */
  position: relative;
}

.trophy-icon {
  font-size: 3em; /* 아이콘 크기 약간 감소 */
  color: #ffc107; /* Gold color */
  margin-bottom: 8px; /* 간격 감소 */
  animation: glow 1.5s ease-in-out infinite alternate, bounceIn 1s ease-out;
  display: inline-block;
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
  font-size: 2.2em; /* 제목 크기 약간 감소 */
  font-weight: 900;
  margin: 8px 0 4px; /* 간격 감소 */
  color: #ffffff;
  letter-spacing: 1px; /* 자간 감소 */
  text-transform: uppercase;
  text-shadow: 2px 2px 5px rgba(0, 0, 0, 0.4); /* 그림자 조정 */
}

.subtitle {
  font-size: 1em; /* 부제목 크기 감소 */
  color: #bbdefb;
  margin-top: 5px; /* 간격 감소 */
  font-style: italic;
  font-weight: 300;
}

.loading-state, .no-data {
  text-align: center;
  padding: 30px 10px; /* 패딩 감소 */
  font-size: 1em; /* 폰트 크기 감소 */
  color: #90caf9;
  min-height: 180px; /* 최소 높이 조정 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.loading-state .spinner {
  border: 3px solid rgba(255, 255, 255, 0.3); /* 스피너 두께 감소 */
  border-top: 3px solid #ffeb3b;
  width: 28px; /* 스피너 크기 감소 */
  height: 28px;
  margin: 0 auto 12px; /* 간격 감소 */
}
.no-data i {
    font-size: 2.2em; /* 아이콘 크기 감소 */
    margin-bottom: 12px; /* 간격 감소 */
    color: #e57373;
}
.no-data p {
    margin-bottom: 4px;
    font-size: 1em;
    font-weight: 500;
}
.no-data .small-text {
    font-size: 0.85em; /* 폰트 크기 감소 */
    margin-top: 6px;
    color: #a7d9ff;
}

.winners-list {
  margin-top: 15px; /* 간격 감소 */
  flex-grow: 1; /* 남은 공간을 채우도록 함 */
}

.winners-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.winner-item {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.1); /* 배경색 투명도 조정 */
  padding: 10px 12px; /* 패딩 감소 */
  margin-bottom: 8px; /* 간격 감소 */
  border-radius: 10px; /* 둥근 모서리 조정 */
  font-size: 1em; /* 폰트 크기 조정 */
  font-weight: 600;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); /* 그림자 조정 */
  transition: all 0.3s ease-in-out;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  color: #ffffff;
  /* height: 48px; /* 고정 높이 설정으로 길이 통일 (필요시 조정) */
}

/* 랭크 아이템 호버 효과 */
.winner-item:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(3px) scale(1.01);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
}

.rank-badge {
  width: 32px; /* 뱃지 크기 감소 */
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  background: linear-gradient(45deg, #00b0ff, #80d8ff);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1em; /* 랭크 숫자 크기 조정 */
  font-weight: 800;
  color: #1a237e;
  margin-right: 12px; /* 간격 감소 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.winner-item.rank-1 .rank-badge {
  background: linear-gradient(45deg, #FFD700, #FFEA00); /* 1위 골드 */
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
}
.winner-item.rank-2 .rank-badge {
  background: linear-gradient(45deg, #C0C0C0, #E0E0E0); /* 2위 실버 */
  box-shadow: 0 0 7px rgba(192, 192, 192, 0.5);
}
.winner-item.rank-3 .rank-badge {
  background: linear-gradient(45deg, #CD7F32, #DAA520); /* 3위 브론즈 */
  box-shadow: 0 0 6px rgba(205, 127, 50, 0.5);
}

.rank-badge i {
  font-size: 1.3em; /* 왕관, 메달 아이콘 크기 감소 */
  line-height: 1;
}
.gold-crown { color: #FFA726; }
.silver-medal { color: #E0E0E0; }
.bronze-medal { color: #CD7F32; }

.winner-name {
  flex-grow: 1;
  text-align: left;
  color: #ffffff; /* 글씨를 흰색으로 변경하여 시인성 개선 */
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5); /* 그림자 강화 */
  letter-spacing: 0.2px;
  white-space: nowrap; /* 이름이 길어도 줄바꿈되지 않도록 */
  overflow: hidden; /* 넘치는 부분 숨김 */
  text-overflow: ellipsis; /* 넘치면 ... 표시 */
}

.winner-points {
  font-size: 1.05em; /* 포인트 폰트 크기 조정 */
  color: #ffeb3b; /* 강조되는 노란색 유지 */
  font-weight: 700; /* 굵기 조정 */
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5); /* 그림자 강화 */
  background: rgba(0,0,0,0.3); /* 배경색 좀 더 진하게 */
  padding: 4px 8px; /* 패딩 조정 */
  border-radius: 6px; /* 둥근 모서리 조정 */
  margin-left: 12px; /* 간격 감소 */
  min-width: 90px; /* 최소 너비 설정으로 정렬 개선 */
  text-align: right; /* 숫자를 오른쪽 정렬 */
  white-space: nowrap; /* 줄바꿈 방지 */
}

/* 1~3위 랭크 아이템에 추가되는 반짝이 효과 (기존과 동일하게 유지) */
.rank-effect {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: none;
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
  position: absolute;
}
</style>
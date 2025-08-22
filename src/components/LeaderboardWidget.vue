<template>
  <div class="feature-card leaderboard">
    <div class="card-icon"><i class="fas fa-crown"></i></div>
    <h3>오늘의 TOP 5</h3>
    <ol class="leaderboard-list">
      <li
        v-for="(winner, index) in winners"
        :key="winner.id"
        class="leaderboard-item"
        :class="{ 'rank-1': index === 0 }"
      >
        <span class="rank">{{ index + 1 }}</span>
        <span class="name">{{ winner.userName }}</span>
        <span class="score"
          >{{ winner.totalWinnings.toLocaleString() }} SaltMate</span
        >
      </li>
    </ol>
    <span v-if="winners.length === 0" class="no-feed"
      >오늘의 랭킹이 아직 없습니다.</span
    >
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

const winners = ref([]);
let unsubscribe = null;

onMounted(() => {
  const today = new Date().toISOString().slice(0, 10);
  const q = query(
    collection(db, `leaderboards/daily_winners/${today}`),
    orderBy("totalWinnings", "desc"),
    limit(5),
  );

  unsubscribe = onSnapshot(q, (querySnapshot) => {
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    winners.value = items;
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.feature-card.leaderboard {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  overflow: hidden; /* [추가] 애니메이션이 카드 밖으로 나가지 않도록 설정 */
}
.card-icon {
  color: #ffd700;
}
h3 {
  color: white;
}
.leaderboard-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.leaderboard-item {
  display: flex;
  align-items: center;
  padding: 10px 15px; /* [수정] 여백 조정 */
  font-size: 1em;
  border-radius: 8px; /* [추가] 부드러운 모서리 */
  transition: all 0.3s ease; /* [추가] 부드러운 전환 효과 */
  margin: 5px 0; /* [추가] 항목 간 간격 */
}
.rank {
  font-weight: bold;
  width: 30px;
}
.name {
  flex-grow: 1;
}
.score {
  font-weight: bold;
}
.no-feed {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9em;
}

/* ▼▼▼ [신규 추가] 1등을 위한 화려한 이펙트 스타일 ▼▼▼ */
.leaderboard-item.rank-1 {
  background-size: 400% 400%;
  animation:
    rainbow-glow 5s ease infinite,
    float-effect 3s ease-in-out infinite;
  background-image: linear-gradient(
    -45deg,
    #ffd700,
    /* Gold */ #fca5f1,
    /* Pink */ #b3c7f0,
    /* Blue */ #a6e3e9 /* Cyan */
  );
  color: #333; /* 어두운 배경에서 잘 보이도록 글자색 변경 */
  font-weight: bold;
  transform: scale(1.05); /* 살짝 크게 표시 */
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
}

/* 무지개 배경 애니메이션 */
@keyframes rainbow-glow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* 위아래로 떠다니는 애니메이션 */
@keyframes float-effect {
  0% {
    transform: translatey(0px) scale(1.05);
  }
  50% {
    transform: translatey(-5px) scale(1.05);
  }
  100% {
    transform: translatey(0px) scale(1.05);
  }
}
/* ▲▲▲ 신규 추가 완료 ▲▲▲ */
</style>

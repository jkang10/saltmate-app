<template>
  <div class="token-mine-card" :class="{ 'mining-active': isMining }" @click="goToTokenMinePage">
    <div class="card-icon">
      <i v-if="!isMining" class="fas fa-pickaxe"></i> <i v-else class="fas fa-gem animated-shine"></i> </div>
    <div class="card-content">
      <h3 class="card-title">나의 소금 토큰 광산</h3>
      <p class="card-description">
        {{ cardMessage }}
      </p>
    </div>
    <div class="card-action">
      <button class="btn-mine-action">
        {{ actionButtonText }} <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebaseConfig'; // firebaseConfig.js 임포트
import { doc, onSnapshot } from 'firebase/firestore';

export default {
  name: 'TokenMineCard',
  setup() {
    const router = useRouter();
    const mineState = ref({ startTime: null, nextClaimTime: null });
    const isLoading = ref(true);
    const now = ref(new Date());

    let mineUnsubscribe = null;
    let timerInterval = null;

    onMounted(() => {
      const user = auth.currentUser;
      if (user) {
        const mineRef = doc(db, 'users', user.uid, 'gamedata', 'tokenMine');
        mineUnsubscribe = onSnapshot(mineRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            mineState.value.startTime = data.startTime?.toDate();
            mineState.value.nextClaimTime = data.nextClaimTime?.toDate();
          } else {
            mineState.value.startTime = null;
            mineState.value.nextClaimTime = null;
          }
          isLoading.value = false;
        });
      } else {
        isLoading.value = false;
      }

      timerInterval = setInterval(() => {
        now.value = new Date();
      }, 1000);
    });

    onUnmounted(() => {
      if (mineUnsubscribe) mineUnsubscribe();
      if (timerInterval) clearInterval(timerInterval);
    });

    const isMining = computed(() => {
      return mineState.value.nextClaimTime && mineState.value.nextClaimTime > now.value;
    });

    const canClaim = computed(() => {
      return mineState.value.nextClaimTime && mineState.value.nextClaimTime <= now.value;
    });

    const cardMessage = computed(() => {
      if (isLoading.value) return '광산 상태를 불러오는 중...';
      if (!auth.currentUser) return '로그인 후 나의 광산을 확인하세요.';
      if (canClaim.value) return '채굴 완료! 보상을 수령할 준비가 되었습니다.';
      if (isMining.value) {
        const diff = mineState.value.nextClaimTime.getTime() - now.value.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        return `채굴 진행 중... ${days}일 ${hours}시간 남음`;
      }
      return '일주일에 한 번 광부에게 작업을 지시하여 토큰을 채굴하세요.';
    });

    const actionButtonText = computed(() => {
      if (!auth.currentUser) return '로그인';
      if (canClaim.value) return '보상 수령하기';
      if (isMining.value) return '채굴 현황 보기';
      return '채굴 시작하기';
    });

    const goToTokenMinePage = () => {
      if (auth.currentUser) {
        router.push('/token-mine');
      } else {
        router.push('/login'); // 로그인 페이지로 리디렉션
      }
    };

    return {
      isMining,
      cardMessage,
      actionButtonText,
      goToTokenMinePage,
    };
  },
};
</script>

<style scoped>
/* 솔레인 디지털 유토피아 카드와 유사한 스타일을 바탕으로 소금 광산 테마에 맞게 조정 */
.token-mine-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: linear-gradient(135deg, #4b0082, #8a2be2); /* 보라색 계열 그라데이션 */
  color: #fff;
  border-radius: 15px;
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 220px; /* 카드 최소 높이 */
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden; /* 아이콘 애니메이션을 위한 오버플로우 숨김 */
}

.token-mine-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.3);
}

.card-icon {
  font-size: 3.5rem; /* 아이콘 크기 */
  margin-bottom: 1rem;
  align-self: flex-start; /* 왼쪽 상단 정렬 */
  opacity: 0.8;
  position: relative;
}

/* 광산 테마 아이콘: FontAwesome 사용 */
.fa-pickaxe { /* 곡괭이 아이콘 */
  color: #c0c0c0; /* 은색 */
}
.fa-gem { /* 보석 아이콘 */
  color: #ffdd00; /* 황금색 */
}

.animated-shine {
  animation: shine 1.5s infinite alternate; /* 반짝이는 애니메이션 */
}

@keyframes shine {
  0% { text-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
  50% { text-shadow: 0 0 15px rgba(255, 255, 255, 0.7); }
  100% { text-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
}

.card-content {
  flex-grow: 1; /* 컨텐츠가 공간을 채우도록 */
  text-align: left;
  margin-top: 1rem;
}

.card-title {
  font-size: 1.8rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
  line-height: 1.3;
}

.card-description {
  font-size: 1rem;
  line-height: 1.5;
  opacity: 0.9;
}

.card-action {
  margin-top: 1.5rem;
  align-self: flex-end; /* 오른쪽 하단 정렬 */
}

.btn-mine-action {
  background-color: rgba(255, 255, 255, 0.2); /* 반투명 흰색 */
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  padding: 0.8rem 1.5rem;
  border-radius: 50px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease;
  display: flex;
  align-items: center;
}

.btn-mine-action:hover {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
}

.btn-mine-action i {
  margin-left: 0.8rem;
  font-size: 0.9rem;
}

/* 채굴 활성화 상태일 때 카드 배경색 변화 */
.token-mine-card.mining-active {
  background: linear-gradient(135deg, #2c3e50, #34495e); /* 좀 더 깊은 푸른빛/회색 그라데이션 (광산 내부 느낌) */
  /* 또는, 좀 더 희망찬 느낌을 원한다면: */
  /* background: linear-gradient(135deg, #007bff, #00c6ff); */
}


/* 추가: Font Awesome 아이콘 사용을 위해 index.html에 CDN 추가 필요 */
/* <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"> */
</style>
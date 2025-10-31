<template>
  <div class="token-mine-card" :class="{ 'mining-active': isAutoMining }" @click="goToTokenMinePage">
    <div class="card-icon">
      <i v-if="!isAutoMining" class="fas fa-pickaxe"></i>
      <i v-else class="fas fa-gem animated-shine"></i>
    </div>
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
import { db, auth } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';

export default {
  name: 'TokenMineCard',
  setup() {
    const router = useRouter();
    // [★수정★] 자동 채굴 상태를 저장할 ref
    const autoMineFuel = ref(0);
    const isLoading = ref(true);

    let mineUnsubscribe = null;

    onMounted(() => {
      const user = auth.currentUser;
      if (user) {
        // [★수정★] gamedata/tokenMine 문서만 감지
        const mineRef = doc(db, 'users', user.uid, 'gamedata', 'tokenMine');
        mineUnsubscribe = onSnapshot(mineRef, (docSnap) => {
          if (docSnap.exists()) {
            autoMineFuel.value = docSnap.data().autoMineFuel || 0;
          } else {
            autoMineFuel.value = 0;
          }
          isLoading.value = false;
        });
      } else {
        isLoading.value = false;
      }
    });

    onUnmounted(() => {
      if (mineUnsubscribe) mineUnsubscribe();
    });

    // [★수정★] 자동 채굴 여부 판단
    const isAutoMining = computed(() => {
      return autoMineFuel.value > 0;
    });

    // [★수정★] 자동 채굴 상태에 맞게 메시지 변경
    const cardMessage = computed(() => {
      if (isLoading.value) return '광산 상태를 불러오는 중...';
      if (!auth.currentUser) return '로그인 후 나의 광산을 확인하세요.';
      if (isAutoMining.value) {
        return `자동 채굴 진행 중... (현재 연료: ${autoMineFuel.value.toFixed(0)} P)`;
      }
      return '자동 채굴기 비활성. 연료를 충전해주세요.';
    });

    // [★수정★] 자동 채굴 상태에 맞게 버튼 텍스트 변경
    const actionButtonText = computed(() => {
      if (!auth.currentUser) return '로그인';
      if (isAutoMining.value) return '채굴 현황 보기';
      return '연료 충전하기';
    });

    const goToTokenMinePage = () => {
      if (auth.currentUser) {
        router.push('/token-mine');
      } else {
        router.push('/login');
      }
    };

    return {
      isAutoMining, // 이름 변경 (isMining -> isAutoMining)
      cardMessage,
      actionButtonText,
      goToTokenMinePage,
    };
  },
};
</script>

<style scoped>
/* 기존 스타일은 제공된 TokenMineCard.vue의 것을 그대로 사용합니다. */
/* (이전 답변에서 padding, margin 수정된 버전) */
.token-mine-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: linear-gradient(135deg, #4b0082, #8a2be2);
  color: #fff;
  border-radius: 15px;
  padding: 30px;
  margin-bottom: 0;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 220px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  position: relative;
  overflow: hidden;
}

.token-mine-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.3);
}

.card-icon {
  font-size: 3.5rem;
  margin-bottom: 1rem;
  align-self: flex-start;
  opacity: 0.8;
  position: relative;
}

.fa-pickaxe { color: #c0c0c0; }
.fa-gem { color: #ffdd00; }

.animated-shine { animation: shine 1.5s infinite alternate; }

@keyframes shine {
  0% { text-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
  50% { text-shadow: 0 0 15px rgba(255, 255, 255, 0.7); }
  100% { text-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
}

.card-content { flex-grow: 1; text-align: left; margin-top: 1rem; }
.card-title { font-size: 1.8rem; font-weight: bold; margin-bottom: 0.5rem; line-height: 1.3; }
.card-description { font-size: 1rem; line-height: 1.5; opacity: 0.9; }
.card-action { margin-top: 1.5rem; align-self: flex-end; }

.btn-mine-action {
  background-color: rgba(255, 255, 255, 0.2);
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

.btn-mine-action i { margin-left: 0.8rem; font-size: 0.9rem; }

/* [★수정★] 자동 채굴 활성화 시 카드 배경색 (이전과 동일하지만 의미가 바뀜) */
.token-mine-card.mining-active {
  background: linear-gradient(135deg, #2c3e50, #34495e);
}
</style>
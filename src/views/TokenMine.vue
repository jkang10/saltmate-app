<template>
  <div class="token-mine-container">
    <div class="mine-header">
      <h2>나의 소금 토큰 광산</h2>
      <p>일주일에 한 번 광부에게 작업 지시를 내려 토큰을 채굴하세요!</p>
    </div>

    <div class="token-balance card">
      <h3>나의 토큰 금고</h3>
      <div class="balance-grid">
        <div class="balance-item">
          <span class="token-name">COBS</span>
          <span class="token-amount">{{ formatNumber(myTokens.cobs) }}</span>
        </div>
        <div class="balance-item">
          <span class="token-name">BND</span>
          <span class="token-amount">{{ formatNumber(myTokens.bnd) }}</span>
        </div>
      </div>
      <small>(이 토큰은 Saltmate 금고에 보관되며, '출금' 메뉴에서 개인 지갑으로 전송할 수 있습니다.)</small>
    </div>

    <div class="mine-status card">
      <div v-if="isLoading" class="loading-spinner"></div>
      
      <div v-else-if="canClaim" class="mine-action">
        <i class="fas fa-gem icon-success"></i>
        <h3>채굴 완료!</h3>
        <p>광부들이 일주일간의 작업을 마쳤습니다. 보상을 수령하세요.</p>
        <button @click="claimReward" :disabled="isProcessing" class="btn btn-claim">
          <span v-if="!isProcessing">보상 받기 (BND +2)</span>
          <span v-else>처리 중...</span>
        </button>
      </div>
      
      <div v-else-if="isMining" class="mine-progress">
        <i class="fas fa-hourglass-half icon-progress"></i>
        <h3>채굴 진행 중...</h3>
        <p>다음 보상까지 남은 시간:</p>
        <div class="countdown">{{ countdown }}</div>
        <button class="btn btn-disabled" disabled>일주일 뒤 방문해주세요</button>
      </div>

      <div v-else class="mine-action">
        <i class="fas fa-play-circle icon-start"></i>
        <h3>광산이 쉬고 있습니다</h3>
        <p>광부들에게 주간 작업을 지시하여 BND 토큰 채굴을 시작하세요.</p>
        <button @click="startMining" :disabled="isProcessing" class="btn btn-start">
          <span v-if="!isProcessing">주간 채굴 시작하기</span>
          <span v-else>처리 중...</span>
        </button>
      </div>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { db, auth, functions } from '@/firebaseConfig'; // firebaseConfig.js 임포트
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export default {
  name: 'TokenMine',
  setup() {
    const myTokens = reactive({ cobs: 0, bnd: 0 });
    const mineState = reactive({ startTime: null, nextClaimTime: null });
    const isLoading = ref(true);
    const isProcessing = ref(false);
    const errorMessage = ref(null);
    const now = ref(new Date());

    let userUnsubscribe = null;
    let mineUnsubscribe = null;
    let timerInterval = null;

    const startMiningFunc = httpsCallable(functions, 'startWeeklyTokenMine');
    const claimRewardFunc = httpsCallable(functions, 'claimWeeklyTokenMine');

    // 유저 정보(토큰) 실시간 감지
    const setupListeners = (uid) => {
      const userRef = doc(db, 'users', uid);
      userUnsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const tokens = docSnap.data().tokens || { bnd: 0, cobs: 0 };
          myTokens.bnd = tokens.bnd;
          myTokens.cobs = tokens.cobs;
        }
      });

      // gamedata/tokenMine 문서 실시간 감지
      const mineRef = doc(db, 'users', uid, 'gamedata', 'tokenMine');
      mineUnsubscribe = onSnapshot(mineRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          mineState.startTime = data.startTime?.toDate();
          mineState.nextClaimTime = data.nextClaimTime?.toDate();
        } else {
          mineState.startTime = null;
          mineState.nextClaimTime = null;
        }
        isLoading.value = false;
      });
    };

    onMounted(() => {
      const user = auth.currentUser;
      if (user) {
        setupListeners(user.uid);
      } else {
        // 로그인 안된 경우 처리 (선택적)
        isLoading.value = false;
        errorMessage.value = "로그인이 필요합니다.";
      }
      
      // 1초마다 현재 시간 갱신 (카운트다운용)
      timerInterval = setInterval(() => {
        now.value = new Date();
      }, 1000);
    });

    onUnmounted(() => {
      if (userUnsubscribe) userUnsubscribe();
      if (mineUnsubscribe) mineUnsubscribe();
      if (timerInterval) clearInterval(timerInterval);
    });

    // 채굴 중인지 계산
    const isMining = computed(() => {
      return mineState.nextClaimTime && mineState.nextClaimTime > now.value;
    });

    // 보상 수령 가능한지 계산
    const canClaim = computed(() => {
      return mineState.nextClaimTime && mineState.nextClaimTime <= now.value;
    });

    // 남은 시간 카운트다운
    const countdown = computed(() => {
      if (!isMining.value) return '00:00:00';
      const diff = mineState.nextClaimTime.getTime() - now.value.getTime();
      if (diff <= 0) return '00:00:00';
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      
      return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
    });

    // 채굴 시작 버튼 클릭
    const startMining = async () => {
      isProcessing.value = true;
      errorMessage.value = null;
      try {
        await startMiningFunc();
        // 성공 (리스너가 자동으로 상태 갱신)
      } catch (error) {
        errorMessage.value = error.message;
      } finally {
        isProcessing.value = false;
      }
    };

    // 보상 받기 버튼 클릭
    const claimReward = async () => {
      isProcessing.value = true;
      errorMessage.value = null;
      try {
        const result = await claimRewardFunc();
        const reward = result.data.reward;
        alert(`보상 수령 완료! BND +${reward.bnd}`);
        // 성공 (리스너가 자동으로 상태 갱신)
      } catch (error) {
        errorMessage.value = error.message;
      } finally {
        isProcessing.value = false;
      }
    };

    const formatNumber = (num) => {
      if (num == null) return 0;
      return num.toLocaleString();
    }

    return {
      myTokens,
      mineState,
      isLoading,
      isProcessing,
      errorMessage,
      isMining,
      canClaim,
      countdown,
      startMining,
      claimReward,
      formatNumber
    };
  }
}
</script>

<style scoped>
/* salt-mine-game.css 등 기존 소스 코드의 스타일을 재사용하거나 새로 추가 */
.token-mine-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 1.5rem;
}
.mine-header { text-align: center; margin-bottom: 2rem; }
.mine-header h2 { font-size: 2.5rem; color: #333; }
.card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  padding: 1.5rem 2rem;
  margin-bottom: 1.5rem;
}
.token-balance h3 { border-bottom: 1px solid #eee; padding-bottom: 0.5rem; margin-top: 0; }
.balance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.balance-item { text-align: center; background: #f9f9f9; padding: 1rem; border-radius: 8px; }
.token-name { display: block; font-weight: bold; color: #007bff; }
.token-amount { display: block; font-size: 2rem; font-weight: bold; color: #333; margin-top: 0.5rem; }
.mine-status { text-align: center; }
.mine-action, .mine-progress { padding: 1.5rem 0; }
.icon-success { color: #28a745; font-size: 4rem; }
.icon-progress { color: #ffc107; font-size: 4rem; animation: spin 2s linear infinite; }
.icon-start { color: #007bff; font-size: 4rem; }
.countdown { font-size: 1.8rem; font-weight: bold; color: #333; margin: 1rem 0; }
.btn {
  width: 100%;
  padding: 1rem;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.btn-start { background-color: #007bff; color: white; }
.btn-start:hover { background-color: #0056b3; }
.btn-claim { background-color: #28a745; color: white; }
.btn-claim:hover { background-color: #218838; }
.btn-disabled { background-color: #e9ecef; color: #6c757d; cursor: not-allowed; }
.btn:disabled { opacity: 0.7; cursor: not-allowed; }
.error-message { color: #dc3545; margin-top: 1rem; }
.loading-spinner { /* ... (App.vue의 로딩 스피너 스타일 복사) ... */ }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
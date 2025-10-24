<template>
  <div class="coop-mine-container mobile-padding">
    <h1><i class="fas fa-users"></i> 협동 소금 광산</h1>

    <div v-if="!currentSessionId" class="lobby card">
      <h2>탐험 로비</h2>
      <button @click="createNewSession" :disabled="isLoading" class="btn-primary">
        <i class="fas fa-plus"></i> 새로운 탐험대 생성 ({{ entryFee }} Salt)
      </button>
      <div class="session-list">
        <h3>모집 중인 탐험대</h3>
        <ul v-if="recruitingSessions.length > 0">
          <li v-for="session in recruitingSessions" :key="session.id">
            <span>{{ session.leaderName }}의 탐험대 ({{ session.memberCount }}/4)</span>
            <button @click="joinExistingSession(session.id)" :disabled="isLoading">참여</button>
          </li>
        </ul>
        <p v-else>모집 중인 탐험대가 없습니다.</p>
      </div>
    </div>

    <div v-if="currentSessionId && sessionInfo" class="session-details card">
      <div class="session-header">
        <h2>탐험 진행 중! (ID: {{ currentSessionId.substring(0, 6) }})</h2>
        <span :class="['status-badge', sessionInfo.status]">{{ getStatusText(sessionInfo.status) }}</span>
      </div>

      <div class="progress-section">
        <p>목표 달성률: <strong>{{ progressPercentage.toFixed(1) }}%</strong></p>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <p class="progress-text">{{ sessionInfo.currentProgress?.toLocaleString() || 0 }} / {{ sessionInfo.config?.goal?.toLocaleString() || 0 }}</p>
        <p v-if="sessionInfo.status === 'playing'">남은 시간: <strong>{{ remainingTime }}</strong></p>
      </div>

      <div class="members-section">
        <h3><i class="fas fa-user-friends"></i> 참여 멤버 ({{ Object.keys(sessionInfo.members || {}).length }}/4)</h3>
        <ul>
          <li v-for="(member, userId) in sessionInfo.members" :key="userId">
            <span :class="{ 'is-leader': sessionInfo.partyLeaderId === userId, 'is-me': userId === currentUserId }">
              <i class="fas fa-crown" v-if="sessionInfo.partyLeaderId === userId"></i>
              {{ member.name }}
            </span>
            <span>기여도: {{ member.contribution?.toLocaleString() || 0 }}</span>
          </li>
        </ul>
      </div>

      <div class="action-area">
        <button v-if="sessionInfo.status === 'recruiting' && sessionInfo.partyLeaderId === currentUserId" @click="startGame" :disabled="isLoading" class="btn-start">
          <i class="fas fa-play"></i> 탐험 시작!
        </button>

        <div v-if="sessionInfo.status === 'playing'" class="game-play">
          <p>힘을 합쳐 광산을 클릭하세요!</p>
          <button @click="contribute" class="click-button" :disabled="isContributing || contributingCooldown">
            <i class="fas fa-gem"></i> {{ contributingCooldown ? '쿨타임...' : '클릭!' }}
          </button>
          <div class="cooldown-bar" v-if="contributingCooldown">
             <div class="cooldown-fill" :style="{ width: cooldownPercentage + '%' }"></div>
          </div>
        </div>

        <div v-if="sessionInfo.status === 'ended'" class="game-end">
          <h3>탐험 종료!</h3>
          <p>목표 달성 {{ sessionInfo.currentProgress >= sessionInfo.config?.goal ? '성공!' : '실패' }}</p>
          <p>곧 보상이 지급됩니다. 잠시만 기다려주세요.</p>
          <button @click="leaveSession" class="btn-secondary">로비로 돌아가기</button>
        </div>

        <div v-if="sessionInfo.status === 'error'" class="game-error">
            <h3>오류 발생</h3>
            <p>세션 처리 중 오류가 발생했습니다. 관리자에게 문의하세요.</p>
            <p>{{ sessionInfo.errorMessage }}</p>
            <button @click="leaveSession" class="btn-secondary">로비로 돌아가기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { doc, collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { auth, db, functions } from '@/firebaseConfig';

// Firebase Function Callables
const createCoopMineSessionFunc = httpsCallable(functions, 'createCoopMineSession');
const joinCoopMineSessionFunc = httpsCallable(functions, 'joinCoopMineSession');
const startCoopMineGameFunc = httpsCallable(functions, 'startCoopMineGame');
const contributeCoopMineFunc = httpsCallable(functions, 'contributeCoopMine');

// Refs
const isLoading = ref(false);
const isContributing = ref(false);
const currentSessionId = ref(null);
const sessionInfo = ref(null);
const currentUserId = ref(auth.currentUser?.uid);
const recruitingSessions = ref([]); // 모집 중인 세션 목록
const remainingTime = ref('00:00');
const entryFee = ref(100); // 기본값, 실제로는 config에서 가져옴

// Cooldown related refs
const contributingCooldown = ref(false);
const cooldownDuration = 150; // ms
const cooldownTimerId = ref(null);
const cooldownPercentage = ref(0);

// Firestore Listeners
let sessionUnsubscribe = null;
let recruitingUnsubscribe = null;

// Computed Properties
const progressPercentage = computed(() => {
    if (!sessionInfo.value || !sessionInfo.value.config?.goal) return 0;
    return Math.min(100, (sessionInfo.value.currentProgress / sessionInfo.value.config.goal) * 100);
});

// Methods
const createNewSession = async () => {
  isLoading.value = true;
  try {
    // TODO: 입장료는 서버 config에서 가져오는 것이 더 정확함
    if (!confirm(`새로운 탐험대를 생성하시겠습니까? (참가비: ${entryFee.value} Salt)`)) {
        isLoading.value = false;
        return;
    }
    const result = await createCoopMineSessionFunc();
    currentSessionId.value = result.data.sessionId;
  } catch (error) {
    console.error("세션 생성 오류:", error);
    alert(`세션 생성 실패: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const joinExistingSession = async (sessionId) => {
  isLoading.value = true;
  try {
     const sessionToJoin = recruitingSessions.value.find(s => s.id === sessionId);
     const fee = sessionToJoin?.entryFee || entryFee.value; // 세션 데이터에 입장료 정보가 있다면 사용
     if (!confirm(`탐험대에 참여하시겠습니까? (참가비: ${fee} Salt)`)) {
         isLoading.value = false;
         return;
     }
    const result = await joinCoopMineSessionFunc({ sessionId });
    currentSessionId.value = result.data.sessionId;
  } catch (error) {
    console.error("세션 참여 오류:", error);
    alert(`세션 참여 실패: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const startGame = async () => {
  if (!currentSessionId.value || isLoading.value) return;
  isLoading.value = true;
  try {
    await startCoopMineGameFunc({ sessionId: currentSessionId.value });
    // 상태 변경은 onSnapshot 리스너가 감지
  } catch (error) {
    console.error("게임 시작 오류:", error);
    alert(`게임 시작 실패: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const contribute = async () => {
  if (isContributing.value || contributingCooldown.value || !currentSessionId.value || sessionInfo.value?.status !== 'playing') return;

  isContributing.value = true;
  contributingCooldown.value = true;
  cooldownPercentage.value = 100;

  try {
    // 실제 기여량 (클릭당 얻는 Salt 양 등)은 Salt Mine 게임 로직과 연동 필요
    await contributeCoopMineFunc({ sessionId: currentSessionId.value, clicks: 100 }); // 예시: 100 기여
  } catch (error) {
    console.error("기여 오류:", error);
    // 연속 오류 알림 방지
  } finally {
    isContributing.value = false;
    // 쿨타임 시작
    let startTime = Date.now();
    cooldownTimerId.value = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, cooldownDuration - elapsedTime);
        cooldownPercentage.value = (remainingTime / cooldownDuration) * 100;
        if (remainingTime <= 0) {
            clearInterval(cooldownTimerId.value);
            contributingCooldown.value = false;
            cooldownPercentage.value = 0;
        }
    }, 20); // 20ms 간격으로 업데이트
  }
};


const leaveSession = () => {
  currentSessionId.value = null; // 로비로 돌아감
  sessionInfo.value = null;
  if (sessionUnsubscribe) sessionUnsubscribe();
  subscribeToRecruitingSessions(); // 로비 목록 다시 구독
};

const subscribeToSession = (sessionId) => {
  if (sessionUnsubscribe) sessionUnsubscribe();
  const sessionRef = doc(db, 'coopMineSessions', sessionId);
  sessionUnsubscribe = onSnapshot(sessionRef, (docSnap) => {
    if (docSnap.exists()) {
      sessionInfo.value = docSnap.data();
      entryFee.value = sessionInfo.value.config?.entryFee || 100; // 세션 정보에서 입장료 업데이트
    } else {
      console.log("세션 정보가 사라짐");
      leaveSession(); // 세션 정보가 없어지면 로비로
    }
  });
};

const subscribeToRecruitingSessions = () => {
  if (recruitingUnsubscribe) recruitingUnsubscribe();
  const q = query(collection(db, 'coopMineSessions'), where('status', '==', 'recruiting'), orderBy('createdAt', 'desc'), limit(10));
  recruitingUnsubscribe = onSnapshot(q, (snapshot) => {
    recruitingSessions.value = snapshot.docs.map(doc => {
        const data = doc.data();
        // 파티장 이름 가져오기 (members 객체 확인)
        const leaderInfo = data.members ? data.members[data.partyLeaderId] : null;
        return {
            id: doc.id,
            leaderName: leaderInfo ? leaderInfo.name : '알 수 없음',
            memberCount: Object.keys(data.members || {}).length,
            entryFee: data.config?.entryFee // 목록에 입장료 표시용
        };
    });
  });
};

const updateRemainingTime = () => {
    if (sessionInfo.value?.status !== 'playing' || !sessionInfo.value.endTime) {
        remainingTime.value = '00:00';
        return;
    }

    const endTime = sessionInfo.value.endTime.toDate(); // Firestore Timestamp 객체를 Date 객체로 변환
    const now = new Date();
    const diff = Math.max(0, endTime.getTime() - now.getTime()); // 남은 시간 (ms)

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    remainingTime.value = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};


// Watcher for currentSessionId change
watch(currentSessionId, (newVal, oldVal) => {
  if (newVal) {
    if (recruitingUnsubscribe) recruitingUnsubscribe(); // 모집 목록 구독 해제
    recruitingSessions.value = [];
    subscribeToSession(newVal);
  } else {
    // 세션에서 나갔을 때
    if (sessionUnsubscribe) sessionUnsubscribe();
    sessionInfo.value = null;
    subscribeToRecruitingSessions(); // 모집 목록 다시 구독
  }
});

// Update remaining time every second if game is playing
let timerIntervalId = null;
watch(() => sessionInfo.value?.status, (newStatus) => {
    if (newStatus === 'playing') {
        if (!timerIntervalId) {
            updateRemainingTime(); // 즉시 한 번 업데이트
            timerIntervalId = setInterval(updateRemainingTime, 1000);
        }
    } else {
        if (timerIntervalId) {
            clearInterval(timerIntervalId);
            timerIntervalId = null;
            remainingTime.value = '00:00'; // 종료 또는 다른 상태 시 초기화
        }
    }
});


// Lifecycle hooks
onMounted(() => {
  // TODO: 사용자가 이미 참여 중인 세션 ID를 확인하고 불러오는 로직 추가
  // 예: if (userProfile.value.activeCoopSessionId) { currentSessionId.value = userProfile.value.activeCoopSessionId; }
  if (!currentSessionId.value) {
    subscribeToRecruitingSessions();
  }
});

onUnmounted(() => {
  if (sessionUnsubscribe) sessionUnsubscribe();
  if (recruitingUnsubscribe) recruitingUnsubscribe();
  if (timerIntervalId) clearInterval(timerIntervalId);
   if (cooldownTimerId.value) clearInterval(cooldownTimerId.value);
});

// Helper Function
const getStatusText = (status) => {
  switch (status) {
    case 'recruiting': return '모집 중';
    case 'playing': return '진행 중';
    case 'ended': return '종료됨';
    case 'error': return '오류';
    default: return status;
  }
};
</script>

<style scoped>
/* 모바일 우선 스타일 */
.coop-mine-container { padding: 15px; max-width: 800px; margin: 20px auto; font-family: sans-serif; }
.card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
h1, h2, h3 { color: #2c3e50; }
h1 { text-align: center; margin-bottom: 25px; font-size: 1.8em; }
h2 { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; font-size: 1.4em; }
h3 { margin-bottom: 10px; font-size: 1.2em; }
button { padding: 10px 15px; font-size: 1em; cursor: pointer; border-radius: 5px; border: none; transition: background-color 0.2s ease; }
button:disabled { cursor: not-allowed; opacity: 0.6; }
.btn-primary { background-color: #3498db; color: white; }
.btn-primary:hover:not(:disabled) { background-color: #2980b9; }
.btn-secondary { background-color: #ecf0f1; color: #34495e; border: 1px solid #bdc3c7; }
.btn-secondary:hover:not(:disabled) { background-color: #dfe6e9; }
.btn-start { background-color: #2ecc71; color: white; width: 100%; padding: 12px; font-size: 1.1em; }
.btn-start:hover:not(:disabled) { background-color: #27ae60; }
.lobby .session-list { margin-top: 20px; }
.lobby ul { list-style: none; padding: 0; }
.lobby li { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
.lobby li button { font-size: 0.9em; padding: 5px 10px; }
.session-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.status-badge { padding: 5px 10px; border-radius: 15px; font-size: 0.9em; font-weight: bold; color: white; }
.status-badge.recruiting { background-color: #e67e22; }
.status-badge.playing { background-color: #2ecc71; }
.status-badge.ended { background-color: #95a5a6; }
.status-badge.error { background-color: #e74c3c; }
.progress-section { margin-bottom: 20px; }
.progress-bar-container { width: 100%; height: 20px; background-color: #ecf0f1; border-radius: 10px; overflow: hidden; margin: 5px 0; }
.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #f1c40f, #e67e22); transition: width 0.3s ease; }
.progress-text { text-align: center; font-size: 0.9em; color: #555; }
.members-section ul { list-style: none; padding: 0; }
.members-section li { display: flex; justify-content: space-between; padding: 8px 0; font-size: 1em; }
.members-section .is-leader { font-weight: bold; }
.members-section .is-leader i { color: #f1c40f; margin-right: 5px; }
.members-section .is-me { color: #3498db; }
.action-area { margin-top: 20px; text-align: center; }
.click-button { font-size: 1.8em; padding: 25px 50px; background: linear-gradient(135deg, #f1c40f, #e67e22); color: white; border-radius: 50%; width: 150px; height: 150px; box-shadow: 0 5px 15px rgba(230, 126, 34, 0.4); border: 3px solid white; }
.click-button:hover:not(:disabled) { transform: scale(1.05); }
.click-button i { margin-right: 8px; }

.cooldown-bar {
  width: 150px; /* 버튼과 동일한 너비 */
  height: 8px;
  background-color: #ecf0f1;
  border-radius: 4px;
  margin: 10px auto 0;
  overflow: hidden;
}
.cooldown-fill {
  height: 100%;
  background-color: #3498db;
  transition: width 0.05s linear; /* 부드러운 감소 효과 */
  width: 100%;
}

.game-end, .game-error { padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
.game-error h3 { color: #e74c3c; }

/* PC 화면 스타일 */
@media (min-width: 768px) {
  h1 { font-size: 2.2em; }
  h2 { font-size: 1.6em; }
  h3 { font-size: 1.3em; }
  .lobby { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
  .lobby .btn-primary { grid-column: 1 / -1; }
  .session-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 30px; }
  .session-header, .progress-section, .action-area { grid-column: 1 / -1; }
  .click-button { width: 180px; height: 180px; font-size: 2em; }
  .cooldown-bar { width: 180px; }
}
</style>
<template>
  <div class="walking-salt-page">
    <div class="walking-card card glassmorphism">
      <h2 class="walking-title">
        <i class="fas fa-walking"></i> 워킹 솔트
      </h2>
      <p class="walking-subtitle">일일 만보(萬步) 챌린지</p>
      
      <div class="info-box">
        <p>
          스마트폰의 'Google 피트니스'(안드로이드) 또는 'Apple 건강'(아이폰) 앱과 연동하여 오늘 하루의 걸음 수를 인증합니다.
        </p>
        <p>
          일일 1회만 인증할 수 있으며, 걸음 수에 따라 SaltMate 포인트를 차등 지급합니다.
        </p>
      </div>

      <div class="reward-tiers">
        <h3><i class="fas fa-trophy"></i> 일일 보상 티어</h3>
        <ul>
          <li><strong>5,000 걸음</strong> 달성 시: <strong>200 P</strong></li>
          <li><strong>10,000 걸음</strong> 달성 시: <strong>500 P</strong></li>
          <li><strong>15,000 걸음</strong> 달성 시: <strong>800 P</strong></li>
        </ul>
        <small>(5,000보 미만은 보상이 지급되지 않습니다.)</small>
      </div>

      <button @click="authenticateSteps" class="btn-authenticate" :disabled="isLoading">
        <span v-if="isLoading" class="spinner"></span>
        <span v-else><i class="fas fa-check-circle"></i> 오늘 걸음 수 인증하기</span>
      </button>

      <div v-if="message" :class="['message-box', messageType]">
        <p>{{ message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const isLoading = ref(false);
const message = ref('');
const messageType = ref('success'); // 'success' or 'error'

const claimRewardFunc = httpsCallable(functions, 'claimDailyWalkingReward');

// (시뮬레이션) 실제로는 Google Fit/HealthKit API 연동이 필요
const getSimulatedSteps = () => {
  // 3,000보 ~ 17,000보 사이의 랜덤 걸음 수 생성
  return Math.floor(Math.random() * 14001) + 3000;
};

const authenticateSteps = async () => {
  isLoading.value = true;
  message.value = '걸음 수 데이터를 불러오는 중입니다... (시뮬레이션)';
  messageType.value = 'success';

  try {
    // --- API 연동 시뮬레이션 ---
    // 1. (가짜) 구글/애플 API 연동 및 권한 요청
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. (가짜) 걸음 수 데이터 가져오기
    const steps = getSimulatedSteps();
    
    // 3. 솔트메이트 백엔드에 보상 요청
    message.value = `${steps.toLocaleString()}보 확인! 보상 지급 요청 중...`;
    
    const result = await claimRewardFunc({ steps: steps });
    
    // 4. 성공
    const { awardedPoints, steps: confirmedSteps } = result.data;
    messageType.value = 'success';
    message.value = `[인증 성공] ${confirmedSteps.toLocaleString()}보를 인증하여 ${awardedPoints.toLocaleString()} SaltMate를 획득했습니다!`;

  } catch (error) {
    console.error("걸음 수 인증 오류:", error);
    messageType.value = 'error';
    if (error.code === 'functions/already-exists') {
      message.value = "오늘은 이미 걸음 수 보상을 받았습니다. 내일 다시 시도해주세요.";
    } else {
      message.value = `인증 실패: ${error.message}`;
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.walking-salt-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px); /* 헤더 높이 제외 */
  padding: 20px;
  background-color: #f0f2f5;
}
.walking-card {
  max-width: 500px;
  width: 100%;
  padding: 40px;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.walking-title {
  font-size: 2.2em;
  color: #333;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}
.walking-title .fa-walking {
  color: #007bff;
}
.walking-subtitle {
  font-size: 1.2em;
  color: #555;
  margin-top: 5px;
  margin-bottom: 25px;
  font-weight: 500;
}
.info-box {
  background: rgba(255, 255, 255, 0.6);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 25px;
  text-align: left;
  font-size: 0.95em;
  color: #333;
}
.reward-tiers {
  margin-bottom: 30px;
}
.reward-tiers h3 {
  font-size: 1.1em;
  color: #007bff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 15px;
}
.reward-tiers ul {
  list-style: none;
  padding: 0;
  margin: 0 0 10px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.reward-tiers li {
  font-size: 1.1em;
  color: #444;
}
.reward-tiers small {
  font-size: 0.9em;
  color: #777;
}
.btn-authenticate {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #28a745, #218838);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
}
.btn-authenticate:hover:not(:disabled) {
  background: linear-gradient(135deg, #218838, #1e7e34);
  box-shadow: 0 6px 20px rgba(40, 167, 69, 0.6);
  transform: translateY(-2px);
}
.btn-authenticate:disabled {
  background: #94d3a2;
  cursor: not-allowed;
  box-shadow: none;
}
.message-box {
  margin-top: 20px;
  padding: 12px;
  border-radius: 8px;
  font-weight: 500;
}
.message-box.success {
  background: #e6ffed;
  color: #22863a;
  border: 1px solid #7ee298;
}
.message-box.error {
  background: #ffeef0;
  color: #d73a49;
  border: 1px solid #f9b3bc;
}
.spinner {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
<template>
  <div class="attendance-page">
    <header class="page-header">
      <h1><i class="fas fa-calendar-check"></i> 출석체크 이벤트</h1>
      <p class="description">매일 출석하고 SaltMate와 특별한 보상을 받아가세요!</p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else class="attendance-container">
        <div class="status-panel">
          <h2>나의 출석 현황</h2>
          <div class="status-item">
            <i class="fas fa-running"></i>
            <span>연속 출석일: <strong>{{ consecutiveDays }}일</strong></span>
          </div>
          <div class="status-item">
            <i class="fas fa-history"></i>
            <span>마지막 출석일: {{ lastCheckInDate }}</span>
          </div>
        </div>
        <div class="action-panel">
          <button @click="performCheckIn" class="check-in-button" :disabled="isAlreadyCheckedIn || isProcessing">
            <span v-if="isProcessing" class="spinner-small"></span>
            <span v-else-if="isAlreadyCheckedIn">오늘 출석 완료!</span>
            <span v-else>출석체크 하기</span>
          </button>
          <p v-if="isAlreadyCheckedIn" class="notice">내일 다시 참여해주세요.</p>
        </div>
      </div>
      <div class="rewards-info">
        <h3>🎁 연속 출석 보상 안내</h3>
        <ul>
          <li><strong>7일 연속:</strong> 소금 광산 부스트 20% 쿠폰 + 100 SaltMate</li>
          <li><strong>15일 연속:</strong> 소금 광산 부스트 60% 쿠폰 + 500 SaltMate</li>
          <li><strong>30일 연속:</strong> 소금 광산 부스트 100% 쿠폰 + 1,000 SaltMate</li>
        </ul>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { auth, db, functions } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const isLoading = ref(true);
const isProcessing = ref(false);
const attendanceData = ref({ lastCheckIn: null, consecutiveDays: 0 });

const lastCheckInDate = computed(() => attendanceData.value.lastCheckIn || "기록 없음");
const consecutiveDays = computed(() => attendanceData.value.consecutiveDays || 0);

const isAlreadyCheckedIn = computed(() => {
  if (!attendanceData.value.lastCheckIn) return false;
  const kstOffset = 9 * 60 * 60 * 1000;
  const todayStr = new Date(Date.now() + kstOffset).toISOString().slice(0, 10);
  return attendanceData.value.lastCheckIn === todayStr;
});

const fetchAttendanceData = async () => {
  isLoading.value = true;
  if (auth.currentUser) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists() && docSnap.data().attendance) {
      attendanceData.value = docSnap.data().attendance;
    }
  }
  isLoading.value = false;
};

const performCheckIn = async () => {
  isProcessing.value = true;
  try {
    const dailyCheckIn = httpsCallable(functions, "dailyCheckIn");
    const result = await dailyCheckIn();
    const { rewards } = result.data;
    
    let rewardMessage = `출석체크 완료!\n- 일일 보상: ${rewards.dailySaltMate} SaltMate`;
    if (rewards.consecutiveSaltMate > 0) {
      rewardMessage += `\n- 연속 출석 보상: ${rewards.consecutiveSaltMate} SaltMate`;
    }
    if (rewards.coupon) {
      rewardMessage += `\n- 특별 보상: 소금 광산 부스트 ${rewards.coupon.boostPercentage}% 쿠폰`;
    }
    alert(rewardMessage);

    await fetchAttendanceData(); // 데이터 새로고침
  } catch (error) {
    console.error("출석체크 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isProcessing.value = false;
  }
};

onMounted(fetchAttendanceData);
</script>

<style scoped>
.attendance-page {
  max-width: 800px;
  margin: 90px auto 40px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.5em;
  color: #2c3e50;
  margin-bottom: 10px;
}
.page-header h1 .fas {
  color: #28a745;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.card {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  padding: 30px 40px;
}
.attendance-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  align-items: center;
}
.status-panel {
  background-color: #f8f9fa;
  padding: 25px;
  border-radius: 12px;
  text-align: center;
}
.status-panel h2 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.8em;
  color: #333;
}
.status-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 1.2em;
  margin-bottom: 15px;
}
.status-item .fas {
  color: #007bff;
}
.status-item strong {
  font-size: 1.5em;
  color: #28a745;
}
.action-panel {
  text-align: center;
}
.check-in-button {
  width: 100%;
  padding: 20px;
  font-size: 1.5em;
  font-weight: bold;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  transition:
    background-color 0.3s,
    transform 0.2s;
}
.check-in-button:hover:not(:disabled) {
  background-color: #0056b3;
  transform: translateY(-3px);
}
.check-in-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
.action-panel .notice {
  margin-top: 15px;
  color: #555;
  font-weight: 500;
}
.rewards-info {
  margin-top: 40px;
  border-top: 1px solid #eee;
  padding-top: 30px;
}
.rewards-info h3 {
  text-align: center;
  margin-bottom: 20px;
  color: #333;
}
.rewards-info ul {
  list-style-type: none;
  padding: 0;
  max-width: 500px;
  margin: 0 auto;
}
.rewards-info li {
  background-color: #f8f9fa;
  padding: 12px 18px;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 1.05em;
}
.spinner-small {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 768px) {
  .attendance-container {
    grid-template-columns: 1fr;
  }
}
</style>
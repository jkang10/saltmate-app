<template>
  <div class="widget-card">
    <h4><i class="fas fa-users"></i> 실시간 접속자 수</h4>
    <div class="user-count">
      {{ userCount }}
      <span class="unit">명</span>
    </div>
    <p class="description">현재 앱을 사용 중인 사용자입니다.</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { rtdb } from "@/firebaseConfig";
import { ref as dbRef, onValue, off } from "firebase/database";

const userCount = ref(0);
const presenceRef = dbRef(rtdb, "presence");

// 실시간 데이터 수신 리스너를 저장할 변수
let presenceListener = null;

onMounted(() => {
  // Realtime Database의 'presence' 경로에 대한 데이터 변경을 실시간으로 감지합니다.
  presenceListener = onValue(presenceRef, (snapshot) => {
    if (snapshot.exists()) {
      // ▼▼▼ [핵심 수정] numChildren() 대신 snapshot.size를 사용하여 접속자 수를 올바르게 계산합니다. ▼▼▼
      userCount.value = snapshot.size;
    } else {
      userCount.value = 0;
    }
  });
});

onUnmounted(() => {
  // 컴포넌트가 사라질 때 실시간 리스너를 확실하게 제거하여 메모리 누수를 방지합니다.
  if (presenceListener) {
    off(presenceRef);
  }
});
</script>

<style scoped>
.widget-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-align: center;
}
.widget-card h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  font-size: 1.1em;
}
.user-count {
  font-size: 3em;
  font-weight: bold;
  color: #007bff;
  line-height: 1;
}
.unit {
  font-size: 0.5em;
  margin-left: 5px;
  color: #6c757d;
}
.description {
  margin-top: 10px;
  margin-bottom: 0;
  color: #6c757d;
  font-size: 0.9em;
}
</style>

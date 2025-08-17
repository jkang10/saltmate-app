// 파일 경로: src/components/admin/RealtimeUsersWidget.vue

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
let presenceListener = null;

onMounted(() => {
  presenceListener = onValue(presenceRef, (snapshot) => {
    if (snapshot.exists()) {
      userCount.value = snapshot.numChildren();
    } else {
      userCount.value = 0;
    }
  });
});

onUnmounted(() => {
  if (presenceListener) {
    off(presenceRef, "value", presenceListener);
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

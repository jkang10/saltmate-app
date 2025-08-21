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

// ▼▼▼ [수정됨] onValue 리스너를 저장할 변수 선언 방식 변경 ▼▼▼
let listener;
// ▲▲▲ 수정 완료 ▲▲▲

onMounted(() => {
  // onValue는 리스너 함수 자체를 반환하지 않으므로, 직접 리스너 함수를 정의합니다.
  const presenceListener = (snapshot) => {
    if (snapshot.exists()) {
      userCount.value = snapshot.numChildren();
    } else {
      userCount.value = 0;
    }
  };

  // 정의된 리스너를 onValue에 등록합니다.
  onValue(presenceRef, presenceListener);

  // 나중에 해제할 수 있도록 리스너를 저장합니다.
  listener = presenceListener;
});

onUnmounted(() => {
  // ▼▼▼ [수정됨] off 함수 사용법을 올바르게 변경 ▼▼▼
  // onValue로 등록한 리스너를 해제할 때는 off(레퍼런스, 이벤트 타입, 리스너 함수) 형식을 사용합니다.
  if (listener) {
    off(presenceRef, "value", listener);
  }
  // ▲▲▲ 수정 완료 ▲▲▲
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

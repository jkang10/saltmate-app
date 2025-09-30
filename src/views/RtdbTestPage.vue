<template>
  <div style="padding: 50px; text-align: center;">
    <h1>Realtime Database 쓰기 테스트</h1>
    <p>아래 버튼을 누르고 개발자 도구 콘솔을 확인하세요.</p>
    <button @click="testWrite" style="padding: 15px 30px; font-size: 1.2em;">
      데이터 쓰기 테스트
    </button>
    <div v-if="message" :style="{ color: isSuccess ? 'green' : 'red', marginTop: '20px' }">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { auth, rtdb } from '@/firebaseConfig';
import { ref as rtdbRef, set } from "firebase/database";

const message = ref('');
const isSuccess = ref(false);

const testWrite = async () => {
  if (!auth.currentUser) {
    message.value = "오류: 로그인 상태가 아닙니다.";
    isSuccess.value = false;
    return;
  }

  const uid = auth.currentUser.uid;
  const testRef = rtdbRef(rtdb, `testWrites/${uid}`);
  
  try {
    console.log(`[테스트 시작] 경로: testWrites/${uid}`);
    await set(testRef, { 
      timestamp: Date.now(), 
      message: "Hello from client!" 
    });
    
    console.log("✅ RTDB 쓰기 성공!");
    message.value = "✅ RTDB 쓰기 성공! 이제 솔트팡 대전이 동작할 가능성이 높습니다.";
    isSuccess.value = true;

  } catch (error) {
    console.error("❌ RTDB 쓰기 실패:", error);
    message.value = `❌ RTDB 쓰기 실패: ${error.message}`;
    isSuccess.value = false;
  }
};
</script>
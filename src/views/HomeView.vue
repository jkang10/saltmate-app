<template>
  <div class="home-container">
    <div class="loading-spinner"></div>
    <p>사용자 정보를 확인하고 있습니다. 잠시만 기다려주세요...</p>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

// script setup을 사용하면 더 간결하게 코드를 작성할 수 있습니다.
const router = useRouter();

// 컴포넌트가 화면에 마운트되자마자 실행될 로직
onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    // 1. 사용자가 로그인했는지 확인
    if (user) {
      // 2. Firestore에서 사용자 프로필 정보 가져오기
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userProfile = userSnap.data();
        // 3. 관리자인지 확인하고 리디렉션
        if (userProfile.isAdmin) {
          router.replace("/admin-dashboard/users"); // 관리자 대시보드로 이동
        } else {
          router.replace("/dashboard"); // 일반 사용자는 일반 대시보드로 이동
        }
      } else {
        // 프로필이 없는 경우 (오류 상황)
        router.replace("/login");
      }
    } else {
      // 4. 로그인하지 않은 사용자는 로그인 페이지로 이동
      // (또는 현재처럼 깨진 화면 대신 다른 안내 페이지를 보여줄 수 있습니다)
      // 여기서는 일단 로그인 페이지로 보내도록 처리합니다.
      router.replace("/login");
    }
  });
});
</script>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 80vh;
  text-align: center;
  font-family: "Noto Sans KR", sans-serif; /* 폰트 직접 지정 */
}

.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #007bff;
  animation: spin 1s ease infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

p {
  font-size: 1.1em;
  color: #555;
}
</style>

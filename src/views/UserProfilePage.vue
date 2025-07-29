<template>
  <div class="user-profile-page">
    <header class="page-header">
      <h1>👤 사용자 프로필 (개발 중)</h1>
      <p class="description">
        솔트메이트 계정의 상세 정보를 관리하는 페이지입니다.
      </p>
    </header>

    <main class="content-wrapper">
      <div class="placeholder-content card glassmorphism">
        <h2>이 페이지는 현재 개발 중입니다.</h2>
        <p>
          계정 정보, 투자 요약, 설정 등 사용자 맞춤형 기능들이 여기에 표시될
          예정입니다.
        </p>
        <router-link to="/dashboard" class="back-to-dashboard-button">
          대시보드로 돌아가기
        </router-link>
      </div>
    </main>
  </div>
</template>

<script>
// 필요한 Firebase 관련 import는 나중에 실제 기능 구현 시 추가합니다.
// import { getAuth, updatePassword, updateProfile } from "firebase/auth";
// import { doc, getDoc, updateDoc } from "firebase/firestore";
// import { ref, onMounted } from "vue";
// import { useRouter } from "vue-router";
// import { auth, db } from "@/firebaseConfig";

export default {
  name: "UserProfilePage",
  setup() {
    // 개발 중 페이지이므로 현재는 로직 없음
    // 나중에 프로필 정보 로드, 업데이트, 비밀번호 변경 등의 로직이 추가됩니다.
    return {};
  },
};
</script>

<style scoped>
.user-profile-page {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 2.8em;
  color: #333;
  margin-bottom: 10px;
}

.page-header .description {
  font-size: 1.1em;
  color: #666;
}

.placeholder-content {
  padding: 40px;
  text-align: center;
  margin-top: 50px;
}

.placeholder-content h2 {
  font-size: 2em;
  color: #4caf50;
  margin-bottom: 20px;
}

.placeholder-content p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 30px;
}

.back-to-dashboard-button {
  background-color: #4caf50; /* Green */
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  font-size: 1em;
  text-decoration: none;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.back-to-dashboard-button:hover {
  background-color: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Glassmorphism card style */
.card {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>

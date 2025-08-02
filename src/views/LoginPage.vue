<template>
  <div class="login-page">
    <div class="login-container">
      <h2>솔트메이트 로그인</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">이메일</label>
          <input
            type="email"
            id="email"
            v-model="email"
            placeholder="이메일 주소 입력"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">비밀번호</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="비밀번호"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" :disabled="loading" class="login-button">
          <span v-if="loading">로그인 중...</span>
          <span v-else>로그인</span>
        </button>
      </form>

      <p v-if="error" class="error-message">{{ error }}</p>

      <div class="links">
        <p>
          계정이 없으신가요? <router-link to="/signup">회원가입</router-link>
        </p>
        <p><router-link to="/reset-password">비밀번호 찾기</router-link></p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "@/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default {
  name: "LoginPage",
  setup() {
    const email = ref("");
    const password = ref("");
    const error = ref(null);
    const isLoading = ref(false);
    const router = useRouter();

    const handleLogin = async () => {
      error.value = null;
      isLoading.value = true;
      try {
        // 1. Firebase Authentication으로 로그인 시도
        await signInWithEmailAndPassword(auth, email.value, password.value);

        // ▼▼▼ [수정] 바로 이 위치에 삽입합니다 ▼▼▼
        // 2. 로그인 성공 후, 사용자 정보 가져오기
        const user = auth.currentUser;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        // 3. 관리자인지 확인하고 올바른 대시보드로 이동
        if (userSnap.exists() && userSnap.data().isAdmin) {
          router.push("/admin-dashboard"); // 관리자는 관리자 페이지로
        } else {
          router.push("/dashboard"); // 일반 사용자는 일반 페이지로
        }
        // ▲▲▲ [수정] 완료 ▲▲▲
      } catch (err) {
        console.error("로그인 오류:", err);
        switch (err.code) {
          case "auth/invalid-email":
            error.value = "유효하지 않은 이메일 형식입니다.";
            break;
          case "auth/user-not-found":
          case "auth/wrong-password":
          case "auth/invalid-credential":
            error.value = "이메일 또는 비밀번호가 잘못되었습니다.";
            break;
          default:
            error.value = "로그인 중 오류가 발생했습니다.";
            break;
        }
      } finally {
        isLoading.value = false;
      }
    };

    return {
      email,
      password,
      error,
      isLoading,
      handleLogin,
    };
  },
};
</script>

<style scoped>
/* 이전 스타일은 그대로 유지됩니다 */
.login-page {
  font-family: "Noto Sans KR", sans-serif; /* 이 줄을 추가하세요! */
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
  box-sizing: border-box;
}

.login-container {
  background-color: #ffffff;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

h2 {
  color: #3498db;
  margin-bottom: 30px;
  font-size: 2em;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #34495e;
  font-weight: bold;
}

.form-group input {
  width: calc(100% - 20px);
  padding: 12px 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 1em;
  box-sizing: border-box; /* 패딩이 너비에 포함되도록 */
}

.form-group input:focus {
  border-color: #3498db;
  outline: none;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.login-button {
  background-color: #3498db;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 5px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  width: 100%;
  transition:
    background-color 0.3s ease,
    box-shadow 0.3s ease;
  margin-top: 10px;
}

.login-button:hover:not(:disabled) {
  background-color: #2980b9;
  box-shadow: 0 6px 15px rgba(52, 152, 219, 0.3);
}

.login-button:disabled {
  background-color: #aed6b8; /* 비활성화 시 연한 색 */
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  margin-top: 20px;
  font-size: 0.9em;
  font-weight: 500;
}

.links {
  margin-top: 25px;
  font-size: 0.9em;
  color: #666;
}

.links p {
  margin-bottom: 10px;
}

.links a {
  color: #3498db;
  text-decoration: none;
  font-weight: bold;
}

.links a:hover {
  text-decoration: underline;
}

/* 반응형 디자인 */
@media (max-width: 600px) {
  .login-container {
    padding: 30px 20px;
    margin: 15px;
  }
  h2 {
    font-size: 1.8em;
  }
  .form-group input,
  .login-button {
    font-size: 0.95em;
    padding: 10px;
  }
}
</style>

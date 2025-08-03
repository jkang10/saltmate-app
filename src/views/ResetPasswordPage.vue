<template>
  <div class="reset-password-page">
    <div class="reset-container card glassmorphism">
      <h2 class="reset-title"><i class="fas fa-key"></i> 비밀번호 찾기</h2>

      <div v-if="message" class="success-message">
        <p>{{ message }}</p>
        <router-link to="/login" class="back-to-login"
          >로그인 페이지로 돌아가기</router-link
        >
      </div>

      <form v-else @submit.prevent="handleResetPassword" class="reset-form">
        <p class="description">
          가입 시 사용한 이메일 주소를 입력하시면,<br />비밀번호 재설정 링크를
          보내드립니다.
        </p>
        <div class="form-group">
          <label for="email">이메일:</label>
          <input
            type="email"
            id="email"
            v-model="email"
            placeholder="이메일 주소를 입력하세요"
            required
          />
        </div>

        <button type="submit" class="reset-button" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>재설정 링크 보내기</span>
        </button>

        <p v-if="error" class="error-message">{{ error }}</p>

        <div class="login-link">
          <router-link to="/login">로그인으로 돌아가기</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

export default {
  name: "ResetPasswordPage",
  setup() {
    const email = ref("");
    const isLoading = ref(false);
    const error = ref(null);
    const message = ref(null); // 성공 메시지

    const handleResetPassword = async () => {
      isLoading.value = true;
      error.value = null;
      message.value = null;

      if (!email.value) {
        error.value = "이메일을 입력해주세요.";
        isLoading.value = false;
        return;
      }

      const auth = getAuth();
      try {
        await sendPasswordResetEmail(auth, email.value);
        message.value =
          "비밀번호 재설정 이메일을 보냈습니다. 받은편지함을 확인해주세요.";
      } catch (err) {
        console.error("비밀번호 재설정 오류:", err.code);
        if (err.code === "auth/user-not-found") {
          error.value = "해당 이메일로 가입된 계정이 없습니다.";
        } else {
          error.value = "오류가 발생했습니다. 다시 시도해주세요.";
        }
      } finally {
        isLoading.value = false;
      }
    };

    return {
      email,
      isLoading,
      error,
      message,
      handleResetPassword,
    };
  },
};
</script>

<style scoped>
/* LoginPage.vue 와 유사한 스타일 */
.reset-password-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
  padding: 20px;
  background-color: #f0f2f5;
}
.reset-container {
  max-width: 450px;
  width: 100%;
  padding: 40px;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.reset-title {
  font-size: 2.2em;
  color: #333;
  margin-bottom: 20px;
}
.description {
  margin-bottom: 30px;
  color: #555;
  line-height: 1.6;
}
.reset-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.form-group {
  text-align: left;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  color: #555;
}
.form-group input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
}
.reset-button {
  width: 100%;
  padding: 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
}
.reset-button:disabled {
  background-color: #a0c9ff;
  cursor: not-allowed;
}
.error-message {
  color: #e74c3c;
  font-size: 0.95em;
  margin-top: 10px;
}
.success-message {
  padding: 20px;
  background-color: #eaf7f0;
  border: 1px solid #28a745;
  color: #155724;
  border-radius: 8px;
}
.success-message .back-to-login {
  display: inline-block;
  margin-top: 15px;
  font-weight: bold;
}
.login-link {
  margin-top: 15px;
}
.login-link a {
  color: #007bff;
  font-weight: bold;
  text-decoration: none;
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>

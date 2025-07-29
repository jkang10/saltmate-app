<template>
  <div class="reset-password-page">
    <div class="reset-password-container">
      <h2>비밀번호 재설정</h2>
      <form @submit.prevent="handlePasswordReset">
        <div class="form-group">
          <label for="email">이메일</label>
          <input
            type="email"
            id="email"
            v-model="email"
            placeholder="가입 시 사용한 이메일 주소"
            required
            autocomplete="email"
          />
        </div>

        <button type="submit" :disabled="loading" class="reset-button">
          <span v-if="loading">전송 중...</span>
          <span v-else>비밀번호 재설정 이메일 받기</span>
        </button>
      </form>

      <p v-if="message" :class="['info-message', { 'error-message': error }]">
        {{ message }}
      </p>

      <div class="links">
        <p><router-link to="/login">로그인으로 돌아가기</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { auth } from "@/firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";

const email = ref("");
const loading = ref(false);
const message = ref(null);
const error = ref(false); // 오류 메시지 여부를 나타내는 플래그

const handlePasswordReset = async () => {
  loading.value = true;
  message.value = null;
  error.value = false;

  try {
    await sendPasswordResetEmail(auth, email.value);
    message.value =
      "비밀번호 재설정 이메일이 전송되었습니다. 이메일을 확인해주세요.";
    alert(message.value); // 사용자에게 알림
  } catch (err) {
    console.error("비밀번호 재설정 오류:", err.code, err.message);
    error.value = true;
    switch (err.code) {
      case "auth/invalid-email":
        message.value = "유효하지 않은 이메일 주소입니다.";
        break;
      case "auth/user-not-found":
        message.value = "등록되지 않은 이메일 주소입니다.";
        break;
      default:
        message.value =
          "비밀번호 재설정 중 오류가 발생했습니다. 다시 시도해주세요.";
        break;
    }
    alert(message.value); // 사용자에게 알림
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.reset-password-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
  box-sizing: border-box;
}

.reset-password-container {
  background-color: #fff;
  padding: 40px;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 450px;
  text-align: center;
  box-sizing: border-box;
}

h2 {
  color: #34495e;
  margin-bottom: 30px;
  font-size: 2em;
  font-weight: 700;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #34495e;
  font-weight: 600;
  font-size: 0.95em;
}

.form-group input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1em;
  color: #333;
  transition:
    border-color 0.3s ease,
    box-shadow 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #3498db;
  outline: none;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.reset-button {
  width: 100%;
  padding: 15px 20px;
  background-color: #3498db;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1.1em;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    box-shadow 0.3s ease;
  margin-top: 10px;
}

.reset-button:hover:not(:disabled) {
  background-color: #2980b9;
  box-shadow: 0 6px 15px rgba(52, 152, 219, 0.3);
}

.reset-button:disabled {
  background-color: #aed6b8; /* 비활성화 시 연한 색 */
  cursor: not-allowed;
}

.info-message {
  margin-top: 20px;
  font-size: 0.9em;
  font-weight: 500;
  color: #27ae60; /* 성공 메시지 색상 */
}

.error-message {
  color: #e74c3c; /* 에러 메시지 색상 */
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
</style>

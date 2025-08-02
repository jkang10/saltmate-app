<template>
  <div class="signup-page">
    <div class="signup-container card glassmorphism">
      <h2 class="signup-title">
        <i class="fas fa-user-plus"></i> 솔트메이트 가입
      </h2>
      <form @submit.prevent="handleSignup" class="signup-form">
        <button type="submit" class="signup-button" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else><i class="fas fa-user-plus"></i> 가입하기</span>
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
        <div class="login-link">
          이미 계정이 있으신가요? <router-link to="/login">로그인</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "@/firebaseConfig";
// ▼▼▼ [수정] signInWithEmailAndPassword 추가 ▼▼▼
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, getDocs, query, where, limit } from "firebase/firestore";

export default {
  name: "SignUpPage",
  setup() {
    const router = useRouter();
    const email = ref("");
    const password = ref("");
    const confirmPassword = ref("");
    const name = ref("");
    const phone = ref("");
    const region = ref("");
    const investmentAmount = ref("");
    const error = ref(null);
    const isLoading = ref(false);
    const centers = ref([]);
    const referrerInput = ref("");
    const isVerifying = ref(false);
    const validatedReferrer = reactive({ uid: null, name: null });
    const referrerStatus = reactive({ message: "", type: "" });

    // ... fetchCenters, verifyReferrer, resetReferrer 함수는 변경 없음 ...

    const handleSignup = async () => {
      error.value = null;
      if (password.value !== confirmPassword.value) {
        error.value = "비밀번호가 일치하지 않습니다.";
        return;
      }
      if (!investmentAmount.value) {
        error.value = "구독 등급을 선택해주세요.";
        return;
      }
      isLoading.value = true;
      try {
        // 1. Firebase Authentication에 계정 생성
        await createUserWithEmailAndPassword(auth, email.value, password.value);

        // ▼▼▼ [수정] 생성된 계정으로 즉시 로그인하여 인증 상태 확보 ▼▼▼
        await signInWithEmailAndPassword(auth, email.value, password.value);
        // ▲▲▲ [수정] 완료 ▲▲▲

        // 3. 로그인된 상태로 functions 호출
        const functions = getFunctions();
        const createNewUser = httpsCallable(functions, "createNewUser");

        const userData = {
          name: name.value,
          phone: phone.value,
          region: region.value,
          investmentAmount: Number(investmentAmount.value),
          uplineReferrer: validatedReferrer.uid || null,
        };

        await createNewUser(userData);

        alert("회원가입이 성공적으로 완료되었습니다! 대시보드로 이동합니다.");
        // 로그인 후 관리자인지 여부를 확인하여 올바른 경로로 이동
        const user = auth.currentUser;
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().isAdmin) {
          router.push("/admin-dashboard");
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("회원가입 오류:", err);
        error.value = `오류가 발생했습니다: ${err.message}`;
      } finally {
        isLoading.value = false;
      }
    };

    return {
      email,
      password,
      confirmPassword,
      name,
      phone,
      region,
      investmentAmount,
      error,
      isLoading,
      handleSignup,
      centers,
      referrerInput,
      isVerifying,
      validatedReferrer,
      referrerStatus,
      verifyReferrer,
      resetReferrer,
    };
  },
};
</script>

<style scoped>
.signup-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
  padding: 20px;
  background-color: #f0f2f5;
}
.signup-container {
  max-width: 450px;
  width: 100%;
  padding: 40px;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.signup-title {
  font-size: 2.2em;
  color: #333;
  margin-bottom: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}
.signup-title i {
  color: #007bff;
}
.signup-form {
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
  font-size: 1.05em;
}
.form-group input[type="email"],
.form-group input[type="password"],
.form-group input[type="text"],
.form-group input[type="tel"],
.form-group select {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  outline: none;
  transition:
    border-color 0.3s ease,
    box-shadow 0.3s ease;
  background-color: rgba(255, 255, 255, 0.7);
}
.form-group input:focus,
.form-group select:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
  background-color: white;
}
.form-group small {
  display: block;
  margin-top: 5px;
  color: #888;
  font-size: 0.85em;
}
.signup-button {
  width: 100%;
  padding: 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.signup-button:hover:not(:disabled) {
  background-color: #0056b3;
  transform: translateY(-2px);
}
.signup-button:disabled {
  background-color: #a0c9ff;
  cursor: not-allowed;
}
.error-message {
  color: #e74c3c;
  font-size: 0.95em;
  margin-top: 10px;
}
.login-link {
  margin-top: 25px;
  font-size: 0.95em;
  color: #666;
}
.login-link a {
  color: #007bff;
  font-weight: bold;
  text-decoration: none;
}
.login-link a:hover {
  text-decoration: underline;
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
.referrer-input-group {
  display: flex;
  gap: 10px;
}
.referrer-input-group input {
  flex-grow: 1;
}
.verify-button {
  padding: 0 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
  flex-shrink: 0;
}
.verify-button:hover:not(:disabled) {
  background-color: #0056b3;
}
.verify-button:disabled {
  background-color: #a0c9ff;
  cursor: not-allowed;
}
.status-message {
  margin-top: 8px;
  font-size: 0.9em;
  font-weight: bold;
}
.status-message.success {
  color: #28a745;
}
.status-message.error {
  color: #dc3545;
}
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
.reset-referrer {
  color: #007bff;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 5px;
}
</style>

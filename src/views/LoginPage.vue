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
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore"; // getDoc 임포트

export default {
  name: "LoginPage", // 컴포넌트 이름 변경
  setup() {
    const router = useRouter();
    const email = ref("");
    const password = ref("");
    const loading = ref(false);
    const error = ref(null);

    const handleLogin = async () => {
      loading.value = true;
      error.value = null; // 이전 오류 메시지 초기화

      try {
        await signInWithEmailAndPassword(auth, email.value, password.value);
        alert("로그인 성공!");
        router.push("/dashboard"); // 로그인 성공 후 대시보드로 이동
      } catch (err) {
        console.error("로그인 오류:", err.code, err.message);
        error.value = getAuthErrorMessage(err.code);
      } finally {
        loading.value = false;
      }
    };

    const signInWithGoogle = async () => {
      loading.value = true;
      error.value = null;
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // 사용자가 이미 Firestore에 등록되어 있는지 확인
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // 새로운 Google 사용자라면 Firestore에 정보 저장
          await setDoc(userDocRef, {
            email: user.email,
            name: user.displayName || "", // Google 프로필 이름 사용
            phone: "", // Google은 전화번호를 제공하지 않을 수 있음
            accountNumber: "",
            investmentType: "individual", // 소셜 로그인은 기본적으로 개인 투자
            isApproved: false,
            createdAt: Timestamp.now(),
            participationAmount: 0,
            hasNFT: false,
            saltmateLevel: "basic",
          });
          alert(
            "Google 계정으로 회원가입 성공! 관리자 승인 후 서비스 이용이 가능합니다."
          );
        } else {
          alert("Google 계정으로 로그인 성공!");
        }
        router.push("/dashboard"); // 로그인 성공 후 대시보드로 이동
      } catch (err) {
        console.error("Google 로그인 오류:", err.code, err.message);
        error.value = getAuthErrorMessage(err.code);
      } finally {
        loading.value = false;
      }
    };

    const getAuthErrorMessage = (code) => {
      switch (code) {
        case "auth/invalid-email":
          return "유효하지 않은 이메일 주소입니다.";
        case "auth/user-not-found":
          return "등록되지 않은 이메일입니다.";
        case "auth/wrong-password":
          return "비밀번호가 올바르지 않습니다.";
        case "auth/too-many-requests":
          return "로그인 시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
        case "auth/popup-closed-by-user":
          return "Google 로그인 팝업이 사용자에게 의해 닫혔습니다.";
        default:
          return "로그인 중 알 수 없는 오류가 발생했습니다. 다시 시도해주세요.";
      }
    };

    return {
      email,
      password,
      loading,
      error,
      handleLogin,
      signInWithGoogle,
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
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
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

<template>
  <div class="signup-page">
    <div class="signup-container card glassmorphism">
      <h2 class="signup-title">
        <i class="fas fa-user-plus"></i> 솔트메이트 가입
      </h2>
      <form @submit.prevent="handleSignup" class="signup-form">
        <div class="form-group">
          <label for="email">이메일:</label>
          <input
            type="email"
            id="email"
            v-model="email"
            placeholder="이메일을 입력하세요"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">비밀번호:</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="비밀번호 (6자 이상)"
            required
          />
        </div>

        <div class="form-group">
          <label for="confirm-password">비밀번호 확인:</label>
          <input
            type="password"
            id="confirm-password"
            v-model="confirmPassword"
            placeholder="비밀번호를 다시 입력하세요"
            required
          />
        </div>

        <div class="form-group">
          <label for="name">이름:</label>
          <input
            type="text"
            id="name"
            v-model="name"
            placeholder="이름을 입력하세요"
            required
          />
        </div>

        <div class="form-group">
          <label for="phone">전화번호 (HP):</label>
          <input
            type="tel"
            id="phone"
            v-model="phone"
            placeholder="예: 010-1234-5678"
            required
            pattern="[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}"
          />
          <small>하이픈(-)을 포함하여 입력해주세요.</small>
        </div>

        <div class="form-group">
          <label for="region">지역 (센터):</label>
          <input
            type="text"
            id="region"
            v-model="region"
            placeholder="활동하실 센터 지역을 입력하세요"
            required
          />
        </div>

        <div class="form-group">
          <label for="investment-amount">투자금액:</label>
          <select id="investment-amount" v-model="investmentAmount" required>
            <option value="">투자금액을 선택하세요</option>
            <option value="10000">만원의 행복</option>
            <option value="100000">10만원</option>
            <option value="300000">30만원</option>
            <option value="500000">50만원</option>
            <option value="1000000">100만원</option>
          </select>
        </div>

        <div class="form-group">
          <label for="referrer">추천인 (선택 사항):</label>
          <input
            type="text"
            id="referrer"
            v-model="referrer"
            placeholder="추천인 이름, 이메일 또는 ID를 입력하세요"
          />
          <small>추천인의 이름, 이메일 또는 ID를 수동으로 입력해주세요.</small>
        </div>

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
import { ref } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "@/firebaseConfig"; // Firebase 설정 임포트
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

export default {
  name: "SignUpPage",
  setup() {
    const router = useRouter();
    const email = ref("");
    const password = ref("");
    const confirmPassword = ref("");
    const name = ref(""); // 이름 필드 추가
    const phone = ref(""); // 전화번호 필드 추가
    const region = ref(""); // 지역 필드 추가
    const investmentAmount = ref("");
    const referrer = ref(""); // 추천인 필드

    const error = ref(null);
    const isLoading = ref(false);

    const handleSignup = async () => {
      error.value = null;
      if (password.value !== confirmPassword.value) {
        error.value = "비밀번호가 일치하지 않습니다.";
        return;
      }

      isLoading.value = true;
      try {
        // 1. Firebase Authentication으로 사용자 생성
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.value,
          password.value
        );
        const user = userCredential.user;

        // 2. Firestore에 사용자 추가 정보 저장
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          name: name.value, // 이름 저장
          phone: phone.value, // 전화번호 저장
          region: region.value, // 지역 저장
          investmentAmount: investmentAmount.value,
          referrer: referrer.value, // 추천인 정보 저장 (수동 입력된 값)
          createdAt: new Date(),
          isAdmin: false, // 기본적으로 관리자 아님
        });

        alert("회원가입이 성공적으로 완료되었습니다!");
        router.push("/login"); // 회원가입 성공 후 로그인 페이지로 이동
      } catch (err) {
        console.error("회원가입 오류:", err.code, err.message);
        switch (err.code) {
          case "auth/email-already-in-use":
            error.value = "이미 사용 중인 이메일 주소입니다.";
            break;
          case "auth/invalid-email":
            error.value = "유효하지 않은 이메일 주소입니다.";
            break;
          case "auth/weak-password":
            error.value = "비밀번호는 6자 이상이어야 합니다.";
            break;
          default:
            error.value = "회원가입 중 오류가 발생했습니다: " + err.message;
        }
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
      referrer,
      error,
      isLoading,
      handleSignup,
    };
  },
};
</script>

<style scoped>
.signup-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px); /* Navbar 높이만큼 제외 */
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
  background: rgba(255, 255, 255, 0.4); /* Glassmorphism 효과 강화 */
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
  color: #007bff; /* 아이콘 색상 */
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
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  background-color: rgba(255, 255, 255, 0.7); /* Glassmorphism과 어울리도록 */
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
  transition: background-color 0.3s ease, transform 0.2s ease;
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

/* 스피너 스타일 */
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

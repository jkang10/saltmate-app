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
          <label for="center">지역 (센터):</label>
          <select id="center" v-model="selectedCenterId" required>
            <option value="" disabled>지역(센터)를 선택하세요</option>
            <option
              v-for="center in centers"
              :key="center.id"
              :value="center.id"
            >
              {{ center.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="investment-amount">구독 등급:</label>
          <select id="investment-amount" v-model="investmentAmount" required>
            <option value="">구독 등급을 선택하세요</option>
            <option value="10000">만원의 행복</option>
            <option value="100000">10만원</option>
            <option value="300000">30만원</option>
            <option value="500000">50만원</option>
            <option value="1000000">100만원</option>
          </select>
        </div>
        <div class="form-group">
          <label for="referrer">추천인 (선택 사항):</label>
          <div class="referrer-input-group">
            <input
              type="text"
              id="referrer"
              v-model="referrerInput"
              placeholder="추천인 이메일 또는 이름 입력"
              :disabled="!!validatedReferrer.uid"
            />
            <button
              type="button"
              @click="verifyReferrer"
              class="verify-button"
              :disabled="
                isVerifying || !referrerInput || !!validatedReferrer.uid
              "
            >
              <span v-if="isVerifying" class="spinner-small"></span>
              <span v-else>검증</span>
            </button>
          </div>
          <small v-if="!validatedReferrer.uid && !route.query.ref"
            >추천인의 이메일 또는 이름을 입력 후 '검증'을 눌러주세요.</small
          >
          <p
            v-if="referrerStatus.message"
            :class="['status-message', referrerStatus.type]"
          >
            {{ referrerStatus.message }}
            <span
              v-if="validatedReferrer.uid"
              @click="resetReferrer"
              class="reset-referrer"
            >
              [변경]
            </span>
          </p>
        </div>
        <button type="submit" class="signup-button" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else><i class="fas fa-user-plus"></i> 가입 신청하기</span>
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
        <div class="login-link">
          이미 계정이 있으신가요? <router-link to="/login">로그인</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { auth, db, functions } from "@/firebaseConfig"; // [★수정★] functions 임포트
import { createUserWithEmailAndPassword } from "firebase/auth";
import { httpsCallable, getFunctions } from "firebase/functions"; // [★수정★] getFunctions 임포트
import { collection, getDocs } from "firebase/firestore"; // [★수정★] query, where, limit, doc, getDoc 삭제

const router = useRouter();
const route = useRoute();

const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const name = ref("");
const phone = ref("");
const selectedCenterId = ref("");
const investmentAmount = ref("");
const error = ref(null);
const isLoading = ref(false);
const centers = ref([]);
const referrerInput = ref("");
const isVerifying = ref(false);
const validatedReferrer = reactive({ uid: null, name: null });
const referrerStatus = reactive({ message: "", type: "" });

// [★신규★] Cloud Functions 호출기
const functionsInstance = getFunctions(undefined, "asia-northeast3");
const getReferrerNameByUid = httpsCallable(functionsInstance, 'getReferrerNameByUid');
const findReferrerByNameOrEmail = httpsCallable(functionsInstance, 'findReferrerByNameOrEmail');

const fetchCenters = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "centers"));
    centers.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error("센터 목록 로딩 오류:", err);
  }
};

// [★수정★] URL의 ?ref= UID로 추천인을 미리 검증하는 함수
const checkReferralLink = async () => {
  const refId = route.query.ref; // URL에서 ref=... 값 (UID)을 가져옵니다.
  if (refId && typeof refId === 'string') {
    isVerifying.value = true;
    referrerStatus.message = "추천인 정보를 확인 중입니다...";
    referrerStatus.type = "";
    try {
      // [★수정★] Firestore 직접 조회 대신 Cloud Function 호출
      const result = await getReferrerNameByUid({ uid: refId });

      if (result.data.success) {
        const referrerName = result.data.name;
        validatedReferrer.uid = refId; // 추천인 UID 저장
        validatedReferrer.name = referrerName; // 추천인 이름 저장
        referrerInput.value = referrerName; // 입력창에 추천인 이름 표시
        referrerStatus.message = `✔️ 추천인 '${referrerName}'님 확인 완료!`;
        referrerStatus.type = "success";
      } else {
        // 함수가 성공했지만 not-found 등 내부 오류를 반환한 경우 (지금 로직에선 throw)
        referrerStatus.message = "유효하지 않은 추천인 링크입니다.";
        referrerStatus.type = "error";
      }
    } catch (err) {
      console.error("추천인 링크 처리 오류:", err);
      referrerStatus.message = "추천인 확인 중 오류가 발생했습니다.";
      referrerStatus.type = "error";
    } finally {
      isVerifying.value = false;
    }
  }
};

onMounted(() => {
  fetchCenters();
  checkReferralLink(); // 페이지 로드 시 URL 검사
});

// [★수정★] 이름/이메일로 추천인을 검증하는 함수
const verifyReferrer = async () => {
  if (!referrerInput.value) return;
  isVerifying.value = true;
  referrerStatus.message = "";
  referrerStatus.type = "";
  try {
    // [★수정★] Firestore 직접 쿼리 대신 Cloud Function 호출
    const result = await findReferrerByNameOrEmail({ input: referrerInput.value });

    if (result.data.success) {
      const { uid, name } = result.data;
      validatedReferrer.uid = uid;
      validatedReferrer.name = name;
      referrerInput.value = name; // 입력창을 이름으로 통일
      referrerStatus.message = `✔️ 추천인 '${name}'님 확인 완료!`;
      referrerStatus.type = "success";
    } else {
      // 함수가 성공했지만 not-found 등 내부 오류를 반환한 경우 (지금 로직에선 throw)
      referrerStatus.message = "존재하지 않는 추천인입니다.";
      referrerStatus.type = "error";
    }
  } catch (err) {
    console.error("추천인 검증 오류:", err);
    // [★수정★] Firebase Functions 오류 메시지를 그대로 표시
    referrerStatus.message = err.message || "검증 중 오류가 발생했습니다.";
    referrerStatus.type = "error";
  } finally {
    isVerifying.value = false;
  }
};

const resetReferrer = () => {
  validatedReferrer.uid = null;
  validatedReferrer.name = null;
  referrerInput.value = "";
  referrerStatus.message = "";
  referrerStatus.type = "";
};

const handleSignup = async () => {
  error.value = null;

  if (password.value !== confirmPassword.value) {
    error.value = "비밀번호가 일치하지 않습니다.";
    return;
  }
  if (!selectedCenterId.value) {
    error.value = "지역(센터)를 선택해주세요.";
    return;
  }
  if (!investmentAmount.value) {
    error.value = "구독 등급을 선택해주세요.";
    return;
  }

  isLoading.value = true;
  try {
    await createUserWithEmailAndPassword(auth, email.value, password.value);
    
    // [★수정★] 'asia-northeast3' 리전 명시
    const createNewUser = httpsCallable(functionsInstance, "createNewUser");

    const selectElement = document.getElementById("investment-amount");
    const selectedTierName = selectElement.options[selectElement.selectedIndex].text;

    const userData = {
      name: name.value,
      phone: phone.value,
      centerId: selectedCenterId.value,
      requestedAmount: Number(investmentAmount.value),
      uplineReferrer: validatedReferrer.uid || null,
      requestedTierName: selectedTierName,
    };

    await createNewUser(userData);
    await auth.signOut();

    alert("회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인해주세요.");
    router.push("/login");

  } catch (err) {
    console.error("회원가입 오류:", err);
    if (err.code === "auth/email-already-in-use") {
      error.value = "이미 가입된 이메일 주소입니다.";
    } else if (err.code && err.message) {
      error.value = `오류가 발생했습니다: ${err.message}`;
    } else {
      error.value = `오류가 발생했습니다: ${err.message || "알 수 없는 오류"}`;
    }
  } finally {
    isLoading.value = false;
  }
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
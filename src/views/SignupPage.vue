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
              :disabled="!!validatedReferrer.uid || isReferrerLoadedFromLink"
            />
            <button
              type="button"
              @click="verifyReferrer"
              class="verify-button"
              :disabled="
                isVerifying ||
                !referrerInput ||
                !!validatedReferrer.uid ||
                isReferrerLoadedFromLink
              "
            >
              <span v-if="isVerifying" class="spinner-small"></span>
              <span v-else>검증</span>
            </button>
          </div>
          <small v-if="!validatedReferrer.uid && !isReferrerLoadedFromLink"
            >추천인의 이메일 또는 이름을 입력 후 '검증'을 눌러주세요.</small
          >
          <p
            v-if="referrerStatus.message"
            :class="['status-message', referrerStatus.type]"
          >
            {{ referrerStatus.message }}
            <span
              v-if="validatedReferrer.uid && !isReferrerLoadedFromLink"
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

<script>
import { ref, onMounted, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { auth, db, functions } from "@/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";

export default {
  name: "SignUpPage",
  setup() {
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
    const isReferrerLoadedFromLink = ref(false);

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

    onMounted(async () => {
      await fetchCenters();
      const refIdFromUrl = route.query.ref;
      if (refIdFromUrl) {
        isVerifying.value = true;
        try {
          const referrerRef = doc(db, "users", refIdFromUrl);
          const docSnap = await getDoc(referrerRef);
          if (docSnap.exists()) {
            validatedReferrer.uid = refIdFromUrl;
            validatedReferrer.name = docSnap.data().name;
            referrerInput.value = docSnap.data().name;
            referrerStatus.message = `✔️ 추천인 '${validatedReferrer.name}'님 확인 완료!`;
            referrerStatus.type = "success";
            isReferrerLoadedFromLink.value = true;
          } else {
            referrerStatus.message = "URL의 추천인 코드가 유효하지 않습니다.";
            referrerStatus.type = "error";
          }
        } catch (error) {
          console.error("URL 추천인 조회 실패:", error);
          referrerStatus.message = "추천인 정보 조회 중 오류가 발생했습니다.";
          referrerStatus.type = "error";
        } finally {
          isVerifying.value = false;
        }
      }
    });

    const verifyReferrer = async () => {
      if (!referrerInput.value) return;
      isVerifying.value = true;
      referrerStatus.message = "";
      referrerStatus.type = "";
      try {
        let q = query(
          collection(db, "users"),
          where("email", "==", referrerInput.value),
          limit(1),
        );
        let querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          q = query(
            collection(db, "users"),
            where("name", "==", referrerInput.value),
            limit(1),
          );
          querySnapshot = await getDocs(q);
        }
        if (querySnapshot.empty) {
          referrerStatus.message = "존재하지 않는 추천인입니다.";
          referrerStatus.type = "error";
        } else {
          const referrerDoc = querySnapshot.docs[0];
          validatedReferrer.uid = referrerDoc.id;
          validatedReferrer.name = referrerDoc.data().name;
          referrerStatus.message = `✔️ 추천인 '${
            validatedReferrer.name
          }'님 확인 완료!`;
          referrerStatus.type = "success";
        }
      } catch (err) {
        console.error("추천인 검증 오류:", err);
        referrerStatus.message = "검증 중 오류가 발생했습니다.";
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

      if (!name.value.trim()) {
        error.value = "이름을 반드시 입력해주세요.";
        return;
      }
      if (!phone.value.trim()) {
        error.value = "전화번호를 반드시 입력해주세요.";
        return;
      }
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
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.value,
          password.value,
        );

        const createNewUser = httpsCallable(functions, "createNewUser");

        const selectElement = document.getElementById("investment-amount");
        const selectedTierName =
          selectElement.options[selectElement.selectedIndex].text;

        const selectedCenter = centers.value.find(
          (c) => c.id === selectedCenterId.value,
        );
        const centerName = selectedCenter ? selectedCenter.name : "";

        const userData = {
          name: name.value,
          phone: phone.value,
          region: centerName,
          centerId: selectedCenterId.value,
          investmentAmount: Number(investmentAmount.value),
          uplineReferrer: validatedReferrer.uid || null,
          tierName: selectedTierName,
        };

        await createNewUser(userData);

        alert("회원가입 신청이 완료되었습니다. 관리자 승인 후 로그인해주세요.");
        await auth.signOut();
        router.push("/login");
      } catch (err) {
        console.error("회원가입 오류:", err);
        if (err.code === "auth/email-already-in-use") {
          error.value = "이미 가입된 이메일 주소입니다.";
        } else {
          error.value = `오류가 발생했습니다: ${err.message}`;
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
      selectedCenterId,
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
      isReferrerLoadedFromLink,
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

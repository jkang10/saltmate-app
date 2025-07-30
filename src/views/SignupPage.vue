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
            autocomplete="email"
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
            autocomplete="new-password"
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
            autocomplete="new-password"
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
            autocomplete="name"
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
            autocomplete="tel"
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
          <div class="referrer-input-group">
            <input
              type="text"
              id="referrer"
              v-model="referrer"
              placeholder="추천인 이메일을 입력하세요"
              autocomplete="off"
            />
            <button
              type="button"
              @click="searchReferrer"
              class="search-btn"
              :disabled="isSearching"
            >
              <span v-if="isSearching">...</span>
              <span v-else>검색</span>
            </button>
          </div>

          <div v-if="searchResults.length > 0" class="search-results">
            <ul>
              <li
                v-for="user in searchResults"
                :key="user.id"
                @click="selectReferrer(user)"
              >
                {{ user.name }} ({{ user.email }})
              </li>
            </ul>
          </div>

          <small>추천인의 이름, 이메일 또는 ID를 수동으로 입력해주세요.</small>
          <small class="referrer-bonus-text">
            추천을 받은 사람은 1,000 SaltMate, 추천한 사람은 300 SaltMate가
            지급됩니다.
          </small>
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
import { auth, db } from "@/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  increment,
  serverTimestamp,
} from "firebase/firestore";

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
    const referrer = ref("");
    const error = ref(null);
    const isLoading = ref(false);
    const searchResults = ref([]);
    const isSearching = ref(false);

    const searchReferrer = async () => {
      const searchTerm = referrer.value.trim();
      if (!searchTerm) {
        alert("검색할 추천인 정보를 입력하세요.");
        return;
      }
      isSearching.value = true;
      searchResults.value = [];
      try {
        const usersRef = collection(db, "users");
        const nameQuery = query(usersRef, where("name", "==", searchTerm));
        const emailQuery = query(usersRef, where("email", "==", searchTerm));
        const [nameSnapshot, emailSnapshot] = await Promise.all([
          getDocs(nameQuery),
          getDocs(emailQuery),
        ]);
        const foundUsers = new Map();
        nameSnapshot.forEach((doc) =>
          foundUsers.set(doc.id, { id: doc.id, ...doc.data() }),
        );
        emailSnapshot.forEach((doc) =>
          foundUsers.set(doc.id, { id: doc.id, ...doc.data() }),
        );
        searchResults.value = Array.from(foundUsers.values());
        if (searchResults.value.length === 0) {
          alert("일치하는 사용자를 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("추천인 검색 오류:", err);
        alert("추천인 검색 중 오류가 발생했습니다.");
      } finally {
        isSearching.value = false;
      }
    };

    const selectReferrer = (user) => {
      referrer.value = user.email;
      searchResults.value = [];
    };

    const handleSignup = async () => {
      error.value = null;
      if (password.value !== confirmPassword.value) {
        error.value = "비밀번호가 일치하지 않습니다.";
        return;
      }

      isLoading.value = true;
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.value,
          password.value,
        );
        const user = userCredential.user;

        const batch = writeBatch(db);
        const newUserRef = doc(db, "users", user.uid);

        let initialPoints = 0;
        let referrerFoundAndProcessed = false;

        if (referrer.value.trim()) {
          const usersRef = collection(db, "users");
          const q = query(
            usersRef,
            where("email", "==", referrer.value.trim()),
          );
          const referrerSnapshot = await getDocs(q);

          if (!referrerSnapshot.empty) {
            const referrerDoc = referrerSnapshot.docs[0];
            const referrerRef = doc(db, "users", referrerDoc.id);

            initialPoints = 1000;
            batch.update(referrerRef, { saltmatePoints: increment(300) });
            referrerFoundAndProcessed = true;
          } else {
            error.value =
              "유효하지 않은 추천인 코드입니다. 추천인 없이 가입이 진행됩니다.";
          }
        }

        batch.set(newUserRef, {
          email: user.email,
          name: name.value,
          phone: phone.value,
          region: region.value,
          investmentAmount: Number(investmentAmount.value),
          createdAt: serverTimestamp(),
          isAdmin: false,
          hasNFT: false,
          saltmateLevel: "basic",
          saltmatePoints: initialPoints,
        });

        await batch.commit();

        alert("회원가입이 성공적으로 완료되었습니다!");
        if (referrerFoundAndProcessed) {
          alert("추천인 보너스로 1,000 SaltMate가 지급되었습니다!");
        }
        router.push("/login");
      } catch (err) {
        console.error("회원가입 오류:", err.code, err.message);
        switch (err.code) {
          case "auth/email-already-in-use":
            error.value = "이미 사용 중인 이메일입니다.";
            break;
          case "auth/weak-password":
            error.value = "비밀번호는 6자 이상이어야 합니다.";
            break;
          default:
            error.value = "회원가입 중 오류가 발생했습니다.";
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
      searchResults,
      isSearching,
      searchReferrer,
      selectReferrer,
    };
  },
};
</script>

<style scoped>
/* 기존 스타일은 여기에 그대로 유지됩니다. */
.signup-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 40px 20px;
}
/* ... (이하 기존 스타일 생략) ... */

/* ▼▼▼ 추천인 검색 관련 스타일만 추가 ▼▼▼ */
.referrer-input-group {
  display: flex;
  gap: 10px;
}
.referrer-input-group input {
  flex: 1;
}
.search-btn {
  padding: 0 15px;
  border: 1px solid #007bff;
  background-color: #007bff;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  flex-shrink: 0;
}
.search-btn:disabled {
  background-color: #a0c9ff;
  border-color: #a0c9ff;
  cursor: not-allowed;
}
.referrer-bonus-text {
  color: #007bff !important;
  font-weight: bold;
  display: block; /* small 태그가 나란히 표시되지 않도록 */
  margin-top: 5px;
}
.search-results {
  border: 1px solid #ddd;
  border-radius: 5px;
  margin-top: 5px;
  max-height: 150px;
  overflow-y: auto;
  background-color: #fff;
}
.search-results ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.search-results li {
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}
.search-results li:last-child {
  border-bottom: none;
}
.search-results li:hover {
  background-color: #e9f5ff;
}
</style>

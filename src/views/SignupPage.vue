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
          <select id="region" v-model="region" required>
            <option value="" disabled>지역(센터)를 선택하세요</option>
            <option
              v-for="center in centers"
              :key="center.id"
              :value="center.name"
            >
              {{ center.name }}
            </option>
          </select>
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
          <div class="referrer-input-wrapper">
            <input
              type="text"
              id="referrer"
              v-model="referrer"
              placeholder="추천인 이름 또는 이메일 입력"
            />
            <button type="button" @click="searchReferrer" class="search-btn">
              검색
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
          <small>
            추천인의 이름, 이메일 또는 ID를 수동으로 입력해주세요.
            <br />
            <strong class="bonus-text"
              >추천 받은 사람은 1,000 SaltMate, 추천한 사람은 300 SaltMate가
              지급됩니다.</strong
            >
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
import { ref, onMounted } from "vue";
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

    // --- 추천인 검색 및 센터 목록을 위한 변수 ---
    const searchResults = ref([]);
    const isSearching = ref(false);
    const centers = ref([]);

    // --- 센터 목록 불러오기 ---
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
    onMounted(fetchCenters);

    // --- 추천인 검색 ---
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

    // --- 회원가입 처리 ---
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
        let referrerFound = false;

        // 추천인 확인 및 포인트 지급 처리
        if (referrer.value.trim()) {
          const usersRef = collection(db, "users");
          const q = query(
            usersRef,
            where("email", "==", referrer.value.trim()),
          );
          const referrerSnapshot = await getDocs(q);

          if (!referrerSnapshot.empty) {
            referrerFound = true;
            const referrerDoc = referrerSnapshot.docs[0];
            const referrerRef = doc(db, "users", referrerDoc.id);

            initialPoints = 1000; // 추천받은 사람
            batch.update(referrerRef, { saltmatePoints: increment(300) }); // 추천한 사람
          } else {
            error.value = "유효하지 않은 추천인입니다. 추천인 없이 가입됩니다.";
          }
        }

        // Firestore에 사용자 정보 저장
        batch.set(newUserRef, {
          email: user.email,
          name: name.value,
          phone: phone.value,
          region: region.value,
          participationAmount: Number(investmentAmount.value),
          createdAt: serverTimestamp(),
          isAdmin: false,
          hasNFT: false,
          saltmatePoints: initialPoints,
          // 기타 필요한 기본 필드들...
        });

        await batch.commit();

        alert("회원가입이 성공적으로 완료되었습니다!");
        if (referrerFound) {
          alert("추천인 포인트가 지급되었습니다!");
        }
        router.push("/login");
      } catch (err) {
        console.error("회원가입 오류:", err);
        error.value = "회원가입 중 오류가 발생했습니다.";
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
      centers,
    };
  },
};
</script>

<style scoped>
/* 기존 스타일을 유지하면서, 검색 관련 UI 스타일만 추가합니다. */
.referrer-input-wrapper {
  display: flex;
}
.search-btn {
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
  padding: 0 15px;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
}
.search-results {
  border: 1px solid #ddd;
  border-top: none;
  max-height: 150px;
  overflow-y: auto;
  background-color: white;
}
.search-results ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.search-results li {
  padding: 10px;
  cursor: pointer;
}
.search-results li:hover {
  background-color: #f0f0f0;
}
.bonus-text {
  color: #007bff;
  font-weight: bold;
}
</style>

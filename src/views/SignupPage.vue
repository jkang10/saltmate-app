<template>
  <div class="signup-page-background">
    <div class="signup-container">
      <h2 class="title"><i class="fas fa-user-plus"></i> 솔트메이트 가입</h2>
      <form @submit.prevent="handleSignup">
        <div class="form-group">
          <input type="email" v-model="email" placeholder="이메일" required />
        </div>
        <div class="form-group">
          <input
            type="password"
            v-model="password"
            placeholder="비밀번호 (6자 이상)"
            required
          />
        </div>
        <div class="form-group">
          <input
            type="password"
            v-model="confirmPassword"
            placeholder="비밀번호 확인"
            required
          />
        </div>
        <div class="form-group">
          <input type="text" v-model="name" placeholder="이름" required />
        </div>
        <div class="form-group">
          <input
            type="tel"
            v-model="phone"
            placeholder="전화번호 (HP) 예: 010-1234-5678"
            required
          />
        </div>
        <div class="form-group">
          <input
            type="text"
            v-model="region"
            placeholder="지역 (센터)"
            required
          />
        </div>
        <div class="form-group">
          <select v-model="investmentAmount" required>
            <option value="">투자금액을 선택하세요</option>
            <option value="10000">만원의 행복</option>
            <option value="100000">10만원</option>
            <option value="300000">30만원</option>
            <option value="500000">50만원</option>
            <option value="1000000">100만원</option>
          </select>
        </div>
        <div class="form-group referrer-group">
          <div class="referrer-input-wrapper">
            <input
              type="text"
              v-model="referrer"
              placeholder="추천인 (선택 사항)"
            />
            <button
              type="button"
              @click="searchReferrer"
              class="search-btn"
              :disabled="isSearching"
            >
              검색
            </button>
          </div>
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="user in searchResults"
              :key="user.id"
              @click="selectReferrer(user)"
              class="result-item"
            >
              {{ user.name }} ({{ user.email }})
            </div>
          </div>
          <small class="info-text"
            >추천인의 이름 또는 이메일을 입력 후 검색하세요.</small
          >
          <small class="bonus-text">
            추천을 받은 사람은 1,000 SaltMate, 추천한 사람은 300 SaltMate가
            행복한 솔트메이트(SaltMate) 게이지에 쌓입니다.
          </small>
        </div>
        <button type="submit" class="signup-btn" :disabled="isLoading">
          <span v-if="isLoading">가입 중...</span>
          <span v-else>가입하기</span>
        </button>
        <p v-if="error" class="error-msg">{{ error }}</p>
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
        let q;
        if (searchTerm.includes("@")) {
          q = query(usersRef, where("email", "==", searchTerm));
        } else {
          q = query(usersRef, where("name", "==", searchTerm));
        }
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          alert("일치하는 사용자를 찾을 수 없습니다.");
        } else {
          querySnapshot.forEach((doc) => {
            searchResults.value.push({ id: doc.id, ...doc.data() });
          });
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
        console.error("회원가입 오류:", err.code);
        error.value = "회원가입 중 오류가 발생했습니다.";
      } finally {
        isLoading.value = false;
      }
    };

    return {
      router,
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
.signup-page-background {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #f0f2f5;
  padding: 20px;
}
.signup-container {
  background: #ffffff;
  padding: 30px 40px;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 450px;
}
.title {
  text-align: center;
  font-size: 1.8em;
  color: #333;
  margin-bottom: 25px;
}
.form-group {
  margin-bottom: 15px;
}
input,
select {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  box-sizing: border-box;
}
.referrer-input-wrapper {
  display: flex;
}
.referrer-input-wrapper input {
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.search-btn {
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
  padding: 0 15px;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  cursor: pointer;
}
.search-results {
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 8px 8px;
}
.result-item {
  padding: 10px 15px;
  cursor: pointer;
}
.result-item:hover {
  background: #f0f0f0;
}
.info-text {
  font-size: 0.8em;
  color: #666;
  margin-top: 5px;
}
.bonus-text {
  font-size: 0.85em;
  color: #007bff;
  font-weight: bold;
  display: block;
  margin-top: 5px;
}
.signup-btn {
  width: 100%;
  padding: 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  margin-top: 10px;
}
.error-msg {
  color: #dc3545;
  text-align: center;
  margin-top: 10px;
}
.login-link {
  text-align: center;
  margin-top: 20px;
  font-size: 0.9em;
}
</style>

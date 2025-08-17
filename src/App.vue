<template>
  <div id="app">
    <header class="navbar card glassmorphism">
      <div class="navbar-container">
        <router-link to="/" class="navbar-brand">
          <img src="@/assets/logo.png" alt="Saltmate Logo" />
          <span>솔트메이트</span>
        </router-link>
        <nav class="navbar-nav" :class="{ 'is-active': isNavActive }">
          <router-link to="/shop" class="nav-link">등급 선택</router-link>
          <router-link to="/my-investments" class="nav-link"
            >내 수익 현황</router-link
          >
          <router-link to="/community" class="nav-link">커뮤니티</router-link>
          <router-link to="/about" class="nav-link"
            >솔트메이트 소개</router-link
          >
        </nav>
        <div class="navbar-actions">
          <div v-if="isLoggedIn" class="user-actions">
            <router-link to="/profile" class="user-profile-link">
              <i class="fas fa-user-circle"></i>
              <span>{{ userName }}</span>
            </router-link>
            <button @click="logout" class="logout-button">
              <i class="fas fa-sign-out-alt"></i> 로그아웃
            </button>
          </div>
          <div v-else>
            <router-link to="/login" class="login-button">로그인</router-link>
          </div>
          <button class="navbar-toggler" @click="toggleNav">
            <i class="fas fa-bars"></i>
          </button>
        </div>
      </div>
    </header>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from "vue";
// ▼▼▼ [수정] firebaseConfig에서 필요한 모듈 추가 import ▼▼▼
import { auth, db, rtdb } from "@/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
// ▼▼▼ [추가] Realtime Database 관련 함수 import ▼▼▼
import {
  ref as dbRef,
  onValue,
  set,
  onDisconnect,
  serverTimestamp,
  remove,
} from "firebase/database";
// ▲▲▲ 추가 완료 ▲▲▲
import { useRouter } from "vue-router";

export default {
  setup() {
    const isLoggedIn = ref(false);
    const userName = ref("");
    const isNavActive = ref(false);
    const router = useRouter();

    let authUnsubscribe = null;
    let presenceRef = null; // [추가] 실시간 DB 참조 저장 변수

    const checkAuthState = () => {
      authUnsubscribe = onAuthStateChanged(auth, async (user) => {
        // ▼▼▼ [수정] 기존 로직에 Presence 관리 로직 추가 ▼▼▼
        if (presenceRef) {
          remove(presenceRef); // 이전 참조가 있다면 제거
          presenceRef = null;
        }

        if (user) {
          isLoggedIn.value = true;

          // 실시간 접속 상태 관리
          presenceRef = dbRef(rtdb, `presence/${user.uid}`);
          const connectedRef = dbRef(rtdb, ".info/connected");

          onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
              // 연결이 설정되면, 연결이 끊어질 때 자동으로 데이터를 삭제하도록 설정
              onDisconnect(presenceRef).remove();
              // 현재 사용자를 온라인으로 설정
              set(presenceRef, { onlineAt: serverTimestamp() });
            }
          });

          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              userName.value = userSnap.data().name || "사용자";
            }
          } catch (error) {
            console.error("사용자 이름을 가져오는 중 오류 발생:", error);
            userName.value = "사용자";
          }
        } else {
          isLoggedIn.value = false;
          userName.value = "";
        }
        // ▲▲▲ 수정 완료 ▲▲▲
      });
    };

    const logout = async () => {
      try {
        // ▼▼▼ [추가] 로그아웃 시 presence 정보 즉시 제거 ▼▼▼
        if (auth.currentUser && presenceRef) {
          await remove(dbRef(rtdb, `presence/${auth.currentUser.uid}`));
        }
        // ▲▲▲ 추가 완료 ▲▲▲
        await signOut(auth);
        alert("로그아웃 되었습니다.");
        router.push("/login");
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    };

    const toggleNav = () => {
      isNavActive.value = !isNavActive.value;
    };

    onMounted(() => {
      checkAuthState();
    });

    onUnmounted(() => {
      if (authUnsubscribe) {
        authUnsubscribe();
      }
      // ▼▼▼ [추가] 컴포넌트 파괴 시 presence 정보 제거 ▼▼▼
      if (auth.currentUser && presenceRef) {
        remove(dbRef(rtdb, `presence/${auth.currentUser.uid}`));
      }
      // ▲▲▲ 추가 완료 ▲▲▲
    });

    watch(
      () => router.currentRoute.value,
      () => {
        isNavActive.value = false;
      },
    );

    return {
      isLoggedIn,
      userName,
      logout,
      isNavActive,
      toggleNav,
    };
  },
};
</script>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f8f9fa;
}

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.navbar-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar-brand {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #333;
  font-size: 1.5em;
  font-weight: bold;
}

.navbar-brand img {
  height: 40px;
  margin-right: 10px;
}

.navbar-nav {
  display: flex;
  gap: 25px;
}

.nav-link {
  text-decoration: none;
  color: #555;
  font-weight: 500;
  padding: 5px 0;
  position: relative;
  transition: color 0.3s;
}

.nav-link::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: #007bff;
  transition: width 0.3s;
}

.nav-link:hover,
.nav-link.router-link-exact-active {
  color: #007bff;
}

.nav-link:hover::after,
.nav-link.router-link-exact-active::after {
  width: 100%;
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-profile-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #333;
  font-weight: 500;
}

.logout-button,
.login-button {
  padding: 8px 15px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
  transition:
    background-color 0.3s,
    color 0.3s;
}

.logout-button {
  background-color: #f8f9fa;
  color: #dc3545;
  border: 1px solid #dc3545;
}

.logout-button:hover {
  background-color: #dc3545;
  color: white;
}

.login-button {
  background-color: #007bff;
  color: white;
  text-decoration: none;
}

.login-button:hover {
  background-color: #0056b3;
}

.navbar-toggler {
  display: none;
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
}

.main-content {
  flex: 1;
  margin-top: 70px; /* Navbar height */
}

@media (max-width: 992px) {
  .navbar-nav {
    display: none;
    position: absolute;
    top: 70px;
    left: 0;
    width: 100%;
    background-color: white;
    flex-direction: column;
    padding: 20px;
    box-shadow: 0 10px 10px rgba(0, 0, 0, 0.1);
  }
  .navbar-nav.is-active {
    display: flex;
  }
  .navbar-toggler {
    display: block;
  }
}
</style>

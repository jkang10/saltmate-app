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
import { auth, db, rtdb } from "@/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  ref as dbRef,
  onValue,
  set,
  onDisconnect,
  remove,
} from "firebase/database";
import { useRouter } from "vue-router";

export default {
  setup() {
    const isLoggedIn = ref(false);
    const userName = ref("");
    const isNavActive = ref(false);
    const router = useRouter();

    let authUnsubscribe = null;
    let presenceRef = null;

    const managePresence = (user) => {
      if (user) {
        // 사용자가 로그인하면, presence 경로에 자신의 UID를 키로 하여 true 값을 씁니다.
        presenceRef = dbRef(rtdb, `presence/${user.uid}`);
        const connectedRef = dbRef(rtdb, ".info/connected");

        onValue(connectedRef, (snap) => {
          if (snap.val() === true) {
            // 사용자의 인터넷 연결이 끊어지면(onDisconnect), 자동으로 자신의 기록을 삭제하도록 설정합니다.
            onDisconnect(presenceRef).remove();
            // 현재 접속 상태임을 기록합니다.
            set(presenceRef, true);
          }
        });
      } else {
        // 사용자가 로그아웃하면, 자신의 기록을 즉시 삭제합니다.
        if (presenceRef) {
          remove(presenceRef);
          presenceRef = null;
        }
      }
    };

    const checkAuthState = () => {
      authUnsubscribe = onAuthStateChanged(auth, async (user) => {
        managePresence(user); // 로그인/로그아웃 시 접속 상태 관리 함수 호출

        if (user) {
          isLoggedIn.value = true;
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
      });
    };

    const logout = async () => {
      try {
        // 로그아웃 시에도 접속 기록을 확실히 제거합니다.
        if (auth.currentUser) {
          const userPresenceRef = dbRef(
            rtdb,
            `presence/${auth.currentUser.uid}`,
          );
          await remove(userPresenceRef);
        }
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
      // 페이지를 떠날 때도 접속 기록을 제거합니다.
      if (auth.currentUser) {
        const userPresenceRef = dbRef(rtdb, `presence/${auth.currentUser.uid}`);
        remove(userPresenceRef);
      }
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

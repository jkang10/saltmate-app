<template>
  <nav
    :class="{ 'navbar-container': true, 'navbar-expanded': isMobileMenuOpen }"
  >
    <div class="navbar-brand">
      <router-link :to="user ? '/dashboard' : '/login'" class="logo"
        >솔트메이트</router-link
      >
    </div>

    <button class="hamburger-menu" @click="toggleMobileMenu">
      <i class="fas fa-bars"></i>
    </button>

    <div :class="{ 'navbar-menu': true, 'is-active': isMobileMenuOpen }">
      <ul class="navbar-links" @click="closeMobileMenu">
        <template v-if="!userProfile?.isAdmin">
          <li>
            <router-link to="/shop" class="nav-link">투자 상품</router-link>
          </li>
          <li>
            <router-link to="/my-investments" class="nav-link"
              >내 투자 현황</router-link
            >
          </li>
          <li>
            <router-link to="/nft-marketplace" class="nav-link"
              >NFT 마켓플레이스</router-link
            >
          </li>
        </template>

        <li>
          <router-link to="/community" class="nav-link">커뮤니티</router-link>
        </li>
        <li>
          <router-link to="/about" class="nav-link"
            >솔트메이트 소개</router-link
          >
        </li>

        <template v-if="!user">
          <li>
            <router-link to="/login" class="nav-link primary-button"
              >로그인</router-link
            >
          </li>
          <li>
            <router-link to="/signup" class="nav-link outline-button"
              >회원가입</router-link
            >
          </li>
        </template>

        <template v-if="user">
          <li v-if="!userProfile?.isAdmin">
            <router-link to="/profile" class="nav-link user-profile">
              <i class="fas fa-user-circle"></i>
              {{ userProfile?.name || user.email }}
            </router-link>
          </li>
          <li v-if="userProfile?.isAdmin">
            <router-link
              to="/admin-dashboard"
              class="nav-link admin-dashboard-link"
            >
              <i class="fas fa-tools"></i> 관리자 대시보드
            </router-link>
          </li>
          <li>
            <button @click="handleLogout" class="nav-link logout-button">
              <i class="fas fa-sign-out-alt"></i> 로그아웃
            </button>
          </li>
        </template>
      </ul>
    </div>
  </nav>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "@/firebaseConfig"; // db 임포트 추가
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore"; // onSnapshot 임포트 추가

export default {
  name: "AppNavbar",
  setup() {
    const router = useRouter();
    const user = ref(null);
    const isMobileMenuOpen = ref(false);

    // ▼▼▼ 사용자 프로필 정보 추가 ▼▼▼
    const userProfile = ref(null);
    let unsubscribeAuth = null;
    let unsubscribeProfile = null; // 프로필 실시간 리스너 구독 해제 함수
    // ▲▲▲

    // ▼▼▼ 기존 isAdmin 로직을 Firestore에서 가져오도록 변경 ▼▼▼
    const isAdmin = computed(() => userProfile.value?.isAdmin === true);
    // ▲▲▲

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;

        // 이전에 구독한 프로필 리스너가 있다면 해제
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (currentUser) {
          // 로그인 시 Firestore에서 사용자 프로필 실시간 감지
          const userDocRef = doc(db, "users", currentUser.uid);
          unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              userProfile.value = docSnap.data();
            } else {
              userProfile.value = null; // 문서가 없는 경우
            }
          });
        } else {
          // 로그아웃 시 프로필 정보 초기화
          userProfile.value = null;
        }
      });
    });

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    });
    // ▲▲▲

    const handleLogout = async () => {
      try {
        await signOut(auth);
        alert("로그아웃 되었습니다.");
        router.push("/login");
        closeMobileMenu();
      } catch (error) {
        console.error("로그아웃 오류:", error);
        alert("로그아웃에 실패했습니다.");
      }
    };

    const toggleMobileMenu = () => {
      isMobileMenuOpen.value = !isMobileMenuOpen.value;
    };

    const closeMobileMenu = () => {
      isMobileMenuOpen.value = false;
    };

    return {
      user,
      isAdmin, // isAdmin은 userProfile을 통해 계산되도록 변경됨
      userProfile, // 템플릿에서 이름을 사용하기 위해 반환
      isMobileMenuOpen,
      handleLogout,
      toggleMobileMenu,
      closeMobileMenu,
    };
  },
};
</script>

<style scoped>
.navbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
  transition: all 0.3s ease-in-out;
}

.navbar-brand .logo {
  font-size: 1.8em;
  font-weight: bold;
  color: white;
  text-decoration: none;
  letter-spacing: 1px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
}

.navbar-menu {
  display: flex;
  align-items: center;
}

.navbar-links {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  align-items: center;
  flex-wrap: nowrap;
}

.navbar-links li {
  margin-left: 15px;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-size: 1.1em;
  padding: 8px 12px;
  border-radius: 5px;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.nav-link.router-link-exact-active {
  background-color: rgba(255, 255, 255, 0.3);
  font-weight: bold;
}

.primary-button {
  background-color: #28a745;
  padding: 10px 18px;
}
.primary-button:hover {
  background-color: #218838;
}

.outline-button {
  border: 1px solid white;
  padding: 10px 18px;
}
.outline-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.logout-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  color: white;
  font-size: 1.1em;
}
.logout-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.user-profile,
.admin-dashboard-link {
  background-color: rgba(255, 255, 255, 0.15);
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: 500;
}
.user-profile:hover,
.admin-dashboard-link:hover {
  background-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.hamburger-menu {
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 1.8em;
  cursor: pointer;
}

/* 모바일 반응형 */
@media (max-width: 992px) {
  .navbar-container {
    flex-wrap: wrap;
    padding: 15px 20px;
  }

  .hamburger-menu {
    display: block;
  }

  .navbar-menu {
    flex-direction: column;
    width: 100%;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
  }

  .navbar-menu.is-active {
    max-height: 500px;
  }

  .navbar-links {
    flex-direction: column;
    width: 100%;
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    flex-wrap: nowrap;
  }

  .navbar-links li {
    margin: 10px 0;
    width: 100%;
    text-align: center;
  }

  .nav-link {
    display: block;
    width: 100%;
    padding: 12px 0;
    border-radius: 0;
    white-space: normal;
  }

  .primary-button,
  .outline-button {
    padding: 12px 0;
    border-radius: 8px;
  }

  .user-profile,
  .admin-dashboard-link {
    width: auto;
    margin: 0 auto;
  }
}

@media (max-width: 576px) {
  .navbar-brand .logo {
    font-size: 1.5em;
  }
}
</style>

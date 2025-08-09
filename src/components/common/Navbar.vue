<template>
  <nav
    :class="{ 'navbar-container': true, 'navbar-expanded': isMobileMenuOpen }"
  >
    <div class="navbar-brand">
      <router-link :to="logoLink" class="logo">솔트메이트</router-link>
    </div>
    <button class="hamburger-menu" @click="toggleMobileMenu">
      <i class="fas fa-bars"></i>
    </button>
    <div :class="{ 'navbar-menu': true, 'is-active': isMobileMenuOpen }">
      <ul class="navbar-links" @click="closeMobileMenu">
        <template v-if="isAdmin">
          <li>
            <router-link to="/admin-dashboard" class="nav-link admin-main-link">
              <i class="fas fa-tools"></i> 관리자 대시보드
            </router-link>
          </li>
        </template>
        <template v-if="!isAdmin">
          <li>
            <router-link to="/shop" class="nav-link">등급 선택</router-link>
          </li>
          <li>
            <router-link to="/my-investments" class="nav-link"
              >내 수익 현황</router-link
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
        </template>
        <template v-if="user">
          <li v-if="!isAdmin" class="nav-link welcome-text">
            <span>환영합니다,</span>
            <router-link to="/profile" class="user-profile-link">
              {{ userProfile?.name || user.email }}
            </router-link>
          </li>
          <li v-if="isAdmin" class="nav-link welcome-text">
            <span>환영합니다,</span>
            <span class="user-profile-link admin">{{
              userProfile?.name || "관리자"
            }}</span>
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
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

export default {
  name: "AppNavbar",
  setup() {
    const router = useRouter();
    const user = ref(null);
    const isMobileMenuOpen = ref(false);
    const userProfile = ref(null);
    const isAdmin = ref(false);
    let unsubscribeAuth = null;
    let unsubscribeProfile = null;

    const logoLink = computed(() => {
      if (!user.value) return "/login";
      return isAdmin.value ? "/admin-dashboard" : "/dashboard";
    });

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
        user.value = currentUser;
        if (unsubscribeProfile) unsubscribeProfile();
        if (currentUser) {
          const idTokenResult = await currentUser.getIdTokenResult(true);
          isAdmin.value = idTokenResult.claims.admin === true;
          const userDocRef = doc(db, "users", currentUser.uid);
          unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            userProfile.value = docSnap.exists() ? docSnap.data() : null;
          });
        } else {
          userProfile.value = null;
          isAdmin.value = false;
        }
      });
    });

    onUnmounted(() => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    });

    const handleLogout = async () => {
      try {
        await signOut(auth);
        router.push("/login");
      } catch (error) {
        console.error("로그아웃 오류:", error);
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
      userProfile,
      isAdmin,
      isMobileMenuOpen,
      logoLink,
      handleLogout,
      toggleMobileMenu,
      closeMobileMenu,
    };
  },
};
</script>

<style scoped>
/* 기존 스타일은 변경 없습니다 */
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
.logout-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  color: white;
  font-size: 1.1em;
}
.admin-main-link {
  font-weight: bold;
  background-color: hsla(0, 0%, 100%, 0.2);
}
.hamburger-menu {
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 1.8em;
  cursor: pointer;
}
.welcome-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  white-space: nowrap;
  padding: 8px 0;
}
.user-profile-link {
  font-weight: bold;
  color: white;
  text-decoration: none;
  background-color: rgba(255, 255, 255, 0.15);
  padding: 6px 12px;
  border-radius: 20px;
  transition: background-color 0.3s ease;
}
.user-profile-link:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
.user-profile-link.admin {
  cursor: default;
}
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
  }
  .primary-button {
    padding: 12px 0;
    border-radius: 8px;
  }
}
@media (max-width: 576px) {
  .navbar-brand .logo {
    font-size: 1.5em;
  }
}
</style>

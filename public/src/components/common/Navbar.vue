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
        <li v-if="!isAdmin">
          <router-link to="/shop" class="nav-link">투자 상품</router-link>
        </li>
        <li v-if="!isAdmin">
          <router-link to="/my-investments" class="nav-link"
            >내 투자 현황</router-link
          >
        </li>
        <li>
          <router-link to="/community" class="nav-link">커뮤니티</router-link>
        </li>
        <li v-if="user && !isAdmin">
          <router-link to="/nft-marketplace" class="nav-link"
            >NFT 마켓플레이스</router-link
          >
        </li>
        <li>
          <router-link to="/about" class="nav-link"
            >솔트메이트 소개</router-link
          >
        </li>
        <li v-if="!user">
          <router-link to="/login" class="nav-link primary-button"
            >로그인</router-link
          >
        </li>
        <li v-if="!user">
          <router-link to="/signup" class="nav-link outline-button"
            >회원가입</router-link
          >
        </li>
        <li v-if="user && !isAdmin">
          <router-link to="/profile" class="nav-link user-profile">
            <i class="fas fa-user-circle"></i> {{ user.email }}
          </router-link>
        </li>
        <li v-if="user && isAdmin">
          <router-link
            to="/admin-dashboard"
            class="nav-link admin-dashboard-link"
          >
            <i class="fas fa-tools"></i> 관리자 대시보드
          </router-link>
        </li>
        <li v-if="user">
          <button @click="handleLogout" class="nav-link logout-button">
            <i class="fas fa-sign-out-alt"></i> 로그아웃
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { auth } from "@/firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default {
  name: "AppNavbar",
  setup() {
    const router = useRouter();
    const user = ref(null);
    const isAdmin = ref(false);
    const isMobileMenuOpen = ref(false);

    const ADMIN_EMAILS = ["admin@admin.com"]; // 실제 배포 시에는 Firestore 등에서 관리하는 것이 더 안전하고 유연합니다.

    let unsubscribeAuth = null;
    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;
        isAdmin.value = currentUser && ADMIN_EMAILS.includes(currentUser.email);
      });
    });

    onUnmounted(() => {
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    });

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
      isAdmin,
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
  transition: background-color 0.3s ease, transform 0.2s ease,
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

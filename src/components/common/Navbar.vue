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
        <template v-if="!userProfile?.isAdmin">
          <li>
            <router-link to="/shop" class="nav-link">투자 상품</router-link>
          </li>
          <li>
            <router-link to="/my-investments" class="nav-link"
              >내 투자 현황</router-link
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
    let unsubscribeAuth = null;
    let unsubscribeProfile = null;

    const isAdmin = computed(() => userProfile.value?.isAdmin === true);

    // ▼▼▼ [신규] 관리자 여부에 따라 로고 링크를 동적으로 반환하는 computed 속성 추가 ▼▼▼
    const logoLink = computed(() => {
      if (!user.value) {
        return "/login"; // 비로그인 시 로그인 페이지로
      }
      return userProfile.value?.isAdmin ? "/admin-dashboard" : "/dashboard";
    });
    // ▲▲▲ 추가 완료 ▲▲▲

    onMounted(() => {
      unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        user.value = currentUser;

        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (currentUser) {
          const userDocRef = doc(db, "users", currentUser.uid);
          unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              userProfile.value = docSnap.data();
            } else {
              userProfile.value = null;
            }
          });
        } else {
          userProfile.value = null;
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
      userProfile,
      isMobileMenuOpen,
      logoLink, // [수정] 템플릿에서 사용할 수 있도록 반환
      handleLogout,
      toggleMobileMenu,
      closeMobileMenu,
    };
  },
};
</script>

<style scoped>
/* 기존 스타일과 동일 (변경 없음) */
.navbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: linear-gradient(90deg, #6a82fb, #fc5c7d);
  color: #fff;
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
  font-weight: 700;
  color: #fff;
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
  color: #fff;
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
  background-color: hsla(0, 0%, 100%, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}
.nav-link.router-link-exact-active {
  background-color: hsla(0, 0%, 100%, 0.3);
  font-weight: 700;
}
.primary-button {
  background-color: #28a745;
  padding: 10px 18px;
}
.primary-button:hover {
  background-color: #218838;
}
.outline-button {
  border: 1px solid #fff;
  padding: 10px 18px;
}
.outline-button:hover {
  background-color: hsla(0, 0%, 100%, 0.1);
}
.logout-button {
  background: 0 0;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  color: #fff;
  font-size: 1.1em;
}
.logout-button:hover {
  background-color: hsla(0, 0%, 100%, 0.2);
  transform: translateY(-2px);
}
.admin-dashboard-link,
.user-profile {
  background-color: hsla(0, 0%, 100%, 0.15);
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: 500;
}
.admin-dashboard-link:hover,
.user-profile:hover {
  background-color: hsla(0, 0%, 100%, 0.3);
  transform: translateY(-2px);
}
.hamburger-menu {
  display: none;
  background: 0 0;
  border: none;
  color: #fff;
  font-size: 1.8em;
  cursor: pointer;
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
    border-top: 1px solid hsla(0, 0%, 100%, 0.2);
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
  .outline-button,
  .primary-button {
    padding: 12px 0;
    border-radius: 8px;
  }
  .admin-dashboard-link,
  .user-profile {
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

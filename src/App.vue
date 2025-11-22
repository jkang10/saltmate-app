<template>
  <div id="app" :class="{ 'game-mode': isGamePage }">
    
    <header class="navbar glassmorphism" :class="{ 'navbar-hidden': !isHeaderVisible }">
      <div class="navbar-inner">
        
        <router-link to="/" class="nav-logo">
          <img src="@/assets/logo.png" alt="Logo" />
          <span class="logo-text">SaltMate</span>
        </router-link>

        <div v-if="isLoggedIn" class="nav-ticker">
          <router-link to="/salt-trader" class="ticker-content">
            <span class="ticker-name">SALT</span>
            <span class="ticker-price">{{ saltPriceFormatted }}</span>
            <span class="ticker-delta" :class="priceClass">
              {{ priceChangeFormatted > 0 ? '+' : '' }}{{ priceChangeFormatted }}
            </span>
          </router-link>
        </div>

        <div class="nav-right">
          <template v-if="isLoggedIn">
            <div class="profile-wrapper" @click="toggleProfileMenu" ref="profileMenuRef">
              <div class="avatar-circle">
                <i class="fas fa-user"></i>
              </div>
              <transition name="fade">
                <div v-if="isProfileMenuOpen" class="dropdown-menu">
                  <div class="user-info">
                    <span class="user-name">{{ userName }}</span>님
                  </div>
                  <hr />
                  <router-link to="/profile" class="dropdown-item" @click="closeProfileMenu">
                    <i class="fas fa-id-card"></i> 내 프로필
                  </router-link>
                  <div class="mobile-nav-links">
                    <router-link to="/mall" class="dropdown-item" @click="closeProfileMenu">💎 몰</router-link>
                    <router-link to="/community" class="dropdown-item" @click="closeProfileMenu">💬 커뮤니티</router-link>
                    <router-link to="/help" class="dropdown-item" @click="closeProfileMenu">❓ 도움말</router-link>
                  </div>
                  <hr />
                  <button @click="logout" class="dropdown-item logout">
                    <i class="fas fa-sign-out-alt"></i> 로그아웃
                  </button>
                </div>
              </transition>
            </div>
          </template>
          <template v-else>
            <router-link to="/login" class="login-btn">로그인</router-link>
          </template>
        </div>

      </div>
    </header>

    <router-link to="/salt-pang-pvp" v-if="isLoggedIn && matchmakingQueueCount > 0 && !isGamePage" class="fab-matchmaking-button" title="대전 참여">
      <div class="pulse-ring"></div>
      <i class="fas fa-fist-raised"></i>
      <span class="fab-badge">{{ matchmakingQueueCount }}</span>
    </router-link>

    <main class="main-content">
      <router-view />
    </main>

    <button v-if="userRole === 'centerManager' && !isGamePage" @click="generateQR" class="fab-qr-button">
      <i class="fas fa-qrcode"></i>
    </button>

    <div v-if="qrModal.visible" class="modal-overlay" @click.self="closeQrModal">
      <div class="modal-content">
        <header class="modal-header">
          <h3>방문 인증 QR</h3>
          <button @click="closeQrModal" class="close-button">&times;</button>
        </header>
        <div class="modal-body">
          <div v-if="qrModal.isLoading" class="loading-spinner"></div>
          <div v-else-if="qrModal.qrId" class="qr-code-container">
            <qrcode-vue :value="qrModal.qrId" :size="250" level="H" />
            <p class="qr-info">5분간 유효 / 1회 사용</p>
          </div>
          <p v-else class="qr-error">{{ qrModal.error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, reactive, computed } from "vue";
import { auth, db, functions, rtdb } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { ref as dbRef, onValue, set, onDisconnect, remove } from "firebase/database";
import { useRouter, useRoute } from "vue-router";
import QrcodeVue from 'qrcode.vue';

const router = useRouter();
const route = useRoute();
const isLoggedIn = ref(false);
const userName = ref("");
const userRole = ref(null);
const isProfileMenuOpen = ref(false); 
const profileMenuRef = ref(null); 

// [추가] 스크롤 관련 상태 변수
const isHeaderVisible = ref(true);
let lastScrollPosition = 0;

const qrModal = reactive({
  visible: false,
  isLoading: false,
  qrId: null,
  error: null,
});

const market = ref({ currentPrice: 0, priceHistory: [] });
const saltPrice = ref(0);
const matchmakingQueueCount = ref(0);

let saltPriceUnsubscribe = null;
let authUnsubscribe = null;
let presenceRef = null;
let matchmakingUnsubscribe = null;

const isGamePage = computed(() => route.meta.isGamePage === true);

const saltPriceFormatted = computed(() => (saltPrice.value || 0).toFixed(3));
const priceChangeValue = computed(() => {
  const history = market.value?.priceHistory || [];
  if (history.length < 2) return 0;
  const oldPrice = history[0]?.price || saltPrice.value;
  return saltPrice.value - oldPrice;
});
const priceChangeFormatted = computed(() => Number(priceChangeValue.value.toFixed(3)));
const priceClass = computed(() => {
  if (priceChangeValue.value > 0) return 'up';
  if (priceChangeValue.value < 0) return 'down';
  return '';
});

const toggleProfileMenu = () => { isProfileMenuOpen.value = !isProfileMenuOpen.value; };
const closeProfileMenu = () => { isProfileMenuOpen.value = false; };

const handleClickOutside = (event) => {
  if (profileMenuRef.value && !profileMenuRef.value.contains(event.target)) {
    isProfileMenuOpen.value = false;
  }
};

// [추가] 스크롤 핸들러 함수
const handleScroll = () => {
  const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
  
  if (currentScrollPosition < 0) {
    return; // iOS 바운스 효과 무시
  }

  // 스크롤을 내리는 중이고, 일정 높이(60px) 이상 내려갔을 때 숨김
  if (Math.abs(currentScrollPosition - lastScrollPosition) < 10) {
    // 작은 변화는 무시 (떨림 방지)
    return;
  }

  if (currentScrollPosition > lastScrollPosition && currentScrollPosition > 60) {
    // 아래로 스크롤 중
    isHeaderVisible.value = false;
    isProfileMenuOpen.value = false; // 스크롤 시 드롭다운 닫기
  } else {
    // 위로 스크롤 중
    isHeaderVisible.value = true;
  }
  
  lastScrollPosition = currentScrollPosition;
};

const managePresence = (user) => {
  if (user) {
    presenceRef = dbRef(rtdb, `presence/${user.uid}`);
    const connectedRef = dbRef(rtdb, ".info/connected");
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(presenceRef).remove();
        set(presenceRef, true);
      }
    });
  } else {
    if (presenceRef) {
      remove(presenceRef);
      presenceRef = null;
    }
  }
};
const listenToSaltPrice = () => {
  const marketRef = doc(db, "configuration", "saltMarket");
  saltPriceUnsubscribe = onSnapshot(marketRef, (docSnap) => {
    if (docSnap.exists()) {
      market.value = docSnap.data();
      saltPrice.value = market.value.currentPrice;
    }
  });
};
const listenToMatchmakingQueue = () => {
  const statsRef = doc(db, 'matchmakingQueue', '--stats--');
  matchmakingUnsubscribe = onSnapshot(statsRef, (docSnap) => {
    if (docSnap.exists()) {
      const count = docSnap.data().count;
      matchmakingQueueCount.value = count > 0 ? count : 0;
    } else {
      matchmakingQueueCount.value = 0;
    }
  });
};
const checkAuthState = () => {
  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    managePresence(user);
    if (user) {
      isLoggedIn.value = true;
      listenToSaltPrice(); 
      listenToMatchmakingQueue();
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          userName.value = userData.name || "사용자";
          userRole.value = userData.role || 'user';
        }
      } catch (error) {
        userName.value = "사용자";
      }
    } else {
      isLoggedIn.value = false;
      userName.value = "";
      userRole.value = null;
    }
  });
};
const generateQR = async () => {
  qrModal.visible = true;
  qrModal.isLoading = true;
  try {
    const generateFunc = httpsCallable(functions, "generateCenterQRCode");
    const result = await generateFunc();
    if (result.data.success) {
      const baseUrl = window.location.origin;
      qrModal.qrId = `${baseUrl}/qr-scanner?qrId=${result.data.qrId}`;
    }
  } catch (error) {
    qrModal.error = "QR 생성 실패";
  } finally {
    qrModal.isLoading = false;
  }
};
const closeQrModal = () => { qrModal.visible = false; };
const logout = async () => {
  try {
    closeProfileMenu();
    await signOut(auth);
    router.push("/login");
  } catch (error) { console.error(error); }
};

onMounted(() => {
  checkAuthState();
  document.addEventListener('click', handleClickOutside);
  // [추가] 스크롤 리스너 등록
  window.addEventListener('scroll', handleScroll);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  // [추가] 스크롤 리스너 제거
  window.removeEventListener('scroll', handleScroll);
  if (authUnsubscribe) authUnsubscribe();
  if (saltPriceUnsubscribe) saltPriceUnsubscribe();
  if (matchmakingUnsubscribe) matchmakingUnsubscribe();
});
watch(() => router.currentRoute.value, () => {
  isProfileMenuOpen.value = false;
});
</script>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f8f9fa;
}

/* Navbar 스타일 */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 56px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  display: flex;
  align-items: center;
  padding: 0 16px;
  
  /* [추가] 부드러운 이동 애니메이션 */
  transition: transform 0.3s ease-in-out;
}

/* [추가] 헤더가 숨겨질 때 적용되는 클래스 */
.navbar.navbar-hidden {
  transform: translateY(-100%);
}

.navbar-inner {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
}

.nav-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #333;
  font-weight: bold;
  font-size: 1.2rem;
}
.nav-logo img {
  height: 28px;
  margin-right: 6px;
}

.nav-ticker {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background-color: #f1f3f5;
  padding: 4px 12px;
  border-radius: 16px;
  white-space: nowrap;
}
.ticker-content {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: #333;
  font-size: 0.9rem;
  font-family: monospace;
  font-weight: 600;
}
.ticker-name { color: #007bff; }
.ticker-delta.up { color: #e74c3c; }
.ticker-delta.down { color: #007bff; }

.nav-right {
  display: flex;
  align-items: center;
}
.profile-wrapper {
  position: relative;
  cursor: pointer;
}
.avatar-circle {
  width: 36px;
  height: 36px;
  background-color: #e9ecef;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #495057;
  font-size: 1.1rem;
  transition: background 0.2s;
}
.avatar-circle:hover {
  background-color: #dee2e6;
}

.dropdown-menu {
  position: absolute;
  top: 45px;
  right: 0;
  width: 200px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 1001;
  border: 1px solid #eee;
}
.user-info {
  padding: 8px 12px;
  font-weight: bold;
  color: #333;
  background-color: #f8f9fa;
  border-radius: 8px;
  font-size: 0.95rem;
}
.dropdown-item {
  padding: 10px 12px;
  text-decoration: none;
  color: #555;
  font-size: 0.9rem;
  border-radius: 8px;
  transition: background 0.2s;
  display: block;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
}
.dropdown-item:hover {
  background-color: #f1f3f5;
  color: #007bff;
}
.dropdown-item.logout {
  color: #e74c3c;
}
hr {
  border: 0;
  border-top: 1px solid #eee;
  margin: 4px 0;
}

.main-content {
  flex: 1;
  margin-top: 56px;
}

#app.game-mode .navbar {
  background: rgba(255,255,255,0.7);
}

@media (max-width: 768px) {
  .logo-text {
    display: none; 
  }
  .nav-logo img {
    height: 32px; 
  }
  .ticker-name {
    display: none; 
  }
  .nav-ticker {
    font-size: 0.85rem;
    padding: 4px 10px;
  }
  
  .mobile-nav-links {
    display: block;
  }
}

@media (min-width: 769px) {
  .mobile-nav-links {
    display: block; 
  }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fab-matchmaking-button, .fab-qr-button { /* 기존 스타일 */ }
.modal-overlay { /* 기존 스타일 */ }
.login-btn {
  background-color: #007bff;
  color: white;
  padding: 6px 14px;
  border-radius: 16px;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: bold;
}
</style>
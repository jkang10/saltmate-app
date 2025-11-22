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
                    <router-link to="/about" class="dropdown-item" @click="closeProfileMenu">ℹ️ 솔트메이트 소개</router-link>
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
    
    <div class="ticker-container" :class="{ 'ticker-up': !isHeaderVisible }">
      <AnnouncementTicker />
    </div>

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
import AnnouncementTicker from '@/components/AnnouncementTicker.vue'; // [추가]

const router = useRouter();
const route = useRoute();
const isLoggedIn = ref(false);
const userName = ref("");
const userRole = ref(null);
const isProfileMenuOpen = ref(false); 
const profileMenuRef = ref(null); 

// 스크롤 관련
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

const handleScroll = () => {
  const currentScrollPosition = window.scrollY || document.documentElement.scrollTop;
  if (currentScrollPosition < 0) return;
  if (Math.abs(currentScrollPosition - lastScrollPosition) < 10) return;

  if (currentScrollPosition > lastScrollPosition && currentScrollPosition > 60) {
    isHeaderVisible.value = false;
    isProfileMenuOpen.value = false;
  } else {
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
  window.addEventListener('scroll', handleScroll);
});
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
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
:global(body) {
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box; 
}

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
  background: rgba(255, 255, 255, 0.98);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  display: flex;
  align-items: center;
  padding: 0 16px; 
  transition: transform 0.3s ease-in-out;
}

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

/* 로고 */
.nav-logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #333;
  font-weight: bold;
  font-size: 1.1rem;
}
.nav-logo img {
  height: 26px;
  margin-right: 6px;
}

/* 시세 티커 (중앙) */
.nav-ticker {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background-color: #f1f3f5;
  padding: 4px 10px;
  border-radius: 16px;
  white-space: nowrap;
  max-width: 45%; 
  overflow: hidden;
  text-overflow: ellipsis;
}
.ticker-content {
  display: flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  color: #333;
  font-size: 0.9rem;
  font-family: monospace;
  font-weight: 600;
  justify-content: center;
}
.ticker-name { color: #007bff; } 
.ticker-delta.up { color: #e74c3c; }
.ticker-delta.down { color: #007bff; }

/* 우측 영역 */
.nav-right {
  display: flex;
  align-items: center;
}
.profile-wrapper {
  position: relative;
  cursor: pointer;
  padding-left: 5px; 
}
.avatar-circle {
  width: 34px;
  height: 34px;
  background-color: #e9ecef;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #495057;
  font-size: 1rem;
  transition: background 0.2s;
}

/* 드롭다운 */
.dropdown-menu {
  position: absolute;
  top: 45px;
  right: 0;
  width: 180px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 1001;
  border: 1px solid #eee;
}
.user-info {
  padding: 8px;
  font-weight: bold;
  color: #333;
  background-color: #f8f9fa;
  border-radius: 6px;
  font-size: 0.9rem;
}
.dropdown-item {
  padding: 8px 10px;
  text-decoration: none;
  color: #555;
  font-size: 0.85rem;
  border-radius: 6px;
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
.dropdown-item.logout { color: #e74c3c; }
hr { border: 0; border-top: 1px solid #eee; margin: 4px 0; }

/* 메인 콘텐츠 여백 */
.main-content {
  flex: 1;
  margin-top: 56px; /* PC 헤더 높이 */
  padding-top: 0;   /* 추가 패딩 제거 */
}

/* [수정] Ticker 위치 제어 */
.ticker-container :deep(.ticker-wrap) {
  transition: top 0.3s ease-in-out;
  /* [신규] 기본적으로 헤더 높이(56px)만큼 떨어져 있음 */
  top: 56px !important; 
}

/* [수정] 헤더가 숨겨졌을 때 (스크롤 내릴 때) */
.ticker-container.ticker-up :deep(.ticker-wrap) {
  /* [핵심] 헤더가 사라지면 공지 바가 최상단(0px)에 붙음 */
  top: 0 !important; 
}

/* [신규] 모바일 화면 대응 (헤더 높이가 46px이므로 조정) */
@media (max-width: 768px) {
  .ticker-container :deep(.ticker-wrap) {
    top: 46px !important; /* 모바일 헤더 높이에 맞춤 */
  }
}

/* 게임 모드 헤더 */
#app.game-mode .navbar {
  background: rgba(255,255,255,0.7);
}

/* QR 버튼 */
.fab-qr-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%; 
  background-color: #2c3e50;
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  cursor: pointer;
  z-index: 999;
  transition: transform 0.2s;
}
.fab-qr-button:active { transform: scale(0.95); }

/* 모바일 반응형 (768px 이하) */
@media (max-width: 768px) {
  .navbar {
    height: 46px; /* 더 얇게 */
    padding: 0 20px;
  }
  
  .main-content {
    margin-top: 46px; 
    padding-top: 0;
  }

  .logo-text { display: none; }
  
  .ticker-name { 
    display: inline-block; 
    font-size: 0.75rem; 
    margin-right: 2px;
  }
  
  .nav-ticker {
    font-size: 0.8rem;
    padding: 2px 8px;
  }
  .ticker-content { font-size: 0.85rem; }

  .fab-qr-button {
    width: 45px;
    height: 45px;
    font-size: 1.2rem;
    bottom: 20px;
    right: 15px;
  }
  
  .mobile-nav-links { display: block; }
}

@media (min-width: 769px) {
  .mobile-nav-links { display: block; }
}

/* 기타 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fab-matchmaking-button { 
  position: fixed; bottom: 90px; right: 20px; width: 50px; height: 50px;
  background: #e74c3c; color: white; border-radius: 50%;
  display: flex; justify-content: center; align-items: center;
  font-size: 1.2rem; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 998;
  text-decoration: none;
}
.fab-badge {
  position: absolute; top: -5px; right: -5px;
  background: #f1c40f; color: #333; font-size: 0.7rem;
  font-weight: bold; padding: 2px 6px; border-radius: 10px;
  border: 2px solid #e74c3c;
}
.pulse-ring {
  position: absolute; width: 100%; height: 100%; border-radius: 50%;
  border: 2px solid #e74c3c; animation: pulse 1.5s infinite;
}
@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }

.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 2000;
}
.modal-content {
  background: white; width: 90%; max-width: 350px; border-radius: 12px; overflow: hidden;
}
.modal-header {
  padding: 15px; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #eee;
}
.modal-body {
  padding: 20px; display: flex; flex-direction: column; align-items: center;
}
.qr-info { margin-top: 10px; color: #666; font-size: 0.9rem; }
.qr-error { color: #e74c3c; }
.close-button { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
.login-btn {
  background-color: #007bff; color: white; padding: 6px 14px;
  border-radius: 16px; text-decoration: none; font-size: 0.85rem; font-weight: bold;
}
</style>
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
                    <router-link to="/intro" class="dropdown-item" @click="closeProfileMenu">ℹ️ 솔트메이트 소개</router-link>
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
    
    <div v-if="!isGamePage" class="ticker-container" :class="{ 'ticker-up': !isHeaderVisible }">
      <AnnouncementTicker />
    </div>

    <main class="main-content">
      <router-view />
    </main>

    <div class="floating-controls">
      
      <div v-if="isLoggedIn && !isGamePage" class="control-group pvp-group">
        <transition name="slide-fade">
          <router-link 
            v-if="isPvpWidgetVisible"
            to="/salt-pang-pvp" 
            class="fab-matchmaking-button" 
            :class="{ 'active-queue': matchmakingQueueCount > 0 }"
            title="대전 참여"
          >
            <div v-if="matchmakingQueueCount > 0" class="pulse-ring"></div>
            <i class="fas fa-fist-raised"></i>
            <span v-if="matchmakingQueueCount > 0" class="fab-badge">{{ matchmakingQueueCount }}</span>
          </router-link>
        </transition>
        
        <button class="toggle-btn" @click="isPvpWidgetVisible = !isPvpWidgetVisible">
          <i :class="isPvpWidgetVisible ? 'fas fa-chevron-right' : 'fas fa-chevron-left'"></i>
        </button>
      </div>

      <div v-if="!isGamePage" class="control-group race-group">
        <transition name="slide-fade">
          <router-link v-if="isRaceWidgetVisible" to="/salt-racing?mode=family" class="race-widget">
            <div class="race-badge">NEXT</div>
            <div class="race-timer">{{ raceTimeLeft }}</div>
            <div class="race-participants">
               <i class="fas fa-user"></i> {{ raceParticipantCount }}
            </div>
            <i class="fas fa-flag-checkered race-icon"></i>
          </router-link>
        </transition>

        <button class="toggle-btn" @click="isRaceWidgetVisible = !isRaceWidgetVisible">
          <i :class="isRaceWidgetVisible ? 'fas fa-chevron-right' : 'fas fa-chevron-left'"></i>
        </button>
      </div>

      <div v-if="userRole === 'centerManager' && !isGamePage" class="control-group qr-group">
        <transition name="slide-fade">
          <button v-if="isQrVisible" @click="generateQR" class="fab-qr-button">
            <i class="fas fa-qrcode"></i>
          </button>
        </transition>
        
        <button class="toggle-btn" @click="isQrVisible = !isQrVisible">
          <i :class="isQrVisible ? 'fas fa-chevron-right' : 'fas fa-chevron-left'"></i>
        </button>
      </div>

    </div>

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
import AnnouncementTicker from '@/components/AnnouncementTicker.vue';

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

// 상태 변수 (토글)
const isPvpWidgetVisible = ref(false); 
const isQrVisible = ref(false); 
const isRaceWidgetVisible = ref(false); 

const raceTimeLeft = ref("00:00");
const raceParticipantCount = ref(0); 

let saltPriceUnsubscribe = null;
let authUnsubscribe = null;
let presenceRef = null;
let matchmakingUnsubscribe = null;
let raceTimerUnsubscribe = null;
let timerInterval = null;

const isGamePage = computed(() => {
  return route.meta.isGamePage === true || route.path === '/plaza';
});

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

const listenToRaceTimer = () => {
  const raceRef = doc(db, "system", "saltRacingFamily");
  raceTimerUnsubscribe = onSnapshot(raceRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      raceParticipantCount.value = data.participantCount || 0;
      if (data.nextRaceTime) {
        startTimer(data.nextRaceTime.toDate());
      }
    }
  });
};

const startTimer = (targetDate) => {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const now = new Date();
    const diff = targetDate - now;
    
    if (diff <= 0) {
      raceTimeLeft.value = "LIVE";
    } else {
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      // [수정 완료] familyTimer -> raceTimeLeft.value 로 변경
      raceTimeLeft.value = `${m}:${s < 10 ? '0'+s : s}`;
    }
  }, 1000);
};

const checkAuthState = () => {
  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    managePresence(user);
    if (user) {
      isLoggedIn.value = true;
      listenToSaltPrice(); 
      listenToMatchmakingQueue();
      listenToRaceTimer();
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
  if (raceTimerUnsubscribe) raceTimerUnsubscribe();
  if (timerInterval) clearInterval(timerInterval);
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

.main-content {
  flex: 1;
  margin-top: 56px;
  padding-top: 0;
}

.ticker-container :deep(.ticker-wrap) {
  transition: top 0.3s ease-in-out;
  top: 56px !important; 
}

.ticker-container.ticker-up :deep(.ticker-wrap) {
  top: 0 !important; 
}

#app.game-mode .navbar {
  background: rgba(255,255,255,0.7);
}

/* 플로팅 컨트롤러 스타일 */
.floating-controls {
  position: fixed;
  bottom: 20px;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 15px;
  z-index: 999;
  padding-right: 15px;
}

/* 공통 컨트롤 그룹 스타일 */
.control-group {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  justify-content: flex-end;
}

/* 공통 토글 버튼 스타일 */
.toggle-btn {
  width: 24px;
  /* 높이는 위젯에 따라 다를 수 있으므로 min-height 사용 */
  min-height: 42px; 
  background: rgba(0, 0, 0, 0.3);
  border: none;
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  margin-right: -15px; /* 화면 끝에 붙임 */
}

/* 1. PVP 위젯 스타일 */
.fab-matchmaking-button { 
  width: 50px;
  height: 50px;
  /* 기본: 차분한 파란색 */
  background: #2c3e50; 
  color: white; 
  border-radius: 50%;
  display: flex; 
  justify-content: center; 
  align-items: center;
  font-size: 1.2rem; 
  box-shadow: 0 4px 10px rgba(0,0,0,0.3); 
  text-decoration: none;
  transition: all 0.3s ease;
  border: 2px solid rgba(255,255,255,0.1);
  position: relative; /* 펄스 효과 기준점 */
}
.fab-matchmaking-button.active-queue {
  background: #e74c3c;
  border-color: #ff7675;
  transform: scale(1.05);
}
.pvp-group .toggle-btn {
    height: 50px; /* 버튼 높이에 맞춤 */
}

/* 2. 레이스 위젯 스타일 */
.race-widget {
  background: linear-gradient(135deg, #ff512f, #dd2476);
  color: white;
  padding: 10px 15px;
  border-radius: 25px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  box-shadow: 0 4px 15px rgba(221, 36, 118, 0.4);
  font-weight: bold;
  animation: float 3s ease-in-out infinite;
}
.race-badge {
  font-size: 0.7rem;
  background: rgba(0,0,0,0.2);
  padding: 2px 6px;
  border-radius: 4px;
}
.race-timer {
  font-size: 1.1rem;
  font-family: monospace;
}
.race-icon {
  font-size: 1.2rem;
}
.race-participants {
  font-size: 0.9rem;
  margin-left: 5px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ffeaa7;
  font-weight: 600;
}
.race-group .toggle-btn {
    height: 42px; /* 위젯 높이에 맞춤 */
}

/* 3. QR 위젯 스타일 */
.fab-qr-button {
  width: 50px;
  height: 50px;
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
}
.qr-group .toggle-btn {
    height: 50px;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* 슬라이드 애니메이션 */
.slide-fade-enter-active, .slide-fade-leave-active {
  transition: all 0.3s ease;
}
.slide-fade-enter-from, .slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* 기타 애니메이션 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fab-badge {
  position: absolute; top: -5px; right: -5px;
  background: #f1c40f; color: #333; font-size: 0.7rem;
  font-weight: bold; padding: 2px 6px; border-radius: 10px;
  border: 2px solid #e74c3c;
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.pulse-ring {
  position: absolute; width: 100%; height: 100%; border-radius: 50%;
  border: 2px solid #e74c3c; animation: pulse 1.5s infinite;
}

@keyframes popIn {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

@keyframes pulse { 
  0% { transform: scale(1); opacity: 1; } 
  100% { transform: scale(1.5); opacity: 0; } 
}

/* 모바일 반응형 */
@media (max-width: 768px) {
  .navbar { height: 46px; padding: 0 20px; }
  .main-content { margin-top: 46px; }
  .ticker-container :deep(.ticker-wrap) { top: 46px !important; }
  .logo-text { display: none; }
  .ticker-name { display: inline-block; font-size: 0.75rem; margin-right: 2px; }
  .nav-ticker { font-size: 0.8rem; padding: 2px 8px; }
  .ticker-content { font-size: 0.85rem; }
  .mobile-nav-links { display: block; }
}
@media (min-width: 769px) {
  .mobile-nav-links { display: block; }
}

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
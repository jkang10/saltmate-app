<template>
  <div id="app" :class="{ 'game-mode': isGamePage }">
    
    <header class="navbar card glassmorphism">
      <div class="navbar-container">
        <router-link to="/" class="navbar-brand">
          <img src="@/assets/logo.png" alt="Saltmate Logo" />
          <span>솔트메이트</span>
        </router-link>
        <nav class="navbar-nav" :class="{ 'is-active': isNavActive }">
          <router-link to="/mall" class="nav-link">솔트메이트 몰</router-link>
          <router-link to="/community" class="nav-link">커뮤니티</router-link>
          <router-link to="/help" class="nav-link">도움말</router-link>
          <router-link to="/about" class="nav-link">솔트메이트 소개</router-link>
        </nav>
        <div class="navbar-actions">
          <div v-if="isLoggedIn" class="user-actions">
            <router-link to="/salt-trader" class="salt-ticker" title="소금 상인 페이지로 이동">
              <span class="ticker-label">SALT</span>
              <span class="ticker-price">{{ saltPrice.toLocaleString() }}</span>
              <span class="ticker-change" :class="priceClass">
                <i v-if="priceClass === 'up'" class="fas fa-caret-up"></i>
                <i v-if="priceClass === 'down'" class="fas fa-caret-down"></i>
                {{ priceChange }}
              </span>
            </router-link>
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

    <router-link to="/salt-pang-pvp" v-if="isLoggedIn && matchmakingQueueCount > 0 && !isGamePage" class="fab-matchmaking-button" title="솔트팡 대전 참여하기">
      <div class="pulse-ring"></div>
      <i class="fas fa-fist-raised"></i>
      <span class="fab-badge">{{ matchmakingQueueCount }}</span>
    </router-link>

    <main class="main-content">
      <router-view />
    </main>

    <button v-if="userRole === 'centerManager' && !isGamePage" @click="generateQR" class="fab-qr-button" title="방문 인증 QR코드 생성">
      <i class="fas fa-qrcode"></i>
    </button>

    <div v-if="qrModal.visible" class="modal-overlay" @click.self="closeQrModal">
      <div class="modal-content">
        <header class="modal-header">
          <h3>방문 인증 QR코드</h3>
          <button @click="closeQrModal" class="close-button">&times;</button>
        </header>
        <div class="modal-body">
          <div v-if="qrModal.isLoading" class="loading-spinner"></div>
          <div v-else-if="qrModal.qrId" class="qr-code-container">
            <qrcode-vue :value="qrModal.qrId" :size="250" level="H" />
            <p class="qr-info">이 QR코드는 5분간 유효하며, 1회만 사용할 수 있습니다.</p>
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
const isNavActive = ref(false);
const userRole = ref(null);
const qrModal = reactive({
  visible: false,
  isLoading: false,
  qrId: null,
  error: null,
});
const saltPrice = ref(0);
const priceChange = ref(0);
const priceClass = ref('');
const matchmakingQueueCount = ref(0);
let saltPriceUnsubscribe = null;
let authUnsubscribe = null;
let presenceRef = null;
let matchmakingUnsubscribe = null;

// [★수정★] 'isGamePage' 정의는 그대로 유지
const isGamePage = computed(() => route.meta.isGamePage === true);

const managePresence = (user) => {
  // ( ... 기존 함수 내용 ... )
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
  // ( ... 기존 함수 내용 ... )
  const marketRef = doc(db, "configuration", "saltMarket");
  saltPriceUnsubscribe = onSnapshot(marketRef, (docSnap) => {
    if (docSnap.exists()) {
      const marketData = docSnap.data();
      const newPrice = marketData.currentPrice;
      if (saltPrice.value !== 0 && newPrice !== saltPrice.value) {
        priceChange.value = newPrice - saltPrice.value;
        priceClass.value = newPrice > saltPrice.value ? 'up' : 'down';
      }
      saltPrice.value = newPrice;
    }
  });
};

const listenToMatchmakingQueue = () => {
  // ( ... 기존 함수 내용 ... )
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
  // ( ... 기존 함수 내용 ... )
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
        console.error("사용자 정보를 가져오는 중 오류 발생:", error);
        userName.value = "사용자";
        userRole.value = 'user';
      }
    } else {
      isLoggedIn.value = false;
      userName.value = "";
      userRole.value = null;
      if (saltPriceUnsubscribe) saltPriceUnsubscribe();
      if (matchmakingUnsubscribe) matchmakingUnsubscribe();
    }
  });
};

const generateQR = async () => {
  // ( ... 기존 함수 내용 ... )
  qrModal.visible = true;
  qrModal.isLoading = true;
  qrModal.qrId = null;
  qrModal.error = null;
  try {
    const generateFunc = httpsCallable(functions, "generateCenterQRCode");
    const result = await generateFunc();
    if (result.data.success) {
      const baseUrl = window.location.origin;
      qrModal.qrId = `${baseUrl}/qr-scanner?qrId=${result.data.qrId}`;
    } else {
      throw new Error("QR코드 생성에 실패했습니다.");
    }
  } catch (error) {
    console.error("QR코드 생성 오류:", error);
    qrModal.error = error.message;
  } finally {
    qrModal.isLoading = false;
  }
};

const closeQrModal = () => {
  // ( ... 기존 함수 내용 ... )
  qrModal.visible = false;
};

const logout = async () => {
  // ( ... 기존 함수 내용 ... )
  try {
    if (auth.currentUser) {
      const userPresenceRef = dbRef(rtdb, `presence/${auth.currentUser.uid}`);
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
  // ( ... 기존 함수 내용 ... )
  isNavActive.value = !isNavActive.value;
};

onMounted(() => {
  checkAuthState();
});

onUnmounted(() => {
  // ( ... 기존 함수 내용 ... )
  if (authUnsubscribe) authUnsubscribe();
  if (saltPriceUnsubscribe) saltPriceUnsubscribe();
  if (matchmakingUnsubscribe) matchmakingUnsubscribe();
  if (auth.currentUser) {
    const userPresenceRef = dbRef(rtdb, `presence/${auth.currentUser.uid}`);
    remove(userPresenceRef);
  }
});

watch(() => router.currentRoute.value, () => {
  isNavActive.value = false;
});
</script>

<style scoped>
/* [★신규★] 게임 모드일 때 main-content의 패딩과 마진을 제거합니다. */
.main-content.game-mode {
  margin-top: 0 !important;
  padding: 0 !important;
  height: 100vh; /* 게임 페이지가 전체 높이를 차지하도록 */
}

/* [핵심] 신규 플로팅 아이콘 버튼 스타일 */
.fab-matchmaking-button {
  position: fixed;
  top: 130px; /* [수정] 공지사항 바 아래로 위치 조정 */
  right: 25px;
  width: 55px;
  height: 55px;
  border-radius: 50%;
  background-color: #e74c3c;
  color: white;
  border: 2px solid white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.6em;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  z-index: 998;
  transition: all 0.3s ease;
  text-decoration: none;
}
/* [핵심 추가] 화면 너비가 768px 이하일 때 (모바일) 적용될 스타일 */
@media (max-width: 768px) {
  .fab-matchmaking-button {
    top: 140px;  /* 모바일에서는 좀 더 아래로 내립니다. */
    right: 15px; /* 오른쪽 여백을 줄입니다. */
    width: 50px;   /* 아이콘 크기를 살짝 줄입니다. */
    height: 50px;
    font-size: 1.4em;
  }
  .fab-badge {
    width: 20px;
    height: 20px;
    font-size: 11px;
  }
}
.fab-matchmaking-button:hover {
  background-color: #c0392b;
  transform: scale(1.1);
}
.fab-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 22px;
  height: 22px;
  background-color: #007bff;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px solid white;
}
.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid #e74c3c;
  border-radius: 50%;
  animation: pulse-animate 2s infinite cubic-bezier(0.2, 0.8, 0.7, 1);
  z-index: -1;
}
@keyframes pulse-animate {
  0% {
    transform: scale(0.9);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

/* --- 나머지 스타일은 기존과 동일 --- */
.salt-ticker {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  padding: 6px 12px;
  border-radius: 20px;
  font-family: monospace;
  text-decoration: none;
  color: #212529;
  transition: box-shadow 0.2s;
}
.salt-ticker:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.ticker-label {
  font-weight: bold;
  font-size: 0.9em;
  color: #007bff;
}
.ticker-price {
  font-weight: bold;
  font-size: 1.1em;
}
.ticker-change {
  font-weight: bold;
  font-size: 0.9em;
  display: flex;
  align-items: center;
}
.ticker-change.up { color: #28a745; }
.ticker-change.down { color: #dc3545; }
#app { display: flex; flex-direction: column; min-height: 100vh; background-color: #f8f9fa; }
.navbar { position: fixed; top: 0; left: 0; width: 100%; z-index: 1000; padding: 10px 20px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid rgba(0, 0, 0, 0.1); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); }
.navbar-container { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
.navbar-brand { display: flex; align-items: center; text-decoration: none; color: #333; font-size: 1.5em; font-weight: bold; }
.navbar-brand img { height: 40px; margin-right: 10px; }
.navbar-nav { display: flex; gap: 25px; }
.nav-link { text-decoration: none; color: #555; font-weight: 500; padding: 5px 0; position: relative; transition: color 0.3s; }
.nav-link::after { content: ""; position: absolute; bottom: 0; left: 0; width: 0; height: 2px; background-color: #007bff; transition: width 0.3s; }
.nav-link:hover, .nav-link.router-link-exact-active { color: #007bff; }
.nav-link:hover::after, .nav-link.router-link-exact-active::after { width: 100%; }
.navbar-actions { display: flex; align-items: center; gap: 15px; }
.user-actions { display: flex; align-items: center; gap: 15px; }
.user-profile-link { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #333; font-weight: 500; }
.logout-button, .login-button { padding: 8px 15px; border: none; border-radius: 20px; cursor: pointer; font-weight: bold; transition: background-color 0.3s, color 0.3s; }
.logout-button { background-color: #f8f9fa; color: #dc3545; border: 1px solid #dc3545; }
.logout-button:hover { background-color: #dc3545; color: white; }
.login-button { background-color: #007bff; color: white; text-decoration: none; }
.login-button:hover { background-color: #0056b3; }
.navbar-toggler { display: none; background: none; border: none; font-size: 1.5em; cursor: pointer; }
.main-content { flex: 1; margin-top: 70px; }
.fab-qr-button { position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px; border-radius: 50%; background-color: #007bff; color: white; border: none; display: flex; justify-content: center; align-items: center; font-size: 1.8em; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); cursor: pointer; z-index: 998; transition: all 0.3s ease; }
.fab-qr-button:hover { background-color: #0056b3; transform: scale(1.1); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 400px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
.modal-header h3 { margin: 0; }
.close-button { background: none; border: none; font-size: 1.5em; cursor: pointer; }
.modal-body { text-align: center; }
.qr-code-container { display: flex; flex-direction: column; align-items: center; gap: 15px; }
.qr-info { font-size: 0.9em; color: #555; }
.qr-error { color: #dc3545; }
.loading-spinner { display: inline-block; border: 4px solid rgba(0,0,0,0.1); border-top-color: #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 992px) {
  .navbar-nav { display: none; position: absolute; top: 70px; left: 0; width: 100%; background-color: white; flex-direction: column; padding: 20px; box-shadow: 0 10px 10px rgba(0, 0, 0, 0.1); }
  .navbar-nav.is-active { display: flex; }
  .navbar-toggler { display: block; }
}
</style>
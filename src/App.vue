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
  <router-link to="/my-investments" class="nav-link">내 수익 현황</router-link>
  <router-link to="/community" class="nav-link">커뮤니티</router-link>
  <router-link to="/rtdb-test" class="nav-link" style="color: red;">RTDB 테스트</router-link>
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

    <main class="main-content">
      <router-view />
    </main>

    <!-- [핵심 추가] 센터 관리자에게만 보이는 QR 생성 버튼 (Floating Action Button) -->
    <button v-if="userRole === 'centerManager'" @click="generateQR" class="fab-qr-button" title="방문 인증 QR코드 생성">
      <i class="fas fa-qrcode"></i>
    </button>

    <!-- [핵심 추가] QR코드 표시 모달 -->
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

<script>
import { ref, onMounted, onUnmounted, watch, reactive } from "vue";
import { auth, db, functions, rtdb } from "@/firebaseConfig"; // functions 추가
import { httpsCallable } from "firebase/functions"; // httpsCallable 추가
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore"; // onSnapshot 추가
import { ref as dbRef, onValue, set, onDisconnect, remove } from "firebase/database";
import { useRouter } from "vue-router";
import QrcodeVue from 'qrcode.vue'; // QR코드 생성 라이브러리

export default {
  components: {
    QrcodeVue,
  },
  setup() {
    const isLoggedIn = ref(false);
    const userName = ref("");
    const isNavActive = ref(false);
    const router = useRouter();
    const userRole = ref(null);
    const qrModal = reactive({
      visible: false,
      isLoading: false,
      qrId: null,
      error: null,
    });

    // [핵심 수정] 소금 시세 관련 변수들을 setup 스코프 최상단에 ref로 선언합니다.
    const saltPrice = ref(0);
    const priceChange = ref(0);
    const priceClass = ref('');
    let saltPriceUnsubscribe = null; // 이 변수는 ref일 필요가 없습니다.

    let authUnsubscribe = null;
    let presenceRef = null;

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

    // [핵심 추가] 실시간으로 소금 시세를 가져오는 함수
    const listenToSaltPrice = () => {
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

   const checkAuthState = () => {
      authUnsubscribe = onAuthStateChanged(auth, async (user) => {
        managePresence(user);
        if (user) {
          isLoggedIn.value = true;
          // [핵심 추가] 로그인 시 소금 시세 리스너 시작
          listenToSaltPrice(); 
          try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userName.value = userData.name || "사용자";
              userRole.value = userData.role || 'user'; // 사용자의 역할을 가져와서 저장
            }
          } catch (error) {
            console.error("사용자 정보를 가져오는 중 오류 발생:", error);
            userName.value = "사용자";
            userRole.value = 'user';
          }
        } else {
          isLoggedIn.value = false;
          userName.value = "";
          userRole.value = null; // 로그아웃 시 역할 초기화
          // [핵심 추가] 로그아웃 시 소금 시세 리스너 정리
          if (saltPriceUnsubscribe) saltPriceUnsubscribe();
        }
      });
    };
    
    // [핵심 추가] QR코드 생성 함수
    const generateQR = async () => {
      qrModal.visible = true;
      qrModal.isLoading = true;
      qrModal.qrId = null;
      qrModal.error = null;
      try {
        const generateFunc = httpsCallable(functions, "generateCenterQRCode");
        const result = await generateFunc(); // 센터 관리자는 centerId를 보낼 필요 없음
        if (result.data.success) {
          // [핵심 수정] 단순 ID가 아닌, 전체 URL을 QR코드 값으로 생성합니다.
          const baseUrl = window.location.origin; // https://saltmate-app.netlify.app
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

    // [핵심 추가] QR 모달 닫기 함수
    const closeQrModal = () => {
      qrModal.visible = false;
    };


    const logout = async () => {
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
      isNavActive.value = !isNavActive.value;
    };

    onMounted(() => {
      checkAuthState();
    });

    onUnmounted(() => {
      if (authUnsubscribe) authUnsubscribe();
      if (saltPriceUnsubscribe) saltPriceUnsubscribe(); // [핵심 추가]
      if (auth.currentUser) {
        const userPresenceRef = dbRef(rtdb, `presence/${auth.currentUser.uid}`);
        remove(userPresenceRef);
      }
    });

    watch(() => router.currentRoute.value, () => {
      isNavActive.value = false;
    });

    return {
      isLoggedIn, userName, logout, isNavActive, toggleNav,
      userRole, qrModal, generateQR, closeQrModal,
      // [핵심 추가] 템플릿에서 사용할 변수들
      saltPrice, priceChange, priceClass,
    };
  },
};
</script>

<style scoped>
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
.ticker-change.up {
  color: #28a745; /* 초록색 */
}
.ticker-change.down {
  color: #dc3545; /* 빨간색 */
}
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
  margin-top: 70px;
}
.fab-qr-button {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #007bff;
  color: white;
  border: none;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.8em;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  z-index: 998;
  transition: all 0.3s ease;
}
.fab-qr-button:hover {
  background-color: #0056b3;
  transform: scale(1.1);
}
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 400px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
.modal-header h3 { margin: 0; }
.close-button { background: none; border: none; font-size: 1.5em; cursor: pointer; }
.modal-body { text-align: center; }
.qr-code-container { display: flex; flex-direction: column; align-items: center; gap: 15px; }
.qr-info { font-size: 0.9em; color: #555; }
.qr-error { color: #dc3545; }
.loading-spinner {
  display: inline-block;
  border: 4px solid rgba(0,0,0,0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

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
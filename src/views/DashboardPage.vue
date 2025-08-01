<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <HappyGauge
        v-if="userProfile"
        :current-points="userProfile.saltmatePoints"
      />
      <h1 v-else>솔트메이트 대시보드</h1>
    </header>

    <main class="dashboard-content">
      <section class="user-info-section card">
        <h2>환영합니다, {{ userProfile?.name || "솔트메이트" }}님!</h2>

        <p v-if="loadingUser">사용자 정보를 불러오는 중...</p>
        <div v-else-if="userProfile">
          <p>회원님의 현재 **솔트메이트 등급**:</p>
          <span :class="['saltmate-level', userProfile.saltmateLevel]">
            {{ getSaltmateLevelText(userProfile.saltmateLevel) }}
          </span>
          <p>
            참여 금액:
            <strong
              >{{
                userProfile.participationAmount
                  ? userProfile.participationAmount.toLocaleString()
                  : "0"
              }}원</strong
            >
          </p>

          <p
            v-if="userProfile.discountRate !== undefined"
            class="highlight-info"
          >
            ✨ 등급 적용 할인율:
            <strong>{{ userProfile.discountRate }}%</strong>
          </p>
          <p v-else class="info-text">(등급 적용 할인율 정보가 없습니다.)</p>

          <p
            v-if="userProfile.eventCouponsCount !== undefined"
            class="highlight-info"
          >
            🎉 보유 이벤트 쿠폰:
            <strong>{{ userProfile.eventCouponsCount }}개</strong>
          </p>
          <p v-else class="info-text">(보유 이벤트 쿠폰 정보가 없습니다.)</p>

          <p v-if="userProfile.hasNFT" class="nft-status">
            ✨ **공장 지분 연동 NFT를 보유하고 계십니다!**
            <br />
            <router-link to="/my-nfts" class="go-to-link"
              >NFT 정보 및 독점 정보 확인하기 &gt;</router-link
            >
          </p>
          <p v-else class="nft-status-pending">
            (50만원 이상 참여 시 공장 지분 연동 NFT 발급 대상이 됩니다.)
          </p>
        </div>
        <div v-else class="error-state">
          <p class="error-message">😔 사용자 정보를 불러올 수 없습니다.</p>
        </div>
      </section>
      <section class="tokens-section card">
        <h2>💰 보유 토큰 현황</h2>
        <div v-if="loadingUser" class="loading-state">
          <div class="spinner"></div>
          <p>토큰 정보를 불러오는 중입니다...</p>
        </div>
        <div v-else-if="userProfile">
          <div class="token-display">
            <div class="token-item">
              <img src="@/assets/COBS.png" alt="COBS Logo" class="token-logo" />
              <div class="token-details">
                <span class="token-name">COBS</span>
                <span class="token-balance"
                  >{{
                    userProfile.cobsBalance
                      ? userProfile.cobsBalance.toLocaleString()
                      : "0"
                  }}
                  개</span
                >
              </div>
              <router-link to="/my-tokens" class="go-to-token-button">
                <i class="fas fa-arrow-right"></i>
              </router-link>
            </div>
            <div class="token-item">
              <img
                src="@/assets/BND_LOGO.png"
                alt="BND Logo"
                class="token-logo"
              />
              <div class="token-details">
                <span class="token-name">BND</span>
                <span class="token-balance"
                  >{{
                    userProfile.bndBalance
                      ? userProfile.bndBalance.toLocaleString()
                      : "0"
                  }}
                  개</span
                >
              </div>
              <router-link to="/my-tokens" class="go-to-token-button">
                <i class="fas fa-arrow-right"></i>
              </router-link>
            </div>
          </div>
        </div>
        <div v-else class="error-state">
          <p class="error-message">😔 토큰 정보를 불러올 수 없습니다.</p>
        </div>
      </section>

      <section class="quick-access-section card">
        <h2>🚀 바로가기</h2>
        <div class="action-grid">
          <router-link to="/shop" class="action-button primary">
            <i class="fas fa-store"></i> 투자 상품 둘러보기
          </router-link>
          <router-link to="/my-investments" class="action-button secondary">
            <i class="fas fa-chart-line"></i> 내 투자 현황
          </router-link>
          <router-link to="/community" class="action-button info">
            <i class="fas fa-comments"></i> 커뮤니티
          </router-link>
          <router-link to="/profile" class="action-button success">
            <i class="fas fa-user-circle"></i> 내 프로필 관리
          </router-link>
          <router-link to="/my-tokens" class="action-button outline">
            <i class="fas fa-coins"></i> 토큰 관리
          </router-link>
          <router-link to="/my-nfts" class="action-button outline">
            <i class="fas fa-gem"></i> NFT 관리
          </router-link>
          <router-link to="/my-equity" class="action-button outline">
            <i class="fas fa-chart-pie"></i> 지분 관리
          </router-link>
          <router-link to="/my-orders" class="action-button outline">
            <i class="fas fa-truck"></i> 주문 배송 관리
          </router-link>
          <router-link to="/my-events" class="action-button outline">
            <i class="fas fa-calendar-alt"></i> 이벤트 관리
          </router-link>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import HappyGauge from "@/components/common/HappyGauge.vue";
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default {
  name: "DashboardPage",
  components: {
    HappyGauge,
  },
  data() {
    return {
      userProfile: null,
      loadingUser: true,
      error: null,
    };
  },
  async created() {
    await this.fetchUserProfile();
  },
  methods: {
    async fetchUserProfile() {
      this.loadingUser = true;
      this.error = null;
      try {
        const user = await new Promise((resolve, reject) => {
          const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
              unsubscribe();
              resolve(user);
            },
            reject,
          );
        });

        if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            this.userProfile = {
              ...userSnap.data(),
              cobsBalance: userSnap.data().cobsBalance || 0,
              bndBalance: userSnap.data().bndBalance || 0,
              discountRate: userSnap.data().discountRate || 0,
              eventCouponsCount: userSnap.data().eventCouponsCount || 0,
            };
          } else {
            this.error = "사용자 프로필을 찾을 수 없습니다.";
            this.userProfile = null;
          }
        } else {
          this.error = "로그인된 사용자가 없습니다.";
          this.userProfile = null;
        }
      } catch (e) {
        console.error("사용자 프로필 가져오기 실패:", e);
        this.error = "사용자 프로필을 불러오는 데 실패했습니다: " + e.message;
        this.userProfile = null;
      } finally {
        this.loadingUser = false;
      }
    },
    getSaltmateLevelText(level) {
      switch (level) {
        case "bronze":
          return "브론즈 솔트메이트";
        case "silver":
          return "실버 솔트메이트";
        case "gold":
          return "골드 솔트메이트";
        case "platinum":
          return "플래티넘 솔트메이트";
        case "diamond":
          return "다이아몬드 솔트메이트";
        default:
          return "일반 솔트메이트";
      }
    },
  },
};
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px auto; /* 상단 네비게이션 바 고려 */
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between; /* justify-content: flex-start; 또는 remove for full width h1 */
  align-items: center;
  margin-bottom: 20px;
}

.dashboard-header h1 {
  font-size: 2.5em;
  color: #333;
  /* width: 100%; */ /* h1이 전체 너비를 차지하게 하려면 이 주석을 해제할 수 있습니다. */
}

/* .logout-button {
  background-color: #f44336;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.3s ease, transform 0.2s ease;
}

.logout-button:hover {
  background-color: #d32f2f;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.2);
} */ /* 이 스타일 블록은 더 이상 필요 없으므로 삭제하거나 주석 처리할 수 있습니다. */

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.card {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 15px;
  padding: 30px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  transition: transform 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
}

.user-info-section h2,
.tokens-section h2,
.quick-access-section h2 {
  font-size: 2em;
  color: #333;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
}

.user-info-section p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 10px;
  line-height: 1.6;
}

.user-info-section strong {
  color: #007bff;
}

.saltmate-level {
  display: inline-block;
  padding: 8px 15px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9em;
  margin-left: 10px;
  margin-bottom: 15px;
  color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

/* 등급별 색상 */
.saltmate-level.bronze {
  background-color: #cd7f32;
}
.saltmate-level.silver {
  background-color: #c0c0c0;
}
.saltmate-level.gold {
  background-color: #ffd700;
}
.saltmate-level.platinum {
  background-color: #e5e4e2;
  color: #333;
}
.saltmate-level.diamond {
  background-color: #b9f2ff;
  color: #333;
}

.nft-status {
  font-size: 1em;
  color: #28a745;
  font-weight: bold;
  margin-top: 15px;
  padding: 10px;
  background-color: rgba(40, 167, 69, 0.1);
  border-left: 5px solid #28a745;
  border-radius: 5px;
}

.nft-status-pending {
  font-size: 0.95em;
  color: #6c757d;
  margin-top: 15px;
  padding: 10px;
  background-color: rgba(108, 117, 125, 0.1);
  border-left: 5px solid #6c757d;
  border-radius: 5px;
}

.go-to-link {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
  margin-top: 5px;
  display: inline-block;
}

.go-to-link:hover {
  text-decoration: underline;
}

/* 토큰 섹션 */
.tokens-section {
  display: flex;
  flex-direction: column;
}

.token-display {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
}

.token-item {
  background-color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  min-width: 250px;
  flex-grow: 1;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  position: relative;
}

.token-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.token-logo {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: contain;
  background-color: #f0f0f0; /* 배경 추가 */
  padding: 5px;
}

.token-details {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.token-name {
  font-size: 1.3em;
  font-weight: bold;
  color: #333;
}

.token-balance {
  font-size: 1.1em;
  color: #007bff;
  font-weight: 600;
  margin-top: 5px;
}

.go-to-token-button {
  background: none;
  border: none;
  color: #007bff;
  font-size: 1.5em;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s ease;
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
}

.go-to-token-button:hover {
  transform: translateY(-50%) translateX(5px);
}

/* 퀵 액세스 섹션 */
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  justify-content: center;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 25px;
  border-radius: 12px;
  font-size: 1.1em;
  font-weight: bold;
  text-decoration: none;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
  min-height: 120px;
  text-align: center;
}

.action-button i {
  font-size: 2.5em;
  margin-bottom: 10px;
}

.action-button.primary {
  background-color: #007bff;
  color: white;
}

.action-button.primary:hover {
  background-color: #0056b3;
  transform: translateY(-5px);
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.3);
}

.action-button.secondary {
  background-color: #6c757d;
  color: white;
}

.action-button.secondary:hover {
  background-color: #5a6268;
  transform: translateY(-5px);
  box-shadow: 0 6px 15px rgba(108, 117, 125, 0.3);
}

.action-button.info {
  background-color: #17a2b8;
  color: white;
}

.action-button.info:hover {
  background-color: #117a8b;
  transform: translateY(-5px);
  box-shadow: 0 6px 15px rgba(23, 162, 184, 0.3);
}

.action-button.success {
  background-color: #28a745;
  color: white;
}

.action-button.success:hover {
  background-color: #1e7e34;
  transform: translateY(-5px);
  box-shadow: 0 6px 15px rgba(40, 167, 69, 0.3);
}

.action-button.outline {
  background-color: rgba(255, 255, 255, 0.6);
  color: #333;
  border: 2px solid #007bff;
}

.action-button.outline:hover {
  background-color: rgba(0, 123, 255, 0.1);
  color: #007bff;
  transform: translateY(-5px);
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.15);
}

.action-button.outline i {
  color: #007bff;
}

/* 로딩 및 오류 상태 */
.loading-state,
.error-state {
  text-align: center;
  padding: 30px;
  font-size: 1.1em;
  color: #666;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #dc3545;
  font-weight: bold;
}

.highlight-info {
  background-color: rgba(0, 123, 255, 0.08);
  padding: 8px 15px;
  border-radius: 5px;
  margin-top: 10px;
  font-size: 1em;
  color: #0056b3;
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-text {
  font-size: 0.9em;
  color: #888;
  margin-top: 5px;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }
  .dashboard-header h1 {
    font-size: 2em;
  }
  /* .logout-button {
    width: 100%;
  } */ /* 삭제된 버튼에 대한 스타일도 필요 없습니다. */
  .user-info-section,
  .tokens-section,
  .quick-access-section {
    padding: 20px;
  }
  .user-info-section h2,
  .tokens-section h2,
  .quick-access-section h2 {
    font-size: 1.8em;
  }
  .action-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
  .action-button {
    padding: 15px;
    font-size: 0.9em;
    min-height: 100px;
  }
  .action-button i {
    font-size: 2em;
  }
  .token-item {
    min-width: unset;
    width: 100%;
  }
}

@media (max-width: 480px) {
  .dashboard-container {
    padding: 10px;
  }
  .dashboard-header h1 {
    font-size: 1.8em;
  }
  .action-grid {
    grid-template-columns: 1fr;
  }
  .action-button {
    width: 100%;
  }
}
</style>

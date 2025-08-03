<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h2>환영합니다, {{ userProfile?.name || "솔트메이트" }}님!</h2>
    </header>

    <main class="dashboard-content">
      <section class="performance-card card">
        <div class="card-header">
          <h3><i class="fas fa-crown"></i> 나의 등급 및 수익 현황</h3>
          <span :class="['tier-badge', getTierClass(userProfile?.tier)]">{{
            userProfile?.tier || "Loding.."
          }}</span>
        </div>
        <div class="investment-info">
          <span>나의 구독 원금</span>
          <strong
            >{{
              (userProfile?.investmentAmount || 0).toLocaleString()
            }}
            원</strong
          >
        </div>
        <div class="performance-body">
          <h4>수익 사이클 (300%)</h4>
          <div class="progress-bar-container">
            <div
              class="progress-bar-fill"
              :style="{ width: cycleProgress + '%' }"
            ></div>
          </div>
          <div class="progress-labels">
            <span class="current-earnings"
              >{{
                (userProfile?.currentCycleEarnings || 0).toLocaleString()
              }}
              원</span
            >
            <span class="cycle-cap"
              >달성 목표:
              {{ (userProfile?.cycleCap || 0).toLocaleString() }} 원</span
            >
          </div>
        </div>
        <div class="balances">
          <div class="balance-item cash" @click="openHistoryModal('CASH')">
            <label><i class="fas fa-wallet"></i> 현금성 수익</label>
            <span>{{ (userProfile?.cashBalance || 0).toLocaleString() }}</span>
            <small>원</small>
          </div>
          <div
            class="balance-item saltmate"
            @click="openHistoryModal('SALTMATE')"
          >
            <label><i class="fas fa-gifts"></i> 솔트메이트</label>
            <span>{{
              (userProfile?.saltmatePoints || 0).toLocaleString()
            }}</span>
            <small>P</small>
          </div>
        </div>
        <div class="upgrade-action">
          <button
            @click="openUpgradeModal"
            class="upgrade-button"
            :disabled="userProfile?.tier === '승인대기중'"
          >
            <i class="fas fa-arrow-up"></i> 등급 추가 구매
          </button>
        </div>
      </section>

      <div class="dashboard-grid">
        <router-link to="/my-tokens" class="feature-card tokens">
          <div class="card-icon"><i class="fas fa-coins"></i></div>
          <h3>보유 토큰 현황</h3>
          <p>COBS, BND 토큰의 수량과 가치를 확인하세요.</p>
          <div class="token-glance">
            <div class="token-item">
              <img src="@/assets/COBS.png" alt="COBS" />
              <span>{{
                (userProfile?.cobsBalance || 0).toLocaleString()
              }}</span>
            </div>
            <div class="token-item">
              <img src="@/assets/BND_LOGO.png" alt="BND" />
              <span>{{ (userProfile?.bndBalance || 0).toLocaleString() }}</span>
            </div>
          </div>
          <span class="card-enter">자세히 보기 &rarr;</span>
        </router-link>
        <router-link to="/nft-marketplace" class="feature-card nft">
          <div class="card-icon"><i class="fas fa-gem"></i></div>
          <h3>NFT 마켓플레이스</h3>
          <p>보유한 NFT를 확인하고 멤버십 혜택을 누리세요.</p>
          <span class="card-enter">입장하기 &rarr;</span>
        </router-link>
        <router-link to="/my-equity" class="feature-card equity">
          <div class="card-icon"><i class="fas fa-chart-pie"></i></div>
          <h3>지분 정보</h3>
          <p>나의 공장 지분 현황과 관련 정보를 확인합니다.</p>
          <span class="card-enter">확인하기 &rarr;</span>
        </router-link>
        <router-link to="/my-events" class="feature-card events">
          <div class="card-icon"><i class="fas fa-calendar-alt"></i></div>
          <h3>이벤트 공간</h3>
          <p>진행중인 다양한 이벤트에 참여하고 혜택을 받으세요.</p>
          <span class="card-enter">참여하기 &rarr;</span>
        </router-link>
        <router-link to="/mall" class="feature-card mall">
          <div class="card-icon"><i class="fas fa-store"></i></div>
          <h3>솔트메이트 몰</h3>
          <p>솔트메이트 포인트로 특별한 상품을 구매하세요.</p>
          <span class="card-enter">둘러보기 &rarr;</span>
        </router-link>
        <router-link to="/my-investments" class="feature-card revenue">
          <div class="card-icon"><i class="fas fa-chart-line"></i></div>
          <h3>내 수익 현황</h3>
          <p>기간별, 종류별 수익 내역을 상세히 확인합니다.</p>
          <span class="card-enter">분석하기 &rarr;</span>
        </router-link>
      </div>
    </main>

    <TransactionHistoryModal
      v-if="historyModal.visible"
      :balanceType="historyModal.type"
      @close="historyModal.visible = false"
    />
    <UpgradeTierModal
      v-if="upgradeModalVisible"
      @close="upgradeModalVisible = false"
    />
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import TransactionHistoryModal from "@/components/TransactionHistoryModal.vue";
import UpgradeTierModal from "@/components/UpgradeTierModal.vue";

export default {
  name: "DashboardPage",
  components: {
    TransactionHistoryModal,
    UpgradeTierModal,
  },
  data() {
    return {
      userProfile: null,
      loadingUser: true,
      error: null,
      historyModal: {
        visible: false,
        type: "",
      },
      upgradeModalVisible: false,
    };
  },
  computed: {
    cycleProgress() {
      if (
        !this.userProfile ||
        !this.userProfile.cycleCap ||
        this.userProfile.cycleCap === 0
      ) {
        return 0;
      }
      const progress =
        (this.userProfile.currentCycleEarnings / this.userProfile.cycleCap) *
        100;
      return Math.min(progress, 100);
    },
  },
  async created() {
    await this.fetchUserProfile();
  },
  methods: {
    async fetchUserProfile() {
      this.loadingUser = true;
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
            const data = userSnap.data();
            this.userProfile = {
              ...data,
              tier: data.tier || "BRONZE",
              investmentAmount: data.investmentAmount || 0,
              cycleCap: data.cycleCap || 0,
              currentCycleEarnings: data.currentCycleEarnings || 0,
              cashBalance: data.cashBalance || 0,
              saltmatePoints: data.saltmatePoints || 0,
              cobsBalance: data.cobsBalance || 0,
              bndBalance: data.bndBalance || 0,
            };
          } else {
            this.error = "사용자 프로필을 찾을 수 없습니다.";
          }
        }
      } catch (e) {
        console.error("사용자 프로필 가져오기 실패:", e);
        this.error = "프로필 로딩에 실패했습니다.";
      } finally {
        this.loadingUser = false;
      }
    },
    getTierClass(tier) {
      if (!tier) return "default";
      if (tier === "승인대기중") return "pending";
      return tier.toLowerCase();
    },
    openHistoryModal(type) {
      this.historyModal.type = type;
      this.historyModal.visible = true;
    },
    openUpgradeModal() {
      this.upgradeModalVisible = true;
    },
  },
};
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
  max-width: 1200px;
  margin: 70px auto 20px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.dashboard-header h2 {
  font-size: 2.2em;
  color: #333;
  text-align: center;
}
.card {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}
.performance-card {
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: #fff;
  padding: 25px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid hsla(0, 0%, 100%, 0.3);
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.card-header h3 {
  font-size: 1.5em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.tier-badge {
  font-size: 1em;
  font-weight: 700;
  padding: 6px 15px;
  border-radius: 20px;
  background-color: hsla(0, 0%, 100%, 0.2);
  text-transform: uppercase;
}
.tier-badge.pending {
  background-color: #ffc107;
  color: #212529;
}
.investment-info {
  text-align: center;
  margin-bottom: 20px;
  padding: 10px;
  background: hsla(0, 0%, 100%, 0.1);
  border-radius: 8px;
}
.investment-info span {
  opacity: 0.9;
  margin-right: 10px;
  font-size: 1.1em;
}
.investment-info strong {
  font-size: 1.3em;
  font-weight: 700;
}
.performance-body h4 {
  font-size: 1.1em;
  margin-bottom: 10px;
  font-weight: 500;
}
.progress-bar-container {
  width: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  height: 20px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #17a2b8, #28a745);
  border-radius: 10px;
  transition: width 0.5s ease-in-out;
}
.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 0.9em;
  opacity: 0.9;
}
.balances {
  margin-top: 25px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  text-align: center;
}
.balance-item {
  background: rgba(0, 0, 0, 0.15);
  padding: 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.3s;
}
.balance-item:hover {
  background: rgba(0, 0, 0, 0.25);
}
.balance-item label {
  display: block;
  font-size: 1em;
  margin-bottom: 8px;
  opacity: 0.8;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.balance-item span {
  font-size: 2em;
  font-weight: 700;
  line-height: 1;
}
.balance-item small {
  font-size: 1em;
  margin-left: 5px;
}
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 30px;
}
.feature-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  padding: 30px;
  border-radius: 15px;
  background-color: #fff;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  position: relative;
  min-height: 220px;
}
.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
}
.card-icon {
  font-size: 2.5em;
  margin-bottom: 15px;
}
.feature-card h3 {
  font-size: 1.6em;
  margin: 0 0 10px;
}
.feature-card p {
  font-size: 1em;
  color: #666;
  line-height: 1.5;
  flex-grow: 1;
}
.card-enter {
  font-weight: 700;
  color: #007bff;
  align-self: flex-end;
  transition: color 0.3s ease;
}
.feature-card:hover .card-enter {
  color: #0056b3;
}
.feature-card.equity .card-icon {
  color: #fd7e14;
}
.feature-card.events .card-icon {
  color: #28a745;
}
.feature-card.mall .card-icon {
  color: #6f42c1;
}
.feature-card.nft .card-icon {
  color: #17a2b8;
}
.feature-card.revenue .card-icon {
  color: #dc3545;
}
.feature-card.tokens .card-icon {
  color: #ffc107;
}
.token-glance {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}
.token-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 1.1em;
}
.token-item img {
  height: 24px;
}
.upgrade-action {
  margin-top: 20px;
  text-align: center;
}
.upgrade-button {
  background-color: #ffc107;
  color: #212529;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}
.upgrade-button:disabled {
  background-color: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
}
.upgrade-button:hover:not(:disabled) {
  background-color: #e0a800;
  transform: translateY(-2px);
}
</style>

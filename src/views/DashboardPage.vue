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
            userProfile?.tier
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
          <h4>
            수익 사이클 ({{ cycleProgress.toFixed(1) }}% /
            {{ (marketingPlan?.cycleCapMultiplier || 3) * 100 }}%)
          </h4>
          <div class="progress-bar-container">
            <div
              class="progress-bar-fill"
              :style="{ width: cycleProgress + '%' }"
            >
              <i class="fas fa-running running-man"></i>
            </div>
          </div>
          <div class="progress-labels">
            <span
              class="current-earnings clickable"
              @click="openCycleEarningsModal"
            >
              {{ (userProfile?.currentCycleEarnings || 0).toLocaleString() }} 원
            </span>
            <span class="cycle-cap">
              달성 목표: {{ (userProfile?.cycleCap || 0).toLocaleString() }} 원
            </span>
          </div>
        </div>
        <div class="balances">
          <div class="balance-item cash" @click="openHistoryModal('CASH')">
            <label><i class="fas fa-wallet"></i> 현금성 수익</label>
            <span>{{ (userProfile?.cashBalance || 0).toLocaleString() }}</span>
            <small>원</small>
            <div class="withdrawal-action">
              <button
                class="withdrawal-button"
                :disabled="!isWithdrawalEnabled"
                @click.stop="openWithdrawalModal"
              >
                출금 신청하기
              </button>
              <small v-if="!isWithdrawalEnabled" class="withdrawal-notice">
                신청 가능 시간: 매주 화 09:00-17:00
              </small>
            </div>
          </div>
          <div
            class="balance-item saltmate"
            @click="openHistoryModal('SALTMATE')"
          >
            <div class="balance-content">
              <div class="balance-label">
                <i class="fas fa-gifts"></i> 솔트메이트
              </div>
              <div class="balance-value">
                {{ (userProfile?.saltmatePoints || 0).toLocaleString() }}
              </div>
              <div class="balance-unit">SaltMate</div>
            </div>
            <div class="shimmer-effect"></div>
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
      <div class="dashboard-grid"></div>
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
    <WithdrawalRequestModal
      v-if="isWithdrawalModalVisible"
      :userProfile="userProfile"
      @close="isWithdrawalModalVisible = false"
    />
    <CycleEarningsModal
      v-if="isCycleModalVisible"
      @close="isCycleModalVisible = false"
    />
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import TransactionHistoryModal from "@/components/TransactionHistoryModal.vue";
import UpgradeTierModal from "@/components/UpgradeTierModal.vue";
import WithdrawalRequestModal from "@/components/WithdrawalRequestModal.vue";
import CycleEarningsModal from "@/components/CycleEarningsModal.vue";

export default {
  name: "DashboardPage",
  components: {
    TransactionHistoryModal,
    UpgradeTierModal,
    WithdrawalRequestModal,
    CycleEarningsModal,
  },
  data() {
    return {
      userProfile: null,
      loadingUser: true,
      error: null,
      historyModal: { visible: false, type: "" },
      upgradeModalVisible: false,
      isWithdrawalModalVisible: false,
      isCycleModalVisible: false,
      marketingPlan: null,
      unsubscribe: null,
    };
  },
  computed: {
    // ...
  },
  created() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.listenToUserProfile(user.uid);
        this.fetchMarketingPlan();
      } else {
        this.loadingUser = false;
      }
    });
  },
  // ...
  methods: {
    // ...
    async fetchMarketingPlan() {
      const planRef = doc(db, "configuration", "marketingPlan");
      const docSnap = await getDoc(planRef);
      if (docSnap.exists()) {
        this.marketingPlan = docSnap.data();
      }
    },
    openCycleEarningsModal() {
      this.isCycleModalVisible = true;
    },
  },
};
</script>

<style scoped>
.clickable {
  cursor: pointer;
  text-decoration: underline;
}
.clickable:hover {
  color: #aed6f1;
}
.dashboard-container {
  padding: 20px;
  max-width: 1200px;
  margin: 70px auto 20px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.dashboard-header {
  text-align: center;
  margin-bottom: 30px;
}
.dashboard-header h2 {
  font-size: 2.2em;
  color: #333;
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
  padding: 8px 18px;
  border-radius: 20px;
  text-transform: uppercase;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.2),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}
.tier-badge:hover {
  transform: scale(1.05);
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
}
.tier-badge.pending {
  background: linear-gradient(135deg, #ffc107, #ff9800);
  color: #333;
}
.tier-badge.bronze {
  background: linear-gradient(135deg, #cd7f32, #a0522d);
}
.tier-badge.premium {
  background: linear-gradient(135deg, #c0c0c0, #a9a9a9);
}
.tier-badge.vip {
  background: linear-gradient(135deg, #ffd700, #f0c000);
}
.tier-badge.vvip {
  background: linear-gradient(135deg, #e5e5e5, #b8b8b8);
  text-shadow: 0 0 5px #fff;
}
.tier-badge.infinite {
  background: linear-gradient(135deg, #4d4d4d, #1a1a1a);
  text-shadow: 0 0 8px #fff;
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
  border-radius: 20px;
  height: 24px;
  overflow: hidden;
  position: relative;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #17a2b8, #28a745);
  border-radius: 20px;
  transition: width 0.8s cubic-bezier(0.25, 1, 0.5, 1);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.running-man {
  color: white;
  font-size: 1.2em;
  margin-right: 10px;
  animation: running-animation 0.7s infinite alternate;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
@keyframes running-animation {
  from {
    transform: translateY(0px);
  }
  to {
    transform: translateY(-3px);
  }
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
.balance-item.cash label {
  display: block;
  font-size: 1em;
  margin-bottom: 8px;
  opacity: 0.8;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.balance-item.cash span {
  font-size: 2em;
  font-weight: 700;
  line-height: 1;
}
.balance-item.cash small {
  font-size: 1em;
  margin-left: 5px;
}
.balance-item.saltmate {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px 20px;
  transition: all 0.3s ease;
}
.balance-item.saltmate:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 15px 30px rgba(118, 75, 162, 0.5);
}
.balance-content {
  text-align: center;
  z-index: 1;
}
.balance-label {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: 1.1em;
  font-weight: 500;
  opacity: 0.9;
  margin-bottom: 15px;
}
.balance-value {
  font-size: 2.8em;
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.balance-unit {
  font-size: 1.2em;
  font-weight: 500;
  opacity: 0.9;
  letter-spacing: 1px;
  margin-top: 5px;
}
.shimmer-effect {
  position: absolute;
  top: 0;
  left: -150%;
  width: 75%;
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: skewX(-25deg);
  animation: shimmer 5s infinite;
}
@keyframes shimmer {
  100% {
    left: 150%;
  }
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
.withdrawal-action {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid hsla(0, 0%, 100%, 0.2);
}
.withdrawal-button {
  width: 100%;
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}
.withdrawal-button:disabled {
  background-color: #5a6268;
  cursor: not-allowed;
  opacity: 0.7;
}
.withdrawal-notice {
  display: block;
  margin-top: 8px;
  font-size: 0.8em;
  opacity: 0.9;
  text-align: center;
}
</style>

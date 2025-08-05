<template>
  <div class="dashboard-container">
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
        <router-link to="/network-tree" class="feature-card">
          <div class="card-icon"><i class="fas fa-sitemap"></i></div>
          <h3>나의 추천 네트워크</h3>
          <p>나의 하위 추천 라인을 시각적으로 확인합니다.</p>
          <span class="card-enter">확인하기 &rarr;</span>
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
    <WithdrawalRequestModal
      v-if="isWithdrawalModalVisible"
      :userProfile="userProfile"
      @close="isWithdrawalModalVisible = false"
    />
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import TransactionHistoryModal from "@/components/TransactionHistoryModal.vue";
import UpgradeTierModal from "@/components/UpgradeTierModal.vue";
import WithdrawalRequestModal from "@/components/WithdrawalRequestModal.vue";

export default {
  name: "DashboardPage",
  components: {
    TransactionHistoryModal,
    UpgradeTierModal,
    WithdrawalRequestModal,
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
      isWithdrawalModalVisible: false,
      unsubscribe: null,
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
    isWithdrawalEnabled() {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      return day === 2 && hour >= 9 && hour < 17;
    },
  },
  created() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.listenToUserProfile(user.uid);
      } else {
        this.loadingUser = false;
      }
    });
  },
  unmounted() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  },
  methods: {
    listenToUserProfile(uid) {
      this.loadingUser = true;
      const userRef = doc(db, "users", uid);
      this.unsubscribe = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
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
          this.loadingUser = false;
        },
        (e) => {
          console.error("사용자 프로필 실시간 수신 실패:", e);
          this.error = "프로필 로딩에 실패했습니다.";
          this.loadingUser = false;
        },
      );
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
    openWithdrawalModal() {
      this.isWithdrawalModalVisible = true;
    },
  },
};
</script>

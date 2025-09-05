<template>
  <div class="dashboard-container">
    <section v-if="notices.length > 0" class="notice-section card">
      <div class="notice-header">
        <h3><i class="fas fa-bullhorn"></i> 공지사항</h3>
        <router-link to="/community/notices" class="more-link"
          >더보기</router-link
        >
      </div>
      <ul class="notice-list">
        <li v-for="notice in notices" :key="notice.id">
          <router-link :to="`/community/post/${notice.id}`" class="notice-link">
            <span class="notice-title">{{ notice.title }}</span>
            <span class="notice-date">{{ formatDate(notice.createdAt) }}</span>
          </router-link>
        </li>
      </ul>
    </section>

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

        <div class="subscription-status-card" :class="subscriptionStatusClass">
          <div class="status-header">
            <i class="fas fa-calendar-alt"></i>
            <h4>월간 구독 현황</h4>
          </div>
          <div v-if="!userProfile?.nextPaymentDueDate">
            <p>구독 정보 로딩 중...</p>
          </div>
          <div v-else-if="userProfile?.subscriptionStatus === 'active'">
            <p>
              다음 결제일까지
              <strong>{{ daysUntilPayment }}일</strong> 남았습니다.
            </p>
            <button
              @click="requestPayment"
              class="btn-pay"
              :disabled="isRequestingPayment"
            >
              <span v-if="isRequestingPayment" class="spinner-small"></span>
              <span v-else>월간 구독 미리 결제하기</span>
            </button>
          </div>
          <div v-else-if="userProfile?.subscriptionStatus === 'overdue'">
            <p><strong>결제일이 지났습니다.</strong></p>
            <p class="warning-text">
              일부 기능이 제한됩니다. 지금 바로 결제해주세요.
            </p>
            <button
              @click="requestPayment"
              class="btn-pay urgent"
              :disabled="isRequestingPayment"
            >
              <span v-if="isRequestingPayment" class="spinner-small"></span>
              <span v-else>지금 결제하기</span>
            </button>
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
        <LiveGameFeed />
        <LeaderboardWidget />
        <WeeklyLeaderboardWidget />
	<SaltPangHallOfFame />
	<router-link to="/attendance" class="feature-card events">
	  <div class="card-icon"><i class="fas fa-calendar-check"></i></div>
	  <h3>매일매일 출석체크</h3>
	  <p>매일 접속하여 SaltMate와 특별한 쿠폰 보상을 받으세요!</p>
	  <span class="card-enter">참여하기 &rarr;</span>
	</router-link>
        <router-link to="/my-tokens" class="feature-card tokens">
          <div class="card-icon"><i class="fas fa-coins"></i></div>
          <h3>보유 토큰 현황</h3>
          <p>COBS, BND, SSC 토큰의 수량과 가치를 확인하세요.</p>
          <div class="token-glance">
            <div class="token-item">
              <img src="@/assets/COBS.png" alt="COBS" />
              <span>{{
                (userProfile?.tokens?.cobs || 0).toLocaleString()
              }}</span>
            </div>
            <div class="token-item">
              <img src="@/assets/BND_LOGO.png" alt="BND" />
              <span>{{
                (userProfile?.tokens?.bnd || 0).toLocaleString()
              }}</span>
            </div>
            <div class="token-item">
              <img src="@/assets/SSC_LOGO.png" alt="SSC" />
              <span>{{
                (userProfile?.tokens?.ssc || 0).toLocaleString()
              }}</span>
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
        <router-link to="/game-zone" class="feature-card game">
          <div class="card-icon"><i class="fas fa-gamepad"></i></div>
          <h3>럭키 룰렛</h3>
          <p>매일 한 번, 행운의 룰렛을 돌리고 SaltMate 포인트를 획득하세요!</p>
          <span class="card-enter">게임 시작 &rarr;</span>
        </router-link>
        <router-link to="/treasure-box" class="feature-card treasure">
          <div class="card-icon"><i class="fas fa-box"></i></div>
          <h3>보물상자 열기</h3>
          <p>매일 한 번, 행운의 상자를 열고 SaltMate 포인트를 획득하세요!</p>
          <span class="card-enter">참여하기 &rarr;</span>
        </router-link>
        <router-link to="/high-low-game" class="feature-card game">
          <div class="card-icon">
            <i class="fas fa-arrow-up"></i><i class="fas fa-arrow-down"></i>
          </div>
          <h3>하이로우</h3>
          <p>다음 숫자가 높을지 낮을지 예측하고 SaltMate를 획득하세요!</p>
          <span class="card-enter">도전하기 &rarr;</span>
        </router-link>
        <router-link to="/rps-game" class="feature-card game">
          <div class="card-icon"><i class="fas fa-hand-scissors"></i></div>
          <h3>가위바위보</h3>
          <p>컴퓨터를 상대로 가위바위보에서 승리하고 SaltMate를 획득하세요!</p>
          <span class="card-enter">게임 시작 &rarr;</span>
        </router-link>
        <router-link to="/salt-game" class="feature-card salt-game">
          <div class="card-icon"><i class="fas fa-gem"></i></div>
          <h3>소금 결정 키우기</h3>
          <p>결정을 클릭하여 키우고 SaltMate 포인트를 수확하세요!</p>
          <span class="card-enter">플레이 &rarr;</span>
        </router-link>
        <router-link to="/salt-mine-game" class="feature-card salt-mine-game">
          <div class="card-icon"><i class="fas fa-gem"></i></div>
          <h3>소금 광산</h3>
          <p>소금을 채굴하고 업그레이드하여 SaltMate 포인트를 획득하세요!</p>
          <span class="card-enter">입장하기 &rarr;</span>
        </router-link>
        <router-link to="/deep-sea-game" class="feature-card deep-sea-game">
          <div class="card-icon"><i class="fas fa-water"></i></div>
          <h3>해양심층수 탐험</h3>
          <p>심층수를 채집하고 장비를 업그레이드하여 자금을 모으세요.</p>
          <span class="card-enter">탐험 시작 &rarr;</span>
        </router-link>
        <router-link to="/salt-pang" class="feature-card game">
          <div class="card-icon"><i class="fas fa-puzzle-piece"></i></div>
          <h3>솔트팡</h3>
          <p>같은 모양의 소금 결정을 3개 이상 맞춰 포인트를 획득하세요!</p>
          <span class="card-enter">게임 시작 &rarr;</span>
        </router-link>
      </div>
    </main>
    <TransactionHistoryModal
      v-if="historyModal.visible"
      :balanceType="historyModal.type"
      :currentBalance="
        historyModal.type === 'CASH'
          ? userProfile.cashBalance
          : userProfile.saltmatePoints
      "
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
import { auth, db, functions } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import TransactionHistoryModal from "@/components/TransactionHistoryModal.vue";
import UpgradeTierModal from "@/components/UpgradeTierModal.vue";
import WithdrawalRequestModal from "@/components/WithdrawalRequestModal.vue";
import CycleEarningsModal from "@/components/CycleEarningsModal.vue";
import LiveGameFeed from "@/components/LiveGameFeed.vue";
import LeaderboardWidget from "@/components/LeaderboardWidget.vue";
import WeeklyLeaderboardWidget from "@/components/WeeklyLeaderboardWidget.vue";
import SaltPangHallOfFame from "@/components/SaltPangHallOfFame.vue"; // [신규 추가]s

export default {
  name: "DashboardPage",
  components: {
    TransactionHistoryModal,
    UpgradeTierModal,
    WithdrawalRequestModal,
    CycleEarningsModal,
    LiveGameFeed,
    LeaderboardWidget,
    WeeklyLeaderboardWidget, // [수정] 컴포넌트 등록
    SaltPangHallOfFame, // [신규 추가]
    export default {
  },
  data() {
    return {
      userProfile: null,
      loadingUser: true,
      error: null,
      notices: [],
      historyModal: { visible: false, type: "" },
      upgradeModalVisible: false,
      isWithdrawalModalVisible: false,
      isCycleModalVisible: false,
      marketingPlan: null,
      unsubscribe: null,
      isRequestingPayment: false,
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
      return Math.min(
        (this.userProfile.currentCycleEarnings / this.userProfile.cycleCap) *
          100,
        100,
      );
    },
    isWithdrawalEnabled() {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      return day === 2 && hour >= 9 && hour < 17;
    },
    daysUntilPayment() {
      if (!this.userProfile?.nextPaymentDueDate) {
        return "N/A";
      }
      const dueDate = this.userProfile.nextPaymentDueDate.toDate();
      const today = new Date();
      dueDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    },
    subscriptionStatusClass() {
      if (!this.userProfile?.subscriptionStatus) return "";
      return `status-${this.userProfile.subscriptionStatus}`;
    },
  },
  created() {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.listenToUserProfile(user.uid);
        this.fetchMarketingPlan();
        this.fetchNotices();
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
    async requestPayment() {
      if (
        !confirm(
          "월간 구독료(만원의 행복) 결제를 요청하시겠습니까? 관리자 확인 후 승인 처리됩니다.",
        )
      )
        return;
      this.isRequestingPayment = true;
      try {
        const requestMonthlyPayment = httpsCallable(
          functions,
          "requestMonthlyPayment",
        );
        await requestMonthlyPayment();
        alert(
          "결제 요청이 완료되었습니다. 관리자가 승인하면 구독 상태가 갱신됩니다.",
        );
      } catch (error) {
        console.error("월간 결제 요청 오류:", error);
        alert(`오류가 발생했습니다: ${error.message}`);
      } finally {
        this.isRequestingPayment = false;
      }
    },
    listenToUserProfile(uid) {
      this.loadingUser = true;
      const userRef = doc(db, "users", uid);
      this.unsubscribe = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            this.userProfile = docSnap.data();
          } else {
            this.error = "사용자 프로필을 찾을 수 없습니다.";
          }
          this.loadingUser = false;
        },
        (e) => {
          console.error("프로필 실시간 수신 실패:", e);
          this.error = "프로필 로딩에 실패했습니다.";
          this.loadingUser = false;
        },
      );
    },
    async fetchMarketingPlan() {
      const planRef = doc(db, "configuration", "marketingPlan");
      const docSnap = await getDoc(planRef);
      if (docSnap.exists()) {
        this.marketingPlan = docSnap.data();
      }
    },
    async fetchNotices() {
      try {
        const q = query(
          collection(db, "posts"),
          where("category", "==", "notices"),
          orderBy("createdAt", "desc"),
          limit(3),
        );
        const querySnapshot = await getDocs(q);
        this.notices = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("공지사항 로딩 오류:", error);
      }
    },
    formatDate(timestamp) {
      if (!timestamp?.toDate) return "";
      return timestamp.toDate().toLocaleDateString("ko-KR");
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
    openCycleEarningsModal() {
      this.isCycleModalVisible = true;
    },
  },
};
</script>

<style scoped>
/* (스타일은 기존 코드와 동일합니다. 변경사항 없습니다.) */
.subscription-status-card {
  margin-top: 25px;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid hsla(0, 0%, 100%, 0.3);
  background: hsla(0, 0%, 100%, 0.1);
  transition: all 0.3s ease;
}
.subscription-status-card.status-overdue {
  background: hsla(0, 80%, 60%, 0.2);
  border-color: hsla(0, 80%, 70%, 0.5);
}
.status-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.status-header h4 {
  margin: 0;
  font-size: 1.1em;
}
.subscription-status-card p {
  margin: 0 0 15px 0;
  font-size: 1.05em;
}
.warning-text {
  font-size: 0.9em !important;
  opacity: 0.9;
}
.btn-pay {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background-color: #17a2b8;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-pay.urgent {
  background-color: #dc3545;
}
.btn-pay:disabled {
  background-color: #5a6268;
  cursor: not-allowed;
}
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.feature-card.game .card-icon {
  color: #e74c3c;
}
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
  margin: 10px auto 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.notice-section {
  padding: 20px 25px;
  margin-bottom: 30px;
}
.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.notice-header h3 {
  margin: 0;
  font-size: 1.4em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.more-link {
  font-size: 0.9em;
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}
.notice-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.notice-link {
  display: flex;
  justify-content: space-between;
  padding: 10px 5px;
  text-decoration: none;
  color: #333;
  border-radius: 5px;
  transition: background-color 0.2s ease;
}
.notice-link:hover {
  background-color: #f8f9fa;
}
.notice-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}
.notice-date {
  color: #888;
  flex-shrink: 0;
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
  grid-template-columns: repeat(2, 1fr);
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
  margin-top: 30px;
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
.feature-card.treasure .card-icon {
  color: #e67e22;
}
.feature-card.salt-game .card-icon {
  color: #3498db;
}
.feature-card.salt-mine-game .card-icon {
  color: #ffd166;
}
.feature-card.deep-sea-game .card-icon {
  color: #17a2b8;
}
@media (max-width: 768px) {
  .balances {
    grid-template-columns: 1fr; /* 화면이 좁아지면 1개의 열(세로 배치)로 변경 */
  }
}
</style>

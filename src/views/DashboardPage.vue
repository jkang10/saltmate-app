<template>
  <div>
    <AnnouncementTicker />
    <div class="dashboard-container">
      <section v-if="latestJackpotWinner" class="jackpot-winner-card card">
        <p>
          <i class="fas fa-trophy"></i>
          축하합니다! <strong>{{ latestJackpotWinner.userName }}</strong> 님께서 솔트팡 잭팟
          <strong>{{ latestJackpotWinner.amount.toLocaleString() }} SaltMate</strong>에 당첨되셨습니다!
        </p>
      </section>
      <section v-if="notices.length > 0" class="notice-section card">
        <div class="notice-header">
          <h3><i class="fas fa-bullhorn"></i> 공지사항</h3>
          <router-link to="/community/notices" class="more-link">더보기</router-link>
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
            <span :class="['tier-badge', getTierClass(userProfile?.tier)]">{{ userProfile?.tier }}</span>
          </div>
          <div class="investment-info">
            <span>나의 구독 원금</span>
            <strong>{{ (userProfile?.investmentAmount || 0).toLocaleString() }} 원</strong>
          </div>
          <div class="performance-body">
            <h4>
              수익 사이클 ({{ cycleProgress.toFixed(1) }}% / {{ (marketingPlan?.cycleCapMultiplier || 3) * 100 }}%)
            </h4>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" :style="{ width: cycleProgress + '%' }">
                <i class="fas fa-running running-man"></i>
              </div>
            </div>
            <div class="progress-labels">
              <span class="current-earnings clickable" @click="openCycleEarningsModal">
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
                <button class="withdrawal-button" :disabled="!isWithdrawalEnabled" @click.stop="openWithdrawalModal">
                  출금 신청하기
                </button>
                <small v-if="!isWithdrawalEnabled" class="withdrawal-notice">
                  신청 가능 시간: 매주 화 09:00-17:00
                </small>
              </div>
            </div>
            <div class="balance-item saltmate" @click="openHistoryModal('SALTMATE')">
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
                다음 결제일까지 <strong>{{ daysUntilPayment }}일</strong> 남았습니다.
              </p>
              <button @click="requestPayment" class="btn-pay" :disabled="isRequestingPayment">
                <span v-if="isRequestingPayment" class="spinner-small"></span>
                <span v-else>월간 구독 미리 결제하기</span>
              </button>
            </div>
            <div v-else-if="userProfile?.subscriptionStatus === 'overdue'">
              <p><strong>결제일이 지났습니다.</strong></p>
              <p class="warning-text">
                일부 기능이 제한됩니다. 지금 바로 결제해주세요.
              </p>
              <button @click="requestPayment" class="btn-pay urgent" :disabled="isRequestingPayment">
                <span v-if="isRequestingPayment" class="spinner-small"></span>
                <span v-else>지금 결제하기</span>
              </button>
            </div>
          </div>
          <div class="upgrade-action">
            <button @click="openUpgradeModal" class="upgrade-button" :disabled="userProfile?.tier === '승인대기중'">
              <i class="fas fa-arrow-up"></i> 등급 추가 구매
            </button>
          </div>
        </section>

        <div class="dashboard-grid">
          <LiveGameFeed />
          <LeaderboardWidget />
          <WeeklyLeaderboardWidget />
          <SaltPangHallOfFame />
          <ChallengeRankingsWidget />
          <SaltPangRankedWidget />
	        <EnchantRankingsWidget />
          
          <router-link v-for="card in featureCards" :key="card.to" :to="card.to" class="feature-card" :class="card.className">
            <button class="favorite-toggle" @click.prevent="toggleFavorite(card.to)" :title="isFavorite(card.to) ? '즐겨찾기 해제' : '즐겨찾기 추가'">
              <i :class="isFavorite(card.to) ? 'fas fa-heart' : 'far fa-heart'"></i>
            </button>
            <div class="card-icon"><i :class="card.icon"></i></div>
            <h3>{{ card.title }}</h3>
            <p>{{ card.description }}</p>
            <span class="card-enter">{{ card.actionText }} &rarr;</span>
          </router-link>
        </div>
      </main>

      <TransactionHistoryModal v-if="historyModal.visible" :balanceType="historyModal.type" :currentBalance=" historyModal.type === 'CASH' ? userProfile.cashBalance : userProfile.saltmatePoints" @close="historyModal.visible = false" />
      <UpgradeTierModal v-if="upgradeModalVisible" @close="upgradeModalVisible = false" />
      <WithdrawalRequestModal v-if="isWithdrawalModalVisible" :userProfile="userProfile" @close="isWithdrawalModalVisible = false" />
      <CycleEarningsModal v-if="isCycleModalVisible" @close="isCycleModalVisible = false" />
    </div>

    <div v-if="favoriteItems.length > 0" class="favorites-widget">
      <div class="widget-header" @click="isWidgetExpanded = !isWidgetExpanded">
        <i class="fas fa-star"></i>
        <span>즐겨찾기</span>
        <i class="fas fa-chevron-up" :class="{ 'expanded': isWidgetExpanded }"></i>
      </div>
      <transition name="widget-slide">
        <div v-if="isWidgetExpanded" class="widget-body">
          <router-link v-for="item in favoriteItems" :key="item.to" :to="item.to" class="widget-item">
            <i :class="item.icon"></i>
            <span>{{ item.title }}</span>
          </router-link>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import { auth, db, functions } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, onSnapshot } from "firebase/firestore";
import TransactionHistoryModal from "@/components/TransactionHistoryModal.vue";
import UpgradeTierModal from "@/components/UpgradeTierModal.vue";
import WithdrawalRequestModal from "@/components/WithdrawalRequestModal.vue";
import CycleEarningsModal from "@/components/CycleEarningsModal.vue";
import LiveGameFeed from "@/components/LiveGameFeed.vue";
import LeaderboardWidget from "@/components/LeaderboardWidget.vue";
import WeeklyLeaderboardWidget from "@/components/WeeklyLeaderboardWidget.vue";
import SaltPangHallOfFame from "@/components/SaltPangHallOfFame.vue";
import ChallengeRankingsWidget from "@/components/ChallengeRankingsWidget.vue";
import SaltPangRankedWidget from "@/components/SaltPangRankedWidget.vue";
import AnnouncementTicker from '@/components/AnnouncementTicker.vue';
import EnchantRankingsWidget from '@/components/EnchantRankingsWidget.vue';

export default {
  name: "DashboardPage",
  components: {
    TransactionHistoryModal, UpgradeTierModal, WithdrawalRequestModal, CycleEarningsModal, LiveGameFeed,
    LeaderboardWidget, WeeklyLeaderboardWidget, SaltPangHallOfFame, ChallengeRankingsWidget,
    SaltPangRankedWidget, AnnouncementTicker, EnchantRankingsWidget,
  },
  data() {
    return {
      // --- [신규] 카드 데이터 및 즐겨찾기 상태 ---
      featureCards: [
        { to: '/attendance', className: 'events', icon: 'fas fa-calendar-check', title: '매일매일 출석체크', description: '매일 접속하여 SaltMate와 특별한 쿠폰 보상을 받으세요!', actionText: '참여하기' },
        { to: '/qr-scanner', className: 'qr-scanner', icon: 'fas fa-qrcode', title: '센터 방문 QR 인증', description: '센터에 방문하여 QR코드를 스캔하고 1,000 SaltMate를 획득하세요!', actionText: '인증하기' },
        { to: '/my-tokens', className: 'tokens', icon: 'fas fa-coins', title: '보유 토큰 현황', description: 'COBS, BND, SSC 토큰의 수량과 가치를 확인하세요.', actionText: '자세히 보기' },
        { to: '/salt-pang', className: 'game', icon: 'fas fa-puzzle-piece', title: '솔트팡', description: '같은 모양의 소금 결정을 3개 이상 맞춰 포인트를 획득하세요!', actionText: '게임 시작' },
        { to: '/ladder-game', className: 'game', icon: 'fas fa-stream', title: '사다리타기', description: '운명의 사다리를 타고 행운의 SaltMate를 획득하세요!', actionText: '도전하기' },
        { to: '/salt-pot-gacha', className: 'treasure', icon: 'fas fa-wine-bottle', title: '소금 항아리', description: '매일 한 번, 항아리를 열고 대박 포인트를 노려보세요!', actionText: '열어보기' },
        { to: '/auction', className: 'game', icon: 'fas fa-gavel', title: '주간 경매', description: '최고가에 도전하여 희귀 아이템을 획득하세요!', actionText: '입장하기' },
        { to: '/prediction-betting', className: 'game', icon: 'fas fa-chart-bar', title: '랭킹 예측', description: '솔트팡 랭킹전 우승자를 예측하고 대박을 노리세요!', actionText: '참여하기' },
        { to: '/salt-trader', className: '', icon: 'fas fa-exchange-alt', title: '소금 상인', description: '변동하는 시세에 맞춰 소금을 사고팔아 수익을 내보세요.', actionText: '거래하기' },
        { to: '/enchanting', className: '', icon: 'fas fa-magic', title: '아이템 강화', description: 'SaltMate를 사용하여 아이템을 강화하고 더 강해지세요!', actionText: '강화하기' },
        { to: "/high-low-game", className: "game", icon: "fas fa-arrows-alt-v", title: "하이로우", description: "다음 숫자가 높을지 낮을지 예측하고 SaltMate를 획득하세요!", actionText: "도전하기" },
        { to: "/rps-game", className: "game", icon: "fas fa-hand-scissors", title: "가위바위보", description: "컴퓨터를 상대로 승리하고 SaltMate를 획득하세요!", actionText: "게임 시작" },
        { to: "/salt-game", className: "salt-game", icon: "fas fa-gem", title: "소금 결정 키우기", description: "결정을 클릭하여 키우고 SaltMate 포인트를 수확하세요!", actionText: "플레이" },
        { to: "/salt-mine-game", className: "salt-mine-game", icon: "fas fa-gem", title: "소금 광산", description: "소금을 채굴하고 업그레이드하여 포인트를 획득하세요!", actionText: "입장하기" },
        { to: "/deep-sea-game", className: "deep-sea-game", icon: "fas fa-water", title: "해양심층수 탐험", description: "심층수를 채집하고 장비를 업그레이드하여 자금을 모으세요.", actionText: "탐험 시작" },
      ],
      favorites: [],
      isWidgetExpanded: true,
      
      // --- 기존 data 속성들은 그대로 유지 ---
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
      latestJackpotWinner: null,
      unsubscribeJackpot: null,
    };
  },
  computed: {
    // --- [신규] 즐겨찾기 관련 computed ---
    favoriteItems() {
      return this.featureCards.filter(card => this.favorites.includes(card.to));
    },
    // --- 기존 computed 속성들은 그대로 유지 ---
    cycleProgress() {
      if (!this.userProfile || !this.userProfile.cycleCap || this.userProfile.cycleCap === 0) return 0;
      return Math.min((this.userProfile.currentCycleEarnings / this.userProfile.cycleCap) * 100, 100);
    },
    isWithdrawalEnabled() {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      return day === 2 && hour >= 9 && hour < 17;
    },
    daysUntilPayment() {
      if (!this.userProfile?.nextPaymentDueDate) return "N/A";
      const dueDate = this.userProfile.nextPaymentDueDate.toDate();
      const today = new Date();
      dueDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    },
    subscriptionStatusClass() {
      if (!this.userProfile?.subscriptionStatus) return "";
      return `status-${this.userProfile.subscriptionStatus}`;
    },
  },
  created() {
    this.loadFavorites(); // [신규] 즐겨찾기 불러오기
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.listenToUserProfile(user.uid);
        this.fetchMarketingPlan();
        this.fetchNotices();
        this.listenToLatestJackpot();
      } else {
        this.loadingUser = false;
      }
    });
  },
  unmounted() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.unsubscribeJackpot) this.unsubscribeJackpot();
  },
  methods: {
    // --- [신규] 즐겨찾기 관련 메소드 ---
    isFavorite(cardTo) {
      return this.favorites.includes(cardTo);
    },
    toggleFavorite(cardTo) {
      const index = this.favorites.indexOf(cardTo);
      if (index > -1) {
        this.favorites.splice(index, 1);
      } else {
        if (this.favorites.length >= 5) {
            alert('즐겨찾기는 최대 5개까지 추가할 수 있습니다.');
            return;
        }
        this.favorites.push(cardTo);
      }
      localStorage.setItem('dashboardFavorites', JSON.stringify(this.favorites));
    },
    loadFavorites() {
      const saved = localStorage.getItem('dashboardFavorites');
      if (saved) {
        this.favorites = JSON.parse(saved);
      }
    },
    // --- 기존 methods 들은 그대로 유지 ---
    listenToLatestJackpot() {
      const q = query(collection(db, "saltPangJackpotWins"), orderBy("wonAt", "desc"), limit(1));
      this.unsubscribeJackpot = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) this.latestJackpotWinner = snapshot.docs[0].data();
      });
    },

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
/* --- [핵심 추가] 즐겨찾기 버튼 스타일 --- */
.feature-card {
  position: relative;
}
.favorite-toggle {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  font-size: 1.5em;
  color: #ccc;
  cursor: pointer;
  z-index: 2;
  transition: all 0.2s;
}
.favorite-toggle:hover {
  transform: scale(1.2);
}
.favorite-toggle .fas.fa-heart { /* 꽉 찬 하트 */
  color: #e74c3c;
}

/* --- [핵심 추가] 즐겨찾기 위젯 스타일 --- */
.favorites-widget {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 999;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.2);
  width: 200px;
  overflow: hidden;
}
.widget-header {
  padding: 10px 15px;
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.widget-header .fa-chevron-up {
  transition: transform 0.3s;
}
.widget-header .fa-chevron-up.expanded {
  transform: rotate(180deg);
}
.widget-body {
  display: flex;
  flex-direction: column;
}
.widget-item {
  padding: 12px 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #333;
  transition: background-color 0.2s;
}
.widget-item:hover {
  background-color: #f1f1f1;
}
.widget-item:not(:last-child) {
  border-bottom: 1px solid #eee;
}
.widget-slide-enter-active, .widget-slide-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
}
.widget-slide-enter-from, .widget-slide-leave-to {
  transform: translateY(10px);
  opacity: 0;
  max-height: 0;
}
.feature-card.revenue .card-icon {
  color: #dc3545;
}
.feature-card.tokens .card-icon {
  color: #ffc107;
}

/* [핵심 추가] QR 스캐너 카드 아이콘 색상 스타일 */
.feature-card.qr-scanner .card-icon {
  color: #007bff; /* 파란색 계열 아이콘 */
}
/* [핵심 추가] 잭팟 당첨 전광판 스타일 */
.jackpot-winner-card {
  padding: 20px 25px;
  margin-bottom: 30px;
  text-align: center;
  background: linear-gradient(90deg, #f7971e, #ffd200);
  color: #333;
  font-size: 1.2em;
  font-weight: 500;
  animation: glow 2s infinite alternate;
}
.jackpot-winner-card p {
  margin: 0;
}
@keyframes glow {
  from { box-shadow: 0 0 10px #f7971e; }
  to { box-shadow: 0 0 25px #ffd200; }
}
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
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
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
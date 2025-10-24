<template>
  <div>
    <OnboardingTutorial :run="shouldRunTutorial" @complete="onTutorialComplete" />

    <AnnouncementTicker />

    <div class="dashboard-container" style="padding-top: 0; gap: 0;">
      <DailyQuestsWidget />

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
        <div class="dashboard-header">
          <h2><i class="fas fa-columns"></i> 대시보드</h2>
          <button @click="toggleEditMode" class="btn-edit" :disabled="isLoadingLayout">
             <span v-if="isLoadingLayout" class="spinner-small-light"></span>
             <template v-else>
                <i :class="['fas', isEditMode ? 'fa-check' : 'fa-pencil-alt']"></i>
                {{ isEditMode ? '편집 완료' : '순서 변경' }}
             </template>
          </button>
        </div>
         <p v-if="isEditMode" class="edit-mode-notice">
            <i class="fas fa-info-circle"></i> 카드를 드래그하여 원하는 순서로 변경한 후 '편집 완료'를 누르세요.
         </p>

        <div class="accordion-container">
          <div v-for="category in sortedCategories" :key="category.id" class="accordion-item card">
            <button class="accordion-header" @click="toggleCategory(category.id)" :disabled="isEditMode">
              <h3><i :class="category.icon"></i> {{ category.title }}</h3>
              <i :class="['fas', openCategories.includes(category.id) ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
            </button>

            <div v-show="openCategories.includes(category.id) || isEditMode" class="accordion-content">
              <draggable
                :list="getCardsForCategory(category.id)"
                item-key="id"
                class="dashboard-grid"
                :disabled="!isEditMode"
                ghost-class="sortable-ghost"
                animation="200"
                @end="onDragEnd"
              >
                <template #item="{ element: card }">
                  <router-link v-if="card.component === 'router-link'" :to="card.to" :class="['feature-card', card.class]" :style="card.style" :draggable="isEditMode">
                     <div class="card-icon"><i :class="card.icon"></i></div>
                     <h3>{{ card.title }}</h3>
                     <p>{{ card.description }}</p>
                     <div v-if="card.id === 'my-tokens'" class="token-glance">
                        <div class="token-item">
                          <img src="@/assets/COBS.png" alt="COBS" />
                          <span>{{ (userProfile?.tokens?.cobs || 0).toLocaleString() }}</span>
                        </div>
                        <div class="token-item">
                          <img src="@/assets/BND_LOGO.png" alt="BND" />
                          <span>{{ (userProfile?.tokens?.bnd || 0).toLocaleString() }}</span>
                        </div>
                        <div class="token-item">
                          <img src="@/assets/SSC_LOGO.png" alt="SSC" />
                          <span>{{ (userProfile?.tokens?.ssc || 0).toLocaleString() }}</span>
                        </div>
                     </div>
                     <span class="card-enter">{{ card.enterText || '바로가기 &rarr;' }}</span>
                  </router-link>

                  <component v-else :is="card.component" :class="['feature-card', card.class]" :style="card.style" :draggable="isEditMode">
                    </component>
                </template>
              </draggable>
            </div>
          </div>
        </div>
        </main>

      <TransactionHistoryModal
        v-if="historyModal.visible"
        :balanceType="historyModal.type"
        :currentBalance="
          historyModal.type === 'CASH'
            ? userProfile?.cashBalance || 0
            : userProfile?.saltmatePoints || 0
        "
        @close="historyModal.visible = false"
      />
      <UpgradeTierModal
        v-if="upgradeModalVisible"
        :currentTier="userProfile?.tier"
        @close="upgradeModalVisible = false"
      />
      <WithdrawalRequestModal
        v-if="isWithdrawalModalVisible"
        :userProfile="userProfile"
        @close="isWithdrawalModalVisible = false"
      />
      <CycleEarningsModal
        v-if="isCycleModalVisible"
        :currentEarnings="userProfile?.currentCycleEarnings || 0"
        :cycleCap="userProfile?.cycleCap || 0"
        @close="isCycleModalVisible = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, defineAsyncComponent, inject } from 'vue';
import draggable from 'vuedraggable';
import { auth, db, functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions'; // getFunctions 제거됨
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, orderBy, limit, doc, onSnapshot, // Timestamp 제거됨 (사용 안 할 경우)
  getDocs, getDoc,
} from 'firebase/firestore';

// --- 컴포넌트 Import (기존 + 비동기 로딩) ---
const OnboardingTutorial = defineAsyncComponent(() => import('@/components/common/OnboardingTutorial.vue'));
const AnnouncementTicker = defineAsyncComponent(() => import('@/components/AnnouncementTicker.vue'));
const DailyQuestsWidget = defineAsyncComponent(() => import('@/components/DailyQuestsWidget.vue'));
const UserInfoWidget = defineAsyncComponent(() => import('@/components/UserInfoWidget.vue')); // UserInfoWidget 카드용
const LiveGameFeed = defineAsyncComponent(() => import('@/components/LiveGameFeed.vue'));
const LeaderboardWidget = defineAsyncComponent(() => import('@/components/LeaderboardWidget.vue'));
const WeeklyLeaderboardWidget = defineAsyncComponent(() => import('@/components/WeeklyLeaderboardWidget.vue'));
const SaltPangHallOfFame = defineAsyncComponent(() => import('@/components/SaltPangHallOfFame.vue'));
const ChallengeRankingsWidget = defineAsyncComponent(() => import('@/components/ChallengeRankingsWidget.vue'));
const SaltPangRankedWidget = defineAsyncComponent(() => import('@/components/SaltPangRankedWidget.vue'));
const EnchantRankingsWidget = defineAsyncComponent(() => import('@/components/EnchantRankingsWidget.vue'));
const SaltPangPvpRankingsWidget = defineAsyncComponent(() => import('@/components/SaltPangPvpRankingsWidget.vue'));
const SaltGuardiansRankingsWidget = defineAsyncComponent(() => import('@/components/SaltGuardiansRankingsWidget.vue'));
const SaltMinePrestigeRankingsWidget = defineAsyncComponent(() => import('@/components/SaltMinePrestigeRankingsWidget.vue'));
const SaltMineClickRankingsWidget = defineAsyncComponent(() => import('@/components/SaltMineClickRankingsWidget.vue'));

// Modal 컴포넌트
import TransactionHistoryModal from '@/components/TransactionHistoryModal.vue';
import UpgradeTierModal from '@/components/UpgradeTierModal.vue';
import WithdrawalRequestModal from '@/components/WithdrawalRequestModal.vue';
import CycleEarningsModal from '@/components/CycleEarningsModal.vue';

// --- 상태 변수 (Refs) ---
const userProfile = inject('userProfile', ref(null)); // App.vue 등에서 provide 가정
const loadingUser = ref(true);
const error = ref(null);
const notices = ref([]);
const historyModal = ref({ visible: false, type: '' });
const upgradeModalVisible = ref(false);
const isWithdrawalModalVisible = ref(false);
const isCycleModalVisible = ref(false);
const marketingPlan = ref(null);
const latestJackpotWinner = ref(null);
const shouldRunTutorial = ref(false);
const isEditMode = ref(false);
const dashboardCards = ref([]); // 현재 표시 및 정렬될 카드 목록
const openCategories = ref(['main', 'assets', 'games']); // 기본으로 열어둘 카테고리
const isLoadingLayout = ref(false); // 레이아웃 저장 로딩 상태

const currentUserId = ref(null); // currentUserId 선언
let authUnsubscribe = null; // authUnsubscribe 선언

// Firestore 리스너 참조
let userUnsubscribe = null;
let jackpotUnsubscribe = null;

// Firebase Functions 호출자
const saveLayoutFunc = httpsCallable(functions, 'saveDashboardLayout'); // 레이아웃 저장 함수
const markTutorialCompleteFunc = httpsCallable(functions, 'markTutorialAsCompleted'); // 튜토리얼 완료 함수

// --- 카테고리 및 카드 설정 ---
const categories = ref([
  { id: 'mall', title: '솔트메이트 몰', icon: 'fas fa-store', order: 1 },
  { id: 'games', title: '게임 존', icon: 'fas fa-gamepad', order: 2 },
  { id: 'main', title: '주요 기능 및 현황', icon: 'fas fa-tachometer-alt', order: 3 },
  { id: 'assets', title: '나의 자산', icon: 'fas fa-wallet', order: 4 },
  { id: 'community', title: '커뮤니티 및 정보', icon: 'fas fa-comments', order: 5 },
  { id: 'events', title: '이벤트 및 참여', icon: 'fas fa-calendar-check', order: 6 },
  { id: 'network', title: '블록체인 및 네트워크', icon: 'fas fa-link', order: 7 }, // icon 예시 변경
]);

// 모든 카드 설정 정보 (ID는 고유해야 함)
const ALL_CARDS_CONFIG = [
  // --- Main Category ---
  { id: 'user-info', component: UserInfoWidget, categoryId: 'main', order: 1, title: '나의 등급 및 수익 현황' },
  { id: 'mall', component: 'router-link', to: '/mall', categoryId: 'main', icon: 'fas fa-store', title: '솔트메이트 몰', description: '솔트메이트 포인트로 특별한 상품을 구매하세요.', class: 'mall', order: 10 },
  { id: 'claim-code', component: 'router-link', to: '/claim-code', categoryId: 'main', icon: 'fas fa-ticket-alt', title: '쿠폰 / 코드 등록', description: '이벤트나 상품 구매로 받은 코드를 입력하세요.', order: 11 },

  // --- Assets Category ---
  { id: 'my-assets', component: 'router-link', to: '/my-assets', categoryId: 'assets', icon: 'fas fa-wallet', title: '나의 통합 자산', description: '포인트, 게임 재화, 토큰, 쿠폰 등 모든 자산 확인', style: 'background: linear-gradient(135deg, #667eea, #764ba2); color: white;', order: 20 },
  { id: 'my-tokens', component: 'router-link', to: '/my-tokens', categoryId: 'assets', icon: 'fas fa-coins', title: '보유 토큰 현황', description: 'COBS, BND, SSC 토큰의 수량과 가치를 확인하세요.', class: 'tokens', order: 21 },
  { id: 'nft-marketplace', component: 'router-link', to: '/nft-marketplace', categoryId: 'assets', icon: 'fas fa-gem', title: 'NFT 마켓플레이스', description: '보유한 NFT를 확인하고 멤버십 혜택을 누리세요.', class: 'nft', order: 22 },
  { id: 'my-equity', component: 'router-link', to: '/my-equity', categoryId: 'assets', icon: 'fas fa-chart-pie', title: '지분 정보', description: '나의 공장 지분 현황과 관련 정보를 확인합니다.', class: 'equity', order: 23 },
  { id: 'my-investments', component: 'router-link', to: '/my-investments', categoryId: 'assets', icon: 'fas fa-chart-line', title: '내 수익 현황', description: '기간별, 종류별 수익 내역을 상세히 확인합니다.', class: 'revenue', order: 24 },
  { id: 'staking', component: 'router-link', to: '/staking', categoryId: 'assets', icon: 'fas fa-piggy-bank', title: 'SaltMate 정기예금', description: 'SaltMate를 예치하고 이자를 받아보세요.', class: 'staking', order: 25 },

  // --- Games Category ---
  { id: 'salt-pang', component: 'router-link', to: '/salt-pang', categoryId: 'games', icon: 'fas fa-puzzle-piece', title: '솔트팡', description: '같은 모양의 소금 결정을 3개 이상 맞춰 포인트를 획득하세요!', class: 'game', order: 30 },
  { id: 'salt-pang-pvp', component: 'router-link', to: '/salt-pang-pvp', categoryId: 'games', icon: 'fas fa-fist-raised', title: '솔트팡 1 vs 1 대전', description: '다른 유저와 실시간으로 솔트팡 대결을 펼치세요!', class: 'game pvp', order: 31 },
  { id: 'salt-mine-game', component: 'router-link', to: '/salt-mine-game', categoryId: 'games', icon: 'fas fa-pickaxe', title: '소금 광산', description: '소금을 채굴하고 업그레이드하여 SaltMate 포인트를 획득하세요!', class: 'salt-mine-game', order: 32 },
  { id: 'deep-sea-game', component: 'router-link', to: '/deep-sea-game', categoryId: 'games', icon: 'fas fa-water', title: '해양심층수 탐험', description: '심층수를 채집하고 장비를 업그레이드하여 자금을 모으세요.', class: 'deep-sea-game', order: 33 },
  { id: 'salt-crystal-game', component: 'router-link', to: '/salt-crystal-game', categoryId: 'games', icon: 'fas fa-gem', title: '나만의 소금 결정 키우기', description: '매일 정성을 들여 당신만의 특별한 보석을 완성해보세요.', class: 'crystal-game', order: 34 },
  { id: 'salt-guardians', component: 'router-link', to: '/salt-guardians', categoryId: 'games', icon: 'fas fa-shield-alt', title: '솔트 가디언즈', description: '다가오는 위협으로부터 소금 결정을 지켜내세요!', class: 'game', order: 35 },
  { id: 'hidden-object', component: 'router-link', to: '/hidden-object', categoryId: 'games', icon: 'fas fa-search', title: '숨은그림찾기', description: '제한 시간 내에 숨겨진 그림을 모두 찾아보세요!', class: 'game', order: 36 },
  { id: 'maze-game', component: 'router-link', to: '/maze-game', categoryId: 'games', icon: 'fas fa-dungeon', title: '수정 동굴 탈출', description: '매일 바뀌는 미로를 탐험하고 숨겨진 보물을 찾아 탈출하세요!', class: 'game', order: 37 },
  { id: 'snake-game', component: 'router-link', to: '/snake-game', categoryId: 'games', icon: 'fas fa-worm', title: '지렁이 게임', description: '소금 결정을 먹고 꼬리가 닿기 전까지 최고 점수에 도전하세요!', class: 'game', order: 38 },
  { id: 'rps-game', component: 'router-link', to: '/rps-game', categoryId: 'games', icon: 'fas fa-hand-scissors', title: '가위바위보', description: '컴퓨터를 상대로 가위바위보에서 승리하고 SaltMate를 획득하세요!', class: 'game', order: 39 },
  { id: 'high-low-game', component: 'router-link', to: '/high-low-game', categoryId: 'games', icon: 'fas fa-sort-numeric-up-alt', title: '하이로우', description: '다음 숫자가 높을지 낮을지 예측하고 SaltMate를 획득하세요!', class: 'game', order: 40 },
  { id: 'quiz-game', component: 'router-link', to: '/quiz-game', categoryId: 'games', icon: 'fas fa-question-circle', title: '솔트 스칼라 퀴즈', description: '서바이벌 퀴즈쇼의 최후의 1인이 되어보세요!', class: 'game', order: 41 },
  { id: 'helia-game', component: 'router-link', to: '/helia-game', categoryId: 'games', icon: 'fas fa-box-open', title: '헬리아 미니게임', description: '헬리아 소금을 포장하고 SaltMate와 쿠폰을 받으세요!', class: 'helia-event', order: 42 }, // 카테고리 games로 변경, 순서 조정

  // --- Community Category ---
  { id: 'community-notices', component: 'router-link', to: '/community/notices', categoryId: 'community', icon: 'fas fa-bullhorn', title: '공지사항', description: '중요한 소식을 확인하세요.', order: 60 },
  { id: 'community-freeboard', component: 'router-link', to: '/community/freeboard', categoryId: 'community', icon: 'fas fa-comments', title: '자유게시판', description: '다른 사용자들과 소통하세요.', order: 61 },
  { id: 'live-feed', component: LiveGameFeed, categoryId: 'community', order: 62, title: '실시간 게임 피드' },

  // --- Events Category ---
  { id: 'attendance', component: 'router-link', to: '/attendance', categoryId: 'events', icon: 'fas fa-calendar-check', title: '매일매일 출석체크', description: '매일 접속하여 SaltMate와 특별한 쿠폰 보상을 받으세요!', class: 'events', order: 70 },
  { id: 'my-events', component: 'router-link', to: '/my-events', categoryId: 'events', icon: 'fas fa-calendar-alt', title: '이벤트 공간', description: '진행중인 다양한 이벤트에 참여하고 혜택을 받으세요.', class: 'events', order: 71 },
  { id: 'qr-scanner', component: 'router-link', to: '/qr-scanner', categoryId: 'events', icon: 'fas fa-qrcode', title: '센터 방문 QR 인증', description: '센터에 방문하여 QR코드를 스캔하고 보상을 획득하세요!', class: 'qr-scanner', order: 72 },
  { id: 'game-zone', component: 'router-link', to: '/game-zone', categoryId: 'events', icon: 'fas fa-dice', title: '럭키 룰렛', description: '매일 한 번, 행운의 룰렛을 돌리고 SaltMate 포인트를 획득하세요!', class: 'game', order: 73 }, // GameZonePage가 룰렛 페이지라고 가정
  { id: 'treasure-box', component: 'router-link', to: '/treasure-box', categoryId: 'events', icon: 'fas fa-box', title: '보물상자 열기', description: '매일 한 번, 행운의 상자를 열고 SaltMate 포인트를 획득하세요!', class: 'treasure', order: 74 },
  { id: 'ladder-game', component: 'router-link', to: '/ladder-game', categoryId: 'events', icon: 'fas fa-stream', title: '사다리타기', description: '운명의 사다리를 타고 행운의 SaltMate를 획득하세요!', class: 'game', order: 75 },
  { id: 'salt-pot-gacha', component: 'router-link', to: '/salt-pot-gacha', categoryId: 'events', icon: 'fas fa-wine-bottle', title: '소금 항아리', description: '매일 한 번, 항아리를 열고 대박 포인트를 노려보세요!', class: 'treasure', order: 76 },

  // --- Network & Etc Category ---
  { id: 'network-tree', component: 'router-link', to: '/network-tree', categoryId: 'network', icon: 'fas fa-sitemap', title: '나의 추천 네트워크', description: '나의 하위 추천 라인을 시각적으로 확인합니다.', order: 80 },
  { id: 'my-avatar', component: 'router-link', to: '/my-avatar', categoryId: 'network', icon: 'fas fa-user-astronaut', title: '내 아바타 꾸미기', description: '나만의 아바타를 만들어 \'솔레인 디지털 유니버스\'의 주인공!', order: 81 },
  { id: 'crafting', component: 'router-link', to: '/crafting', categoryId: 'network', icon: 'fas fa-hammer', title: '솔레인 제작 공방', description: '모은 재료로 특별한 아이템을 직접 만들어보세요!', class: 'crafting-workshop-card', order: 82 },
  { id: 'salt-trader', component: 'router-link', to: '/salt-trader', categoryId: 'network', icon: 'fas fa-exchange-alt', title: '소금 상인', description: '변동하는 시세에 맞춰 소금을 사고팔아 수익을 내보세요.', order: 83 },
  { id: 'enchanting', component: 'router-link', to: '/enchanting', categoryId: 'network', icon: 'fas fa-magic', title: '아이템 강화', description: 'SaltMate를 사용하여 아이템을 강화하고 더 강해지세요!', order: 84 },
  { id: 'auction', component: 'router-link', to: '/auction', categoryId: 'network', icon: 'fas fa-gavel', title: '주간 경매', description: '최고가에 도전하여 희귀 아이템을 획득하세요!', class: 'game', order: 85 },
  // 랭킹 위젯들 (카테고리 분류 필요 시 수정)
  { id: 'leaderboard', component: LeaderboardWidget, categoryId: 'network', order: 90, title: '전체 랭킹' },
  { id: 'weekly-leaderboard', component: WeeklyLeaderboardWidget, categoryId: 'network', order: 91, title: '주간 랭킹' },
  { id: 'saltpang-hof', component: SaltPangHallOfFame, categoryId: 'network', order: 92, title: '솔트팡 명예의 전당' },
  { id: 'challenge-rankings', component: ChallengeRankingsWidget, categoryId: 'network', order: 93, title: '챌린지 랭킹' },
  { id: 'saltpang-ranked', component: SaltPangRankedWidget, categoryId: 'network', order: 94, title: '솔트팡 랭크' },
  { id: 'saltmine-prestige-rankings', component: SaltMinePrestigeRankingsWidget, categoryId: 'network', order: 95, title: '광산 환생 랭킹' },
  { id: 'saltmine-click-rankings', component: SaltMineClickRankingsWidget, categoryId: 'network', order: 96, title: '광산 클릭 랭킹' },
  { id: 'saltpang-pvp-rankings', component: SaltPangPvpRankingsWidget, categoryId: 'network', order: 97, title: '솔트팡 PvP 랭킹' },
  { id: 'enchant-rankings', component: EnchantRankingsWidget, categoryId: 'network', order: 98, title: '강화 랭킹' },
  { id: 'saltguardians-rankings', component: SaltGuardiansRankingsWidget, categoryId: 'network', order: 99, title: '솔트 가디언즈 랭킹' },
];

// 카테고리 순서대로 정렬
const sortedCategories = computed(() => {
    return [...categories.value].sort((a, b) => a.order - b.order);
});

// 특정 카테고리에 속하는 카드 목록 반환 (현재 dashboardCards 순서 기준)
const getCardsForCategory = (categoryId) => {
    return dashboardCards.value.filter(card => card.categoryId === categoryId);
};

// --- 함수 정의 ---
const listenToLatestJackpot = () => {
  const q = query(collection(db, "saltPangJackpotWins"), orderBy("wonAt", "desc"), limit(1));
  jackpotUnsubscribe = onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      latestJackpotWinner.value = snapshot.docs[0].data();
    } else {
      latestJackpotWinner.value = null; // 당첨 기록 없을 경우 초기화
    }
  });
};

const initializeLayout = (profile) => {
  const savedLayoutOrder = profile?.dashboardLayout;
  let sortedCards = [];

  if (savedLayoutOrder && Array.isArray(savedLayoutOrder) && savedLayoutOrder.length > 0) {
    sortedCards = savedLayoutOrder.map(cardId => {
      const config = ALL_CARDS_CONFIG.find(c => c.id === cardId);
      // 설정에서 카드가 삭제되었을 수 있으므로 확인
      return config ? { ...config, component: resolveComponent(config.component) } : null;
    }).filter(Boolean);

    const currentCardIds = new Set(sortedCards.map(c => c.id));
    ALL_CARDS_CONFIG.forEach(config => {
      if (!currentCardIds.has(config.id)) {
        sortedCards.push({ ...config, component: resolveComponent(config.component) }); // 새 카드 추가
      }
    });
  } else {
    // 기본 순서: 카테고리 순서 -> 카드 order 순서
    sortedCards = [...ALL_CARDS_CONFIG].sort((a, b) => {
        const catAOrder = categories.value.find(c => c.id === a.categoryId)?.order || 99;
        const catBOrder = categories.value.find(c => c.id === b.categoryId)?.order || 99;
        if (catAOrder !== catBOrder) return catAOrder - catBOrder;
        return a.order - b.order;
    }).map(config => ({ ...config, component: resolveComponent(config.component) }));
  }
  dashboardCards.value = sortedCards;
};

// 컴포넌트 이름 문자열을 실제 컴포넌트 객체로 변환하는 헬퍼
const resolveComponent = (componentName) => {
    if (typeof componentName === 'string') {
        if (componentName === 'router-link') return 'router-link';
        // 비동기 컴포넌트 이름과 매핑 (defineAsyncComponent 변수 이름)
        switch (componentName) {
            case 'UserInfoWidget': return UserInfoWidget;
            case 'LiveGameFeed': return LiveGameFeed;
            case 'LeaderboardWidget': return LeaderboardWidget;
            case 'WeeklyLeaderboardWidget': return WeeklyLeaderboardWidget;
            case 'SaltPangHallOfFame': return SaltPangHallOfFame;
            case 'ChallengeRankingsWidget': return ChallengeRankingsWidget;
            case 'SaltPangRankedWidget': return SaltPangRankedWidget;
            case 'EnchantRankingsWidget': return EnchantRankingsWidget;
            case 'SaltPangPvpRankingsWidget': return SaltPangPvpRankingsWidget;
            case 'SaltGuardiansRankingsWidget': return SaltGuardiansRankingsWidget;
            case 'SaltMinePrestigeRankingsWidget': return SaltMinePrestigeRankingsWidget;
            case 'SaltMineClickRankingsWidget': return SaltMineClickRankingsWidget;
            // 다른 위젯 컴포넌트 추가...
            default: return 'div'; // 찾지 못하면 기본 div
        }
    }
    return componentName; // 이미 컴포넌트 객체인 경우
};


// 드래그 종료 시 호출 (vuedraggable이 배열 순서를 자동으로 업데이트함)
const onDragEnd = () => {
    // console.log('Drag ended:', dashboardCards.value.map(c => c.id));
    // 변경된 순서는 dashboardCards.value에 반영되어 있음
};

// 편집 모드 토글 및 레이아웃 저장
const toggleEditMode = async () => {
  if (isEditMode.value) {
    // 편집 완료
    const currentLayoutIds = dashboardCards.value.map(c => c.id);
    const initialLayoutIds = (userProfile.value?.dashboardLayout || []).length > 0
        ? userProfile.value.dashboardLayout
        : ALL_CARDS_CONFIG.sort((a, b) => (categories.value.find(c=>c.id === a.categoryId)?.order || 99) - (categories.value.find(c=>c.id === b.categoryId)?.order || 99) || a.order - b.order).map(c => c.id);

    // 순서가 변경되었는지 확인
    if (JSON.stringify(currentLayoutIds) !== JSON.stringify(initialLayoutIds)) {
      isLoadingLayout.value = true;
      try {
        await saveLayoutFunc({ layout: currentLayoutIds });
        // Firestore 업데이트 성공 시 userProfile 스냅샷 리스너가 새 레이아웃으로 initializeLayout 재호출
        alert('대시보드 순서가 저장되었습니다.');
      } catch (error) {
        console.error("레이아웃 저장 실패:", error);
        alert('저장에 실패했습니다. 페이지를 새로고침합니다.');
        // 실패 시 강제로 페이지 새로고침하여 이전 상태 복원
        window.location.reload();
      } finally {
         isLoadingLayout.value = false;
      }
    }
     // 편집 모드 종료 시 모든 카테고리 열기 (선택적)
     // openCategories.value = categories.value.map(c => c.id);
  } else {
      // 편집 모드 시작 시 모든 카테고리 열기
      openCategories.value = categories.value.map(c => c.id);
  }
  isEditMode.value = !isEditMode.value;
};

// 카테고리 아코디언 토글
const toggleCategory = (categoryId) => {
  if (isEditMode.value) return; // 편집 중에는 토글 방지
  const index = openCategories.value.indexOf(categoryId);
  if (index > -1) {
    openCategories.value.splice(index, 1);
  } else {
    openCategories.value.push(categoryId);
  }
};


const fetchMarketingPlan = async () => {
  const planRef = doc(db, "configuration", "marketingPlan");
  try {
    const docSnap = await getDoc(planRef);
    if (docSnap.exists()) {
      marketingPlan.value = docSnap.data();
    }
  } catch(e) {
      console.error("마케팅 플랜 로딩 오류:", e);
  }
};

const fetchNotices = async () => {
  try {
    const q = query(collection(db, "posts"), where("category", "==", "notices"), orderBy("createdAt", "desc"), limit(3));
    const querySnapshot = await getDocs(q);
    notices.value = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("공지사항 로딩 오류:", e);
  }
};

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return ""; // Firestore Timestamp 객체인지 확인
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

// 튜토리얼 완료 처리
const onTutorialComplete = async () => {
  shouldRunTutorial.value = false;
  if (!auth.currentUser) return;
  try {
    // Cloud Function 호출하여 Firestore 업데이트
    await markTutorialCompleteFunc();
    // 로컬 상태 즉시 업데이트 (선택적)
    if(userProfile.value) userProfile.value.hasCompletedTutorial = true;
  } catch (e) {
    console.error("튜토리얼 완료 처리 실패:", e);
    // 사용자에게 알림 필요 시 추가
  }
};

// --- Lifecycle Hooks ---
onMounted(() => {
  authUnsubscribe = onAuthStateChanged(auth, (user) => { // 할당
    if (user) {
      currentUserId.value = user.uid; // .value 사용
      // 사용자 프로필 실시간 감지 시작
      const userRef = doc(db, "users", user.uid);
      userUnsubscribe = onSnapshot(userRef, (docSnap) => {
        loadingUser.value = true; // 스냅샷 받을 때마다 로딩 상태 잠시 활성화
        if (docSnap.exists()) {
          const newProfile = { id: docSnap.id, ...docSnap.data() };
          // 레이아웃 변경 감지 또는 첫 로드 시에만 initializeLayout 호출
          if (!userProfile.value || JSON.stringify(userProfile.value.dashboardLayout) !== JSON.stringify(newProfile.dashboardLayout)) {
             initializeLayout(newProfile);
          }
          userProfile.value = newProfile; // 프로필 상태 업데이트
          // 튜토리얼 실행 여부 결정
          shouldRunTutorial.value = !newProfile.hasCompletedTutorial;
          error.value = null;
        } else {
          error.value = "사용자 프로필을 찾을 수 없습니다.";
          userProfile.value = null;
          initializeLayout(null); // 프로필 없으면 기본 레이아웃
        }
        loadingUser.value = false; // 로딩 완료
      }, (err) => {
        console.error("프로필 실시간 수신 실패:", err);
        error.value = "프로필 로딩 중 오류가 발생했습니다.";
        loadingUser.value = false;
        userProfile.value = null;
        initializeLayout(null);
      });

      // 기타 데이터 로드
      fetchMarketingPlan();
      fetchNotices();
      listenToLatestJackpot();
   } else {
      currentUserId.value = null; // .value 사용
      loadingUser.value = false;
      userProfile.value = null;
      if (userUnsubscribe) userUnsubscribe(); // 리스너 정리
      if (jackpotUnsubscribe) jackpotUnsubscribe();
      initializeLayout(null); // 비로그인 시 기본 레이아웃
    }
  });

  // 컴포넌트 언마운트 시 auth 리스너도 정리 (선택적, 앱 전체 생명주기와 연관)
  // onUnmounted(authUnsubscribe);
});

onUnmounted(() => {
  if (userUnsubscribe) userUnsubscribe();
  if (jackpotUnsubscribe) jackpotUnsubscribe();
  if (authUnsubscribe) authUnsubscribe(); // auth 구독 해제 추가
});

// setup 함수 마지막: template에서 사용할 모든 변수와 함수 반환 (Composition API에서는 필요 없음)
</script>

<style scoped>
/* 기존 스타일 + 아래 추가 */

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 5px; /* 헤더 좌우 여백 */
}
.dashboard-header h2 {
  margin: 0;
  font-size: 1.6em;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 10px;
}
.btn-edit {
  background: none;
  border: 1px solid #3498db;
  color: #3498db;
  padding: 6px 12px;
  border-radius: 20px; /* 둥근 버튼 */
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn-edit:hover:not(:disabled) {
  background-color: #eaf2f8;
}
.btn-edit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
.spinner-small-light {
    border: 2px solid rgba(52, 152, 219, 0.3); /* 연한 파랑 */
    border-top: 2px solid #3498db; /* 진한 파랑 */
    border-radius: 50%;
    width: 14px;
    height: 14px;
    animation: spin 1s linear infinite;
    display: inline-block;
}


.edit-mode-notice {
    background-color: #eaf2f8;
    color: #2980b9;
    padding: 10px 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    font-size: 0.9em;
    border: 1px solid #aed6f1;
}
.edit-mode-notice i {
    margin-right: 8px;
}


.accordion-container { display: flex; flex-direction: column; gap: 15px; }
.accordion-item { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.05);}
.accordion-header {
  display: flex; justify-content: space-between; align-items: center; width: 100%;
  background-color: #f9f9f9; border: none; padding: 15px 20px; cursor: pointer; text-align: left;
  border-bottom: 1px solid #eee; transition: background-color 0.2s;
}
.accordion-header:hover { background-color: #f1f1f1; }
.accordion-header:disabled { cursor: not-allowed; opacity: 0.7; }
.accordion-header h3 { margin: 0; font-size: 1.2em; display: flex; align-items: center; gap: 10px; color: #34495e; font-weight: 600; }
.accordion-header h3 i { color: #3498db; width: 20px; text-align: center;} /* 아이콘 정렬 */
.accordion-header i.fa-chevron-up, .accordion-header i.fa-chevron-down { color: #7f8c8d; transition: transform 0.3s ease; }
/* 아코디언 열렸을 때 아이콘 회전 (선택적) */
/* .accordion-header[aria-expanded="true"] i.fa-chevron-down { transform: rotate(180deg); } */

.accordion-content { padding: 15px; animation: fadeIn 0.3s ease-out; }

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* dashboard-grid 스타일 조정 (아코디언 내부에 적용) */
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr; /* 모바일 기본 1열 */
  gap: 15px;
  margin-top: 0; /* 아코디언 패딩으로 간격 조절 */
}

/* Feature Card 기본 스타일 (기존 스타일 유지 및 통합) */
.feature-card {
  display: flex; flex-direction: column; text-decoration: none; color: inherit;
  padding: 20px; border-radius: 10px; background-color: #ffffff;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.07);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-height: 150px; /* 카드 최소 높이 */
  border: 1px solid transparent; /* 편집 모드 테두리 공간 확보 */
}
.feature-card:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1); }
.card-icon { font-size: 2em; margin-bottom: 10px; color: #3498db; width: 40px; text-align: center; }
.feature-card h3 { font-size: 1.2em; margin: 0 0 8px; color: #2c3e50; }
.feature-card p { font-size: 0.9em; color: #7f8c8d; line-height: 1.5; flex-grow: 1; margin-bottom: 10px; }
.card-enter { font-weight: 600; color: #3498db; align-self: flex-end; font-size: 0.9em; }
.feature-card:hover .card-enter { color: #2980b9; }

/* 특정 카드 아이콘 색상 (기존 스타일 유지) */
.feature-card.mall .card-icon { color: #9b59b6; }
.feature-card.game .card-icon { color: #e74c3c; }
.feature-card.assets .card-icon, .feature-card.staking .card-icon { color: #f1c40f; } /* Staking 추가 */
.feature-card.events .card-icon, .feature-card.helia-event .card-icon { color: #2ecc71; } /* Helia 추가 */
.feature-card.equity .card-icon { color: #fd7e14; }
.feature-card.nft .card-icon { color: #17a2b8; }
.feature-card.revenue .card-icon { color: #dc3545; }
.feature-card.tokens .card-icon { color: #ffc107; }
.feature-card.qr-scanner .card-icon { color: #007bff; }
.feature-card.treasure .card-icon { color: #e67e22; }
.feature-card.salt-game .card-icon { color: #3498db; }
.feature-card.salt-mine-game .card-icon { color: #f39c12; } /* 색상 변경 */
.feature-card.deep-sea-game .card-icon { color: #1abc9c; } /* 색상 변경 */
.feature-card.crafting-workshop-card .card-icon { color: #f1c40f; } /* 제작 공방 */

/* 편집 모드 스타일 */
.feature-card[draggable="true"] {
  cursor: grab !important;
  border: 2px dashed #3498db;
  opacity: 0.8;
  user-select: none; /* 드래그 중 텍스트 선택 방지 */
}
.sortable-ghost {
  opacity: 0.4;
  background: #d6eaf8;
  border: 1px dashed #3498db;
  border-radius: 10px;
}

/* PC 화면 스타일 */
@media (min-width: 768px) {
  .dashboard-container { padding: 20px; }
  .dashboard-header h2 { font-size: 1.8em; }
  .accordion-header h3 { font-size: 1.4em; }
  .dashboard-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); /* PC 그리드 설정 */
    gap: 20px;
  }
  .feature-card { padding: 25px; min-height: 180px; }
  .card-icon { font-size: 2.2em; width: 45px; }
  .feature-card h3 { font-size: 1.3em; }
  .feature-card p { font-size: 0.95em; }
  .card-enter { font-size: 1em; }

  /* UserInfoWidget 컴포넌트 내부 스타일 조정 필요 시 여기에 추가 */
  /* 예: .performance-card { grid-column: 1 / -1; } /* UserInfoWidget을 항상 맨 위에 전체 너비로 */
}

/* UserInfoWidget 스타일 상속 또는 재정의 */
/* UserInfoWidget 컴포넌트 자체에는 이 스타일이 없으므로, 여기서 정의하거나 해당 컴포넌트로 옮겨야 함 */
.user-info-widget {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: #fff;
  padding: 25px;
  border-radius: 15px; /* 아코디언 card와 통일 */
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08); /* 아코디언 card와 통일 */
  margin-bottom: 15px; /* 아코디언과의 간격 */
}
/* UserInfoWidget 내부 요소 스타일 (기존 스타일에서 복사) */
.user-info-widget .card-header { border-bottom: 1px solid hsla(0, 0%, 100%, 0.3); padding-bottom: 15px; margin-bottom: 20px; }
.user-info-widget .card-header h3 { font-size: 1.5em; margin: 0; display: flex; align-items: center; gap: 10px; }
.user-info-widget .tier-badge { /* ... 기존 tier-badge 스타일 ... */ }
.user-info-widget .investment-info { text-align: center; margin-bottom: 20px; padding: 10px; background: hsla(0, 0%, 100%, 0.1); border-radius: 8px; }
.user-info-widget .investment-info span { opacity: 0.9; margin-right: 10px; font-size: 1.1em; }
.user-info-widget .investment-info strong { font-size: 1.3em; font-weight: 700; }
.user-info-widget .performance-body h4 { font-size: 1.1em; margin-bottom: 10px; font-weight: 500; }
.user-info-widget .progress-bar-container { width: 100%; background-color: rgba(0, 0, 0, 0.2); border-radius: 20px; height: 24px; overflow: hidden; position: relative; }
.user-info-widget .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #17a2b8, #28a745); border-radius: 20px; transition: width 0.8s cubic-bezier(0.25, 1, 0.5, 1); position: relative; display: flex; align-items: center; justify-content: flex-end; }
.user-info-widget .running-man { color: white; font-size: 1.2em; margin-right: 10px; animation: running-animation 0.7s infinite alternate; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }
.user-info-widget .progress-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.9em; opacity: 0.9; }
.user-info-widget .balances { margin-top: 25px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: center; }
.user-info-widget .balance-item { background: rgba(0, 0, 0, 0.15); padding: 20px; border-radius: 10px; cursor: pointer; transition: background-color 0.3s; }
.user-info-widget .balance-item:hover { background: rgba(0, 0, 0, 0.25); }
.user-info-widget .balance-item.cash label { display: block; font-size: 1em; margin-bottom: 8px; opacity: 0.8; display: flex; justify-content: center; align-items: center; gap: 8px; }
.user-info-widget .balance-item.cash span { font-size: 2em; font-weight: 700; line-height: 1; }
.user-info-widget .balance-item.cash small { font-size: 1em; margin-left: 5px; }
.user-info-widget .balance-item.saltmate { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4); position: relative; overflow: hidden; display: flex; justify-content: center; align-items: center; padding: 30px 20px; transition: all 0.3s ease; }
.user-info-widget .balance-item.saltmate:hover { transform: translateY(-5px) scale(1.05); box-shadow: 0 15px 30px rgba(118, 75, 162, 0.5); }
.user-info-widget .balance-content { text-align: center; z-index: 1; }
.user-info-widget .balance-label { display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 1.1em; font-weight: 500; opacity: 0.9; margin-bottom: 15px; }
.user-info-widget .balance-value { font-size: 2.8em; font-weight: 700; line-height: 1.1; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); }
.user-info-widget .balance-unit { font-size: 1.2em; font-weight: 500; opacity: 0.9; letter-spacing: 1px; margin-top: 5px; }
.user-info-widget .shimmer-effect { position: absolute; top: 0; left: -150%; width: 75%; height: 100%; background: linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0) 100%); transform: skewX(-25deg); animation: shimmer 5s infinite; }
.user-info-widget .withdrawal-action { margin-top: 15px; padding-top: 15px; border-top: 1px solid hsla(0, 0%, 100%, 0.2); }
.user-info-widget .withdrawal-button { width: 100%; background-color: #28a745; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s ease; }
.user-info-widget .withdrawal-button:disabled { background-color: #5a6268; cursor: not-allowed; opacity: 0.7; }
.user-info-widget .withdrawal-notice { display: block; margin-top: 8px; font-size: 0.8em; opacity: 0.9; text-align: center; }
.user-info-widget .subscription-status-card { margin-top: 25px; padding: 20px; border-radius: 10px; border: 1px solid hsla(0, 0%, 100%, 0.3); background: hsla(0, 0%, 100%, 0.1); transition: all 0.3s ease; }
.user-info-widget .subscription-status-card.status-overdue { background: hsla(0, 80%, 60%, 0.2); border-color: hsla(0, 80%, 70%, 0.5); }
.user-info-widget .status-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.user-info-widget .status-header h4 { margin: 0; font-size: 1.1em; }
.user-info-widget .subscription-status-card p { margin: 0 0 15px 0; font-size: 1.05em; }
.user-info-widget .warning-text { font-size: 0.9em !important; opacity: 0.9; }
.user-info-widget .btn-pay { width: 100%; padding: 10px; border: none; border-radius: 8px; background-color: #17a2b8; color: white; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
.user-info-widget .btn-pay.urgent { background-color: #dc3545; }
.user-info-widget .btn-pay:disabled { background-color: #5a6268; cursor: not-allowed; }
.user-info-widget .upgrade-action { margin-top: 20px; text-align: center; }
.user-info-widget .upgrade-button { background-color: #ffc107; color: #212529; border: none; padding: 12px 25px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: all 0.3s ease; }
.user-info-widget .upgrade-button:disabled { background-color: #e9ecef; color: #6c757d; cursor: not-allowed; }
.user-info-widget .upgrade-button:hover:not(:disabled) { background-color: #e0a800; transform: translateY(-2px); }

/* 모바일 화면에서 UserInfoWidget의 Balance Grid 조정 */
@media (max-width: 767px) {
  .user-info-widget .balances {
    grid-template-columns: 1fr; /* 1열로 변경 */
  }
}

/* 기존 스타일 유지 */
/* ... (이하 기존 DashboardPage.vue의 모든 스타일 복사) ... */
.feature-card.crafting-workshop-card { /* 제작 공방 카드 스타일 */
  position: relative; overflow: hidden; background: linear-gradient(45deg, #2c3e50, #34495e);
  border: 1px solid #f1c40f; box-shadow: 0 0 15px rgba(241, 196, 15, 0.5);
  animation: glowing-border 2s infinite alternate;
}
.crafting-workshop-card .card-icon { color: #f1c40f; text-shadow: 0 0 8px rgba(241, 196, 15, 0.8); }
.crafting-workshop-card h3, .crafting-workshop-card p, .crafting-workshop-card .card-enter { color: #fdfde0; text-shadow: 0 0 5px rgba(241, 196, 15, 0.4); }
.crafting-workshop-card::before {
  content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
  background: conic-gradient(transparent, rgba(241, 196, 15, 0.4), transparent 30%, transparent 70%, rgba(241, 196, 15, 0.4), transparent);
  transform: rotate(0deg); animation: rotate-shine 4s linear infinite; opacity: 0; transition: opacity 0.5s ease; z-index: 0;
}
.crafting-workshop-card:hover::before { opacity: 1; }
.crafting-workshop-card > * { position: relative; z-index: 1; }
@keyframes glowing-border { 0%, 100% { border-color: #f1c40f; box-shadow: 0 0 15px rgba(241, 196, 15, 0.5); } 50% { border-color: #ffd700; box-shadow: 0 0 25px rgba(255, 215, 0, 0.8), 0 0 35px rgba(255, 215, 0, 0.6); } }
@keyframes rotate-shine { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes running-animation { from { transform: translateY(0px); } to { transform: translateY(-3px); } } /* UserInfoWidget 용 */
@keyframes shimmer { 100% { left: 150%; } } /* UserInfoWidget 용 */
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } /* 스피너 공용 */

</style>
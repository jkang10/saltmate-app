import { createRouter, createWebHistory } from "vue-router";
import { auth } from "@/firebaseConfig";

const routes = [
  {
    path: "/",
    name: "Home",
    redirect: "/dashboard",
  },
  {
    path: "/signup",
    name: "SignupPage",
    component: () => import("@/views/SignupPage.vue"),
  },
  {
    path: "/login",
    name: "LoginPage",
    component: () => import("@/views/LoginPage.vue"),
  },
  {
    path: "/reset-password",
    name: "ResetPasswordPage",
    component: () => import("@/views/ResetPasswordPage.vue"),
  },
  {
    path: "/dashboard",
    name: "DashboardPage",
    component: () => import("@/views/DashboardPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: '/help',
    name: 'HelpPage',
    component: () => import('@/views/HelpPage.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: "/shop",
    name: "ShopPage",
    component: () => import("@/views/ShopPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/mall",
    name: "MallPage",
    component: () => import("@/views/MallPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/my-investments",
    name: "MyInvestmentsPage",
    component: () => import("@/views/MyInvestmentsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/community",
    name: "CommunityPage",
    component: () => import("@/views/CommunityPage.vue"),
    meta: { requiresAuth: true },
    redirect: '/community/notices', 
    children: [
      {
        path: ':category',
        name: 'BoardPage',
        component: () => import('@/views/community/BoardPage.vue'),
        props: true
      }
    ]
  },
  {
    path: "/community/post/:postId",
    name: "PostDetailPage",
    component: () => import("@/views/community/PostDetailPage.vue"),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: "/community/write",
    name: "PostWritePage",
    component: () => import("@/views/community/PostWritePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/network-tree",
    name: "NetworkTreePage",
    component: () => import("@/views/NetworkTreePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/nft-marketplace",
    name: "NftMarketplacePage",
    component: () => import("@/views/NFTMarketplacePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/profile",
    name: "UserProfilePage",
    component: () => import("@/views/UserProfilePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/my-tokens",
    name: "MyTokensPage",
    component: () => import("@/views/MyTokensPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/my-equity",
    name: "MyEquityPage",
    component: () => import("@/views/MyEquityPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/my-orders",
    name: "MyOrdersPage",
    component: () => import("@/views/MyOrdersPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/my-events",
    name: "MyEventsPage",
    component: () => import("@/views/MyEventsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: '/qr-scanner',
    name: 'QRCodeScanner',
    component: () => import('@/views/QRCodeScannerPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/crafting',
    name: 'CraftingPage',
    component: () => import("@/views/CraftingPage.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/about",
    name: "AboutView",
    component: () => import("@/views/AboutView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: '/quiz-game',
    name: 'QuizGamePage',
    component: () => import("@/views/QuizGamePage.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/my-assets",
    name: "MyAssets",
    component: () => import("@/views/MyAssetsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: '/crafting',
    name: 'CraftingPage',
    component: () => import("@/views/CraftingPage.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: '/claim-code',
    name: 'ClaimCodePage',
    component: () => import('@/views/ClaimCodePage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: "/game-zone",
    name: "GameZonePage",
    component: () => import("@/views/GameZonePage.vue"),
    meta: { requiresAuth: true },
  },
{
  path: '/hidden-object',
  name: 'HiddenObjectPage',
  component: () => import('@/views/HiddenObjectPage.vue'),
  meta: { requiresAuth: true }
},
  {
    path: '/salt-pang',
    name: 'SaltPangPage',
    component: () => import('@/views/SaltPangPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/salt-crystal-game',
    name: 'SaltCrystalPage',
    component: () => import('@/views/SaltCrystalPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: "/maze-game",
    name: "MazeGamePage",
    component: () => import("@/views/MazeGamePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: '/crystal-hall',
    name: 'CrystalHallPage',
    component: () => import('@/views/CrystalHallPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/salt-pang-pvp',
    name: 'SaltPangPvPPage',
    component: () => import("@/views/SaltPangPvPPage.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/ladder-game",
    name: "LadderGame",
    component: () => import("@/views/LadderGamePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/salt-pot-gacha",
    name: "SaltPotGacha",
    component: () => import("@/views/SaltPotGachaPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/treasure-box",
    name: "TreasureBoxPage",
    component: () => import("@/views/TreasureBoxPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/high-low-game",
    name: "HighLowPage",
    component: () => import("@/views/HighLowPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/attendance",
    name: "AttendancePage",
    component: () => import("@/views/AttendancePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/rps-game",
    name: "RPSPage",
    component: () => import("@/views/RPSPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/salt-game",
    name: "SaltCrystalGamePage",
    component: () => import("@/views/SaltCrystalGamePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: '/salt-guardians',
    name: 'SaltGuardiansPage',
    component: () => import('@/views/SaltGuardiansPage.vue'),
    meta: { requiresAuth: true }
  },
{
  path: "/salt-arena",
  name: "SaltArenaPage",
  component: () => import("@/views/SaltArenaPage.vue"),
  meta: { requiresAuth: true },
},
  {
    path: "/salt-mine-game",
    name: "SaltMineGamePage",
    component: () => import("@/views/SaltMineGamePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/deep-sea-game",
    name: "DeepSeaGamePage",
    component: () => import("@/views/DeepSeaGamePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: '/auction',
    name: 'AuctionPage',
    component: () => import('@/views/AuctionPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/salt-trader',
    name: 'SaltTraderPage',
    component: () => import('@/views/SaltTraderPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/enchanting',
    name: 'EnchantPage',
    component: () => import('@/views/EnchantPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: "/admin-dashboard",
    name: "AdminDashboardPage",
    component: () => import("@/views/AdminDashboardPage.vue"),
    // [핵심 수정] meta 규칙을 'superAdmin' 역할만 접근 가능하도록 변경
    meta: { requiresAuth: true, requiresRole: 'superAdmin' },
    children: [
      {
        path: "",
        redirect: { name: "AdminUserManagement" },
      },
      {
        path: "users",
        name: "AdminUserManagement",
        component: () => import("@/components/admin/UserManagement.vue"),
      },
      {
        path: "centers",
        name: "AdminCenterManagement",
        component: () => import("@/components/admin/CenterManagement.vue"),
      },
      {
        path: "game-conversion-settings",
        name: "GameConversionSettings",
        component: () => import("@/components/admin/GameConversionSettings.vue"),
      },
      {
        path: "payments",
        name: "PaymentManagement",
        component: () => import("@/components/admin/PaymentManagement.vue"),
      },
      {
        path: "subscriptions",
        name: "AdminSubscriptionManagement",
        component: () =>
          import("@/components/admin/SubscriptionManagement.vue"),
      },
      {
        path: "weekly-payouts",
        name: "AdminWeeklyPayoutManagement",
        component: () => import("@/components/admin/WeeklyPayoutManager.vue"),
      },
      {
        path: "marketing-plan",
        name: "AdminMarketingPlanManagement",
        component: () =>
          import("@/components/admin/MarketingPlanManagement.vue"),
      },
      {
        path: "investments",
        name: "AdminInvestmentManagement",
        component: () => import("@/components/admin/InvestmentManagement.vue"),
      },
      {
        path: "notices-community",
        name: "AdminNoticesCommunity",
        component: () =>
          import("@/components/admin/NoticesCommunityManagement.vue"),
      },
      {
        path: "events",
        name: "AdminEventManagement",
        component: () => import("@/components/admin/EventManagement.vue"),
      },
      {
        path: "attendance",
        name: "AdminAttendance",
        component: () => import("@/components/admin/AttendanceManagement.vue"),
      },
      {
        path: "products",
        name: "AdminProductManagement",
        component: () => import("@/components/admin/ProductManagement.vue"),
      },
      {
        path: "orders-delivery",
        name: "AdminOrderDeliveryManagement",
        component: () =>
          import("@/components/admin/OrderDeliveryManagement.vue"),
      },
      {
        path: "withdrawals",
        name: "AdminWithdrawalManagement",
        component: () => import("@/components/admin/WithdrawalManagement.vue"),
      },
      {
        path: "tokens",
        name: "AdminTokenManagement",
        component: () => import("@/components/admin/TokenManagement.vue"),
      },
      {
        path: "nfts",
        name: "AdminNFTManagement",
        component: () => import("@/components/admin/NFTManagement.vue"),
      },
      {
        path: "nft-types",
        name: "AdminNftTypeManagement",
        component: () => import("@/components/admin/NftTypeManagement.vue"),
      },
	{
	  path: 'auction', // -> 최종 주소: /admin-dashboard/auction
	  name: 'AuctionManagement',
	  component: () => import('@/components/admin/AuctionManagementPage.vue'),
	},
      {
        path: "equity",
        name: "AdminEquityManagement",
        component: () => import("@/components/admin/EquityManagement.vue"),
      },
      {
        path: "database-backup",
        name: "DatabaseBackup",
        component: () => import("@/components/admin/DatabaseBackup.vue"),
      },
      {
        path: 'rewards',
        name: 'AdminRewards',
	    component: () => import('@/components/admin/AdminRewardsPage.vue')
      },
      {
        path: '/admin/announcements',
        name: 'AnnouncementManagement',
        component: () => import('@/components/admin/AnnouncementManagement.vue'),
        // [핵심 수정] 부모 라우트의 meta 규칙을 상속받으므로, 여기는 별도 수정 필요 없음
      },
    ],
  },
  {
    path: "/:catchAll(.*)",
    name: "NotFound",
    component: () => import("@/views/NotFoundPage.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// [핵심 수정] 내비게이션 가드 로직을 역할 기반으로 전체 변경
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiredRole = to.meta.requiresRole;
  
  // onAuthStateChanged를 기다리는 대신, 초기 로딩 시 currentUser를 직접 확인
  const currentUser = await new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    });
  });

  if (requiresAuth) {
    if (currentUser) {
      if (requiredRole) {
        try {
          const idTokenResult = await currentUser.getIdTokenResult(true); // 새 토큰 강제 갱신
          
          if (idTokenResult.claims.role === requiredRole) {
            next();
          } else {
            alert("이 페이지에 접근할 권한이 없습니다.");
            next('/dashboard');
          }
        } catch (error) {
          console.error("권한 확인 중 오류:", error);
          next('/login');
        }
      } else {
        next();
      }
    } else {
      next({
        path: "/login",
        query: { redirectReason: "로그인이 필요한 서비스입니다." },
      });
    }
  } else {
    next();
  }
});

export default router;
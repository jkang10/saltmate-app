import { createRouter, createWebHistory } from "vue-router";
import { auth } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

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
    // [수정] 아래 redirect 속성을 추가합니다.
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
    path: "/community/:category",
    name: "Board",
    component: () => import("@/views/community/Board.vue"),
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: "/community/write",
    name: "PostWrite",
    component: () => import("@/views/community/PostWritePage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/community/post/:postId",
    name: "PostDetail",
    component: () => import("@/views/community/PostDetailPage.vue"),
    props: true,
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
    path: "/about",
    name: "AboutView",
    component: () => import("@/views/AboutView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/game-zone",
    name: "GameZonePage",
    component: () => import("@/views/GameZonePage.vue"),
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
    path: "/admin-dashboard",
    name: "AdminDashboardPage",
    component: () => import("@/views/AdminDashboardPage.vue"),
    meta: { requiresAuth: true, isAdmin: true },
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
        component: () =>
          import("@/components/admin/GameConversionSettings.vue"),
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
      // ▼▼▼ [신규 추가] NFT 종류 관리 페이지 라우트 ▼▼▼
      {
        path: "nft-types",
        name: "AdminNftTypeManagement",
        component: () => import("@/components/admin/NftTypeManagement.vue"),
      },
      // ▲▲▲ 추가 완료 ▲▲▲
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

const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject,
    );
  });
};

router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const requiresAdmin = to.matched.some((record) => record.meta.isAdmin);

  const currentUser = await getCurrentUser();

  if (requiresAuth && !currentUser) {
    // [수정] alert 대신 쿼리 파라미터로 메시지를 전달합니다.
    next({
      path: "/login",
      query: { redirectReason: "로그인이 필요한 서비스입니다." },
    });
  } else if (currentUser) {
    const idTokenResult = await currentUser.getIdTokenResult(true);
    const isAdmin = idTokenResult.claims.admin === true;

    if (to.name === "LoginPage" || to.name === "SignupPage") {
      if (isAdmin) {
        next("/admin-dashboard");
      } else {
        next("/dashboard");
      }
    } else if (requiresAdmin && !isAdmin) {
      // [수정] alert 대신 쿼리 파라미터로 메시지를 전달합니다.
      next({
        path: "/dashboard",
        query: {
          errorReason: "관리자만 접근 가능한 페이지입니다.",
        },
      });
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;

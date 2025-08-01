import { createRouter, createWebHistory } from "vue-router";
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const routes = [
  // ▼▼▼ [수정] 실제로 존재하는 페이지만 남기고, 존재하지 않는 경로는 삭제 ▼▼▼
  {
    path: "/",
    name: "Home",
    // 시작 페이지를 대시보드로 리디렉션하거나, 실제 존재하는 HomePage로 연결
    // 여기서는 대시보드로 리디렉션하는 것을 추천합니다.
    redirect: "/dashboard",
  },
  {
    path: "/signup",
    name: "SignupPage", // 이름은 그대로 두어도 괜찮습니다.
    // 실제 파일 경로를 정확하게 수정합니다. (SignUpPage -> SignupPage)
    component: () => import("@/views/SignupPage.vue"),
  },
  // ▲▲▲ [수정] 완료 ▲▲▲
  {
    path: "/login",
    name: "LoginPage",
    component: () => import("@/views/LoginPage.vue"),
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
    path: "/my-investments",
    name: "MyInvestmentsPage",
    component: () => import("@/views/MyInvestmentsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/investment/:id",
    name: "InvestmentDetailPage",
    component: () => import("@/views/InvestmentDetailPage.vue"),
    props: true,
    meta: { requiresAuth: true },
  },
  {
    path: "/community",
    name: "CommunityPage",
    component: () => import("@/views/CommunityPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/nft-marketplace",
    name: "NftMarketplacePage",
    component: () => import("@/views/NFTMarketplacePage.vue"),
    meta: { requiresAuth: true, requiresNFT: true },
  },
  {
    path: "/profile",
    name: "UserProfilePage",
    component: () => import("@/views/UserProfilePage.vue"),
    meta: { requiresAuth: true },
  },
  // --- 사용자용 추가 관리 페이지 라우트 ---
  {
    path: "/my-tokens",
    name: "MyTokensPage",
    component: () => import("@/views/MyTokensPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/my-nfts",
    name: "MyNFTsPage",
    component: () => import("@/views/MyNFTsPage.vue"),
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
  // --- 관리자 대시보드 라우트 ---
  {
    path: "/admin-dashboard",
    name: "AdminDashboardPage",
    component: () => import("@/views/AdminDashboardPage.vue"),
    meta: { requiresAuth: true, isAdmin: true },
    children: [
      {
        path: "users",
        name: "AdminUserManagement",
        component: () => import("@/components/admin/UserManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "centers",
        name: "AdminCenterManagement",
        component: () => import("@/components/admin/CenterManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "investments",
        name: "AdminInvestmentManagement",
        component: () => import("@/components/admin/InvestmentManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "notices-community",
        name: "AdminNoticesCommunity",
        component: () =>
          import("@/components/admin/NoticesCommunityManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "events",
        name: "AdminEventManagement",
        component: () => import("@/components/admin/EventManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "products",
        name: "AdminProductManagement",
        component: () => import("@/components/admin/ProductManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "orders-delivery",
        name: "AdminOrderDeliveryManagement",
        component: () =>
          import("@/components/admin/OrderDeliveryManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "tokens",
        name: "AdminTokenManagement",
        component: () => import("@/components/admin/TokenManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "nfts",
        name: "AdminNFTManagement",
        component: () => import("@/components/admin/NFTManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "equity",
        name: "AdminEquityManagement",
        component: () => import("@/components/admin/EquityManagement.vue"),
        meta: { requiresAuth: true, isAdmin: true },
      },
      {
        path: "",
        redirect: { name: "AdminUserManagement" },
      },
    ],
  },
  // 404 Not Found 페이지
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
  const requiresNFT = to.matched.some((record) => record.meta.requiresNFT);
  const requiresAdmin = to.matched.some((record) => record.meta.isAdmin);

  const currentUser = await getCurrentUser();

  if (requiresAuth && !currentUser) {
    alert("로그인이 필요한 페이지입니다. 로그인 해주세요.");
    next("/login");
  } else if (currentUser) {
    let userProfile = null;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        userProfile = userSnap.data();
      }
    } catch (error) {
      console.error("사용자 프로필을 불러오는 중 오류 발생:", error);
    }

    if (to.name === "LoginPage" || to.name === "SignupPage") {
      next("/dashboard");
    } else if (requiresAdmin && (!userProfile || !userProfile.isAdmin)) {
      alert("관리자 권한이 없습니다.");
      next("/dashboard");
    } else if (requiresNFT) {
      if (!userProfile || !userProfile.hasNFT) {
        alert(
          "이 페이지는 공장 지분 연동 NFT를 보유한 솔트메이트만 접근할 수 있습니다.",
        );
        next("/dashboard");
      } else {
        next();
      }
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;

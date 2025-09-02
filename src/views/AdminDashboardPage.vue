<template>
  <div class="admin-dashboard-page">
    <header class="page-header">
      <h1><i class="fas fa-tools"></i> 관리자 대시보드</h1>
      <p class="description">솔트메이트 서비스의 다양한 항목을 관리합니다.</p>
    </header>
    <main class="content-wrapper admin-layout">
      <aside class="admin-sidebar card glassmorphism">
        <h2>관리 메뉴</h2>
        <ul class="admin-nav">
          <li>
            <router-link
              to="/admin-dashboard/users"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-users"></i> 회원 관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/centers"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-map-marker-alt"></i> 지역(센터)
              관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/subscriptions"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-check-double"></i> 구독 승인 관리
              <span
                v-if="notificationCounts.subscriptions > 0"
                class="notification-badge"
                >{{ notificationCounts.subscriptions }}</span
              >
            </router-link>
          </li>
          <li>
            <router-link
              to="/admin-dashboard/weekly-payouts"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-calendar-check"></i> 주간 정산 관리
              <span
                v-if="notificationCounts.weeklyPayouts > 0"
                class="notification-badge"
                >{{ notificationCounts.weeklyPayouts }}</span
              >
            </router-link>
          </li>
          <li>
            <router-link
              to="/admin-dashboard/marketing-plan"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-cogs"></i> 마케팅 플랜 관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/investments"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-hand-holding-usd"></i> 투자금 관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/notices-community"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-comments"></i> 공지사항 및 알림</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/events"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-calendar-alt"></i> 이벤트 관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/products"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-box"></i> 상품 관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/orders-delivery"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-truck"></i> 주문 배송관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/withdrawals"
              class="nav-item"
              active-class="active-link"
            >
              <i class="fas fa-hand-holding-usd"></i> 출금 신청 관리
              <span
                v-if="notificationCounts.withdrawals > 0"
                class="notification-badge"
                >{{ notificationCounts.withdrawals }}</span
              >
            </router-link>
          </li>
          <li>
            <router-link
              to="/admin-dashboard/payments"
              class="nav-item"
              active-class="active-link"
            >
              <i class="fas fa-money-check-alt"></i> 월간 결제 관리
              <span
                v-if="notificationCounts.monthlyPayments > 0"
                class="notification-badge"
                >{{ notificationCounts.monthlyPayments }}</span
              >
            </router-link>
          </li>
          <li>
            <router-link
              to="/admin-dashboard/tokens"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-coins"></i> 토큰관리 (COBS, BND,
              SSC)</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/nfts"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-gem"></i> NFT관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/nft-types"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-cubes"></i> NFT 종류 관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/equity"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-chart-pie"></i> 지분관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/game-conversion-settings"
              class="nav-item"
              active-class="active-link"
            >
              <i class="fas fa-gamepad"></i> 게임 설정
            </router-link>
          </li>
          <li>
            <router-link
              to="/admin-dashboard/database-backup"
              class="nav-item"
              active-class="active-link"
            >
              <i class="fas fa-database"></i> DB 백업
            </router-link>
          </li>
        </ul>
      </aside>
      <section class="admin-content card glassmorphism">
        <router-view></router-view>
      </section>
    </main>
  </div>
</template>

<script setup>
import { reactive, onMounted, onUnmounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  query,
  where,
  onSnapshot,
  getCountFromServer,
} from "firebase/firestore";
// [수정] RealtimeUsersWidget는 이제 /admin-dashboard/users 경로에서만 보이므로 여기서 import할 필요가 없습니다.

const notificationCounts = reactive({
  subscriptions: 0,
  weeklyPayouts: 0,
  withdrawals: 0,
  monthlyPayments: 0,
});

let unsubscribeListeners = [];

const setupNotificationListeners = () => {
  const createCountListener = (collectionName, countProperty) => {
    try {
      const q = query(
        collection(db, collectionName),
        where("status", "==", "pending"),
      );
      const unsubscribe = onSnapshot(q, async () => {
        const snapshot = await getCountFromServer(q);
        notificationCounts[countProperty] = snapshot.data().count;
      });
      unsubscribeListeners.push(unsubscribe);
    } catch (error)
      // eslint-disable-next-line no-console
      console.error(`Error setting up listener for ${collectionName}:`, error);
    }
  };

  createCountListener("subscription_requests", "subscriptions");
  createCountListener("weekly_payout_requests", "weeklyPayouts");
  createCountListener("withdrawalRequests", "withdrawals");
  createCountListener("monthly_payments", "monthlyPayments");
};

onMounted(() => {
  setupNotificationListeners();
});

onUnmounted(() => {
  unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
});
</script>

<style scoped>
.admin-dashboard-page {
  padding: 20px;
  max-width: 1400px; /* [수정] 너비를 넓혀서 더 많은 콘텐츠를 표시 */
  margin: 70px auto 20px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.page-header {
  text-align: center;
  margin-bottom: 20px;
}
.page-header h1 {
  font-size: 2.8em;
  color: #333;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}
.page-header h1 i {
  color: #007bff;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.admin-layout {
  display: flex;
  gap: 30px;
  align-items: flex-start;
}
.admin-sidebar {
  flex: 0 0 280px; /* [수정] 사이드바 너비 조정 */
  padding: 30px 20px;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.4);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.admin-sidebar h2 {
  font-size: 1.8em;
  color: #333;
  margin-bottom: 25px;
  text-align: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
}
.admin-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}
.admin-nav li {
  margin-bottom: 10px;
}
.admin-nav .nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  border-radius: 8px;
  color: #555;
  text-decoration: none;
  font-size: 1.05em; /* [수정] 폰트 크기 미세 조정 */
  font-weight: 500;
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    transform 0.2s ease;
  position: relative;
}
.admin-nav .nav-item i {
  font-size: 1.2em;
  color: #007bff;
  width: 20px; 
  text-align: center;
}
.admin-nav .nav-item.active-link,
.admin-nav .nav-item:hover {
  background-color: rgba(0, 123, 255, 0.1);
  color: #007bff;
  transform: translateX(5px);
}
.admin-nav .nav-item.active-link {
  background-color: #007bff;
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
}
.admin-nav .nav-item.active-link i {
  color: #fff;
}
.admin-content {
  flex: 1;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  background: rgba(255, 255, 255, 0.4);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  min-height: 500px;
}
.notification-badge {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  background-color: #dc3545;
  color: white;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  font-size: 0.8em;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  box-shadow: 0 0 5px rgba(220, 53, 69, 0.7);
}

@media (max-width: 992px) {
  .admin-layout {
    flex-direction: column;
    align-items: stretch;
  }
  .admin-sidebar {
    flex: none;
    width: 100%;
    margin-bottom: 20px;
  }
  .admin-sidebar h2 {
    text-align: left;
    border-bottom: none;
    padding-bottom: 0;
  }
  .admin-nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 15px;
  }
  .admin-nav li {
    margin-bottom: 0;
  }
  .admin-nav .nav-item {
    padding: 10px 12px;
    font-size: 1em;
    gap: 8px;
  }
}
@media (max-width: 576px) {
  .admin-dashboard-page {
    padding: 10px;
  }
  .page-header h1 {
    font-size: 2.2em;
  }
  .admin-content,
  .admin-sidebar {
    padding: 20px;
  }
  .admin-nav {
    flex-direction: column;
    gap: 5px;
  }
  .admin-nav .nav-item {
    justify-content: center;
  }
}
</style>
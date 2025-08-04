<template>
  <div class="admin-dashboard-page">
    <header class="page-header">
      <h1><i class="fas fa-tools"></i> 관리자 대시보드</h1>
      <p class="description">솔트메이트 서비스의 다양한 항목을 관리합니다.</p>
    </header>

    <div class="temp-admin-box">
      <p>
        <strong>관리자 권한 설정:</strong><br />아래 이메일을 가진 사용자의 인증
        토큰에 관리자 권한을 부여합니다.
      </p>
      <input v-model="targetEmail" placeholder="관리자로 지정할 계정 이메일" />
      <button @click="setAdminClaim">관리자 권한 부여</button>
    </div>
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
              ><i class="fas fa-check-double"></i> 구독 승인 관리</router-link
            >
          </li>
          <li>
            <router-link
              to="/admin-dashboard/weekly-payouts"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-calendar-check"></i> 주간 정산 관리</router-link
            >
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
              ><i class="fas fa-comments"></i> 공지사항 및 커뮤니티
              관리</router-link
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
              to="/admin-dashboard/tokens"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-coins"></i> 토큰관리 (COBS, BND)</router-link
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
              to="/admin-dashboard/equity"
              class="nav-item"
              active-class="active-link"
              ><i class="fas fa-chart-pie"></i> 지분관리</router-link
            >
          </li>
        </ul>
      </aside>
      <section class="admin-content card glassmorphism">
        <router-view></router-view>
      </section>
    </main>
  </div>
</template>

<script>
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref } from "vue";

export default {
  name: "AdminDashboardPage",
  setup() {
    const targetEmail = ref("");

    const setAdminClaim = async () => {
      if (!targetEmail.value) {
        alert("관리자로 지정할 계정의 이메일을 입력해주세요.");
        return;
      }
      if (
        !confirm(
          `정말로 '${targetEmail.value}' 계정을 관리자로 지정하시겠습니까?`,
        )
      ) {
        return;
      }

      try {
        const functions = getFunctions();
        const setUserAdmin = httpsCallable(functions, "setUserAdminClaim");
        const result = await setUserAdmin({ email: targetEmail.value });

        console.log(result.data.message);
        alert(
          result.data.message +
            "\n\n이제 해당 계정으로 로그아웃 후 다시 로그인해주세요.",
        );
      } catch (err) {
        console.error(err);
        alert("관리자 지정에 실패했습니다. 오류: " + err.message);
      }
    };

    return { targetEmail, setAdminClaim };
  },
};
</script>

<style scoped>
/* 기존 스타일 */
.admin-dashboard-page {
  padding: 20px;
  max-width: 1200px;
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
  flex: 0 0 250px;
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
  font-size: 1.1em;
  font-weight: 500;
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    transform 0.2s ease;
}
.admin-nav .nav-item i {
  font-size: 1.2em;
  color: #007bff;
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

/* 임시 버튼 스타일 */
.temp-admin-box {
  background: #fff3cd;
  border: 1px solid #ffeeba;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  margin-bottom: 30px;
}
.temp-admin-box p {
  margin-bottom: 15px;
  line-height: 1.5;
}
.temp-admin-box input {
  padding: 8px 12px;
  border-radius: 5px;
  border: 1px solid #ccc;
  margin-right: 10px;
  font-size: 1em;
}
.temp-admin-box button {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
}
</style>

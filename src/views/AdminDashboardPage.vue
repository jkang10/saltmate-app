<template>
  <div class="admin-dashboard">
    <header class="dashboard-header">
      <h1><i class="fas fa-tools"></i> 관리자 대시보드</h1>
      <p>솔트메이트 서비스의 다양한 항목을 관리합니다.</p>
    </header>
    <div class="dashboard-content">
      <aside class="sidebar">
        <nav class="management-menu">
          <h4>관리 메뉴</h4>
          <ul>
            <li>
              <router-link to="/admin-dashboard/users" class="nav-link">
                <i class="fas fa-users"></i> 회원 관리
              </router-link>
            </li>
            <li>
              <router-link to="/admin-dashboard/centers" class="nav-link">
                <i class="fas fa-map-marker-alt"></i> 지역(센터) 관리
              </router-link>
            </li>
            <li>
              <router-link to="/admin-dashboard/investments" class="nav-link">
                <i class="fas fa-hand-holding-usd"></i> 투자금 관리
              </router-link>
            </li>
            <li>
              <router-link
                to="/admin-dashboard/notices-community"
                class="nav-link"
              >
                <i class="fas fa-bullhorn"></i> 공지사항/커뮤니티
              </router-link>
            </li>
            <li>
              <router-link to="/admin-dashboard/events" class="nav-link">
                <i class="fas fa-calendar-alt"></i> 이벤트 관리
              </router-link>
            </li>
            <li>
              <router-link to="/admin-dashboard/products" class="nav-link">
                <i class="fas fa-box-open"></i> 상품 관리
              </router-link>
            </li>
            <li>
              <router-link
                to="/admin-dashboard/orders-delivery"
                class="nav-link"
              >
                <i class="fas fa-truck-loading"></i> 주문 배송 관리
              </router-link>
            </li>
            <li>
              <router-link to="/admin-dashboard/tokens" class="nav-link">
                <i class="fas fa-coins"></i> 토큰 관리
              </router-link>
            </li>
            <li>
              <router-link to="/admin-dashboard/nfts" class="nav-link">
                <i class="fas fa-gem"></i> NFT 관리
              </router-link>
            </li>
            <li>
              <router-link to="/admin-dashboard/equity" class="nav-link">
                <i class="fas fa-chart-pie"></i> 지분 관리
              </router-link>
            </li>
          </ul>
        </nav>
      </aside>
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script>
export default {
  name: "AdminDashboardPage",
};
</script>

<style scoped>
.admin-dashboard {
  padding: 20px;
  max-width: 1400px;
  margin: 70px auto 20px auto;
}
.dashboard-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 12px;
}
.dashboard-header h1 {
  font-size: 2.5em;
  color: #333;
}
.dashboard-content {
  display: flex;
  gap: 20px;
}
.sidebar {
  flex: 0 0 250px;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  align-self: flex-start;
}
.management-menu h4 {
  font-size: 1.2em;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}
.management-menu ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.management-menu .nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 15px;
  text-decoration: none;
  color: #333;
  border-radius: 8px;
  transition: background-color 0.3s, color 0.3s;
}
.management-menu .nav-link:hover {
  background-color: #f0f2f5;
}
.management-menu .nav-link.router-link-exact-active {
  background-color: #007bff;
  color: white;
  font-weight: bold;
}
.management-menu .nav-link i {
  width: 20px;
  text-align: center;
}
.main-content {
  flex-grow: 1;
}
</style>
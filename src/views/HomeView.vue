<template>
  <div class="home">
    <h1>솔트메이트에 오신 것을 환영합니다!</h1>
    <p>이곳은 로그인 후 보이는 앱의 메인 시작 페이지입니다.</p>
    <p>
      여기에 사용자별 대시보드 요약, 최신 소식, 투자 현황 등
      <br />솔트메이트 앱의 핵심 콘텐츠를 추가해주세요.
    </p>

    <div class="placeholder-content">
      <h2>주요 기능 탐색</h2>
      <ul>
        <li><router-link to="/dashboard">대시보드</router-link></li>
        <li><router-link to="/shop">샵</router-link></li>
        <li><router-link to="/my-investments">내 투자</router-link></li>
        <li><router-link to="/community">커뮤니티</router-link></li>
        <li><router-link to="/profile">내 프로필</router-link></li>
        </ul>
    </div>
  </div>
</template>

<script>
// 더 이상 HelloWorld 컴포넌트를 임포트하거나 사용하지 않습니다.
// import HelloWorld from "@/components/HelloWorld.vue";

export default {
  name: "HomeView",
  components: {
    // HelloWorld, // 이 줄을 제거하거나 주석 처리합니다.
    // 여기에 로그인 후 홈 화면에 필요한 다른 컴포넌트들을 임포트하고 등록할 수 있습니다.
    // 예를 들어, DashboardSummary, RecentActivityFeed 등
  },
  data() {
    return {
      // isLoggedIn: false, // 실제 로그인 상태는 Vuex 또는 전역 상태 관리로 처리
    };
  },
  // Vue Router의 beforeEach 가드에서 로그인 상태를 처리하므로,
  // 여기에서는 특별한 로직이 필요 없을 수도 있습니다.
  // 필요에 따라 컴포넌트 내부에서 로그인 상태를 확인하여 다른 내용을 표시할 수 있습니다.
};
</script>

<style scoped>
/* 이 스타일은 HomeView.vue에만 적용됩니다. */
.home {
  padding: 60px 20px;
  max-width: 900px;
  margin: 60px auto;
  background-color: #ffffff;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  text-align: center;
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h1 {
  color: #2c3e50;
  font-size: 2.8em;
  margin-bottom: 25px;
  font-weight: 700;
}

p {
  color: #555;
  font-size: 1.15em;
  line-height: 1.8;
  margin-bottom: 30px;
}

.placeholder-content {
  margin-top: 40px;
  padding: 30px;
  background-color: #f9f9f9;
  border-radius: 10px;
  border: 1px dashed #e0e0e0;
}

.placeholder-content h2 {
  color: #34495e;
  font-size: 1.8em;
  margin-bottom: 25px;
}

.placeholder-content ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
}

.placeholder-content li {
  margin-bottom: 10px;
}

.placeholder-content a {
  display: block;
  padding: 12px 25px;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
  transition: background-color 0.3s ease, transform 0.2s ease;
  box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
}

.placeholder-content a:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.3);
}
</style>
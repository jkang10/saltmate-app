<template>
  <div id="app">
    <AppNavbar />
    <router-view />
  </div>
</template>

<script>
import AppNavbar from "@/components/common/Navbar.vue";

export default {
  name: "App",
  components: {
    AppNavbar,
  },
};
</script>

<style>
/* 전역 스타일 */
html,
body {
  margin: 0; /* 기본 마진 제거 */
  padding: 0; /* 기본 패딩 제거 */
  width: 100%; /* 너비를 100%로 설정하여 가로 스크롤 방지 */
  overflow-x: hidden; /* 가로 스크롤 명시적 방지 */
  font-family: "Noto Sans KR", sans-serif; /* 한국어 폰트 우선 적용 고려 */
  background-color: #f0f2f5; /* 전반적인 배경색 */
  color: #333;
  line-height: 1.6;
  box-sizing: border-box; /* 모든 요소에 box-sizing 적용 */
}

/* 모든 요소에 box-sizing 적용 (border-box는 패딩과 테두리를 요소의 전체 너비와 높이에 포함) */
*,
*::before,
*::after {
  box-sizing: border-box;
}

#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  /* Navbar는 sticky/fixed로 상단에 고정되므로, #app 자체에는 padding-top을 주지 않습니다. */
  /* 대신 body에 padding-top을 주어 콘텐츠가 Navbar 아래에서 시작하도록 합니다. */
}

/* body에 상단 패딩을 주어 Navbar가 콘텐츠를 가리지 않도록 함 */
body {
  padding-top: 70px; /* AppNavbar의 실제 높이에 맞춰 조절 (약 60px + 여유) */
}

/* 모든 링크 기본 스타일 */
a {
  color: #007bff;
  text-decoration: none;
  transition: color 0.3s ease;
}

a:hover {
  color: #0056b3;
  text-decoration: underline;
}

/* 카드 및 글래스모피즘 공통 스타일 */
.card {
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  padding: 30px;
  margin-bottom: 20px;
  border: 1px solid #e0e0e0; /* 연한 테두리 추가 */
}

.glassmorphism {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* 공통 버튼 스타일 */
.button-primary,
.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.05em;
  font-weight: bold;
  color: white;
  background-color: #007bff; /* 기본 버튼 색상 */
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.3s ease;
  text-decoration: none; /* router-link 사용 시 기본 밑줄 제거 */
}

.button-primary:hover,
.action-button:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.2);
}

.button-secondary {
  background-color: #6c757d;
}

.button-secondary:hover {
  background-color: #5a6268;
}

.button-success {
  background-color: #28a745;
}

.button-success:hover {
  background-color: #218838;
}

.button-outline {
  background-color: transparent;
  color: #007bff;
  border: 2px solid #007bff;
}

.button-outline:hover {
  background-color: #e6f2ff;
  color: #0056b3;
  box-shadow: none;
}

/* 페이지 헤더 공통 스타일 */
.page-header {
  text-align: center;
  margin-bottom: 40px;
  padding: 20px;
  background: linear-gradient(135deg, #e0f2f7, #c1e0f0);
  border-radius: 15px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.page-header h1 {
  font-size: 2.8em;
  color: #2c3e50;
  margin-bottom: 15px;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.page-header h1 i {
  color: #4caf50; /* 아이콘 색상 */
}

.page-header .description {
  font-size: 1.2em;
  color: #555;
  max-width: 700px;
  margin: 0 auto;
}

/* 로딩 및 에러 상태 공통 스타일 */
.loading-state,
.error-state,
.no-data-state,
.not-found-state {
  padding: 50px;
  text-align: center;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  max-width: 600px;
  margin: 50px auto;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #4caf50;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-state p,
.error-state p,
.no-data-state p,
.not-found-state p {
  font-size: 1.1em;
  color: #666;
  margin-bottom: 20px;
}

.error-message {
  color: #e74c3c;
  font-weight: bold;
}

.retry-button,
.explore-button,
.back-to-dashboard-button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
}

.retry-button:hover,
.explore-button:hover,
.back-to-dashboard-button:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
}

/* 기타 공통 유틸리티 */
.text-center {
  text-align: center;
}
.text-right {
  text-align: right;
}
.text-left {
  text-align: left;
}
.mt-20 {
  margin-top: 20px;
}
.mb-20 {
  margin-bottom: 20px;
}
.p-20 {
  padding: 20px;
}

/* Font Awesome 아이콘 스타일 */
.fa-edit,
.fa-dollar-sign,
.fa-chart-line,
.fa-users,
.fa-id-badge,
.fa-hand-holding-usd,
.fa-seedling {
  margin-right: 5px;
}

/* 스크롤바 커스터마이징 (선택 사항) */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

<template>
  <div class="my-events-page">
    <header class="page-header">
      <h1><i class="fas fa-calendar-alt"></i> 나의 이벤트 관리</h1>
      <p class="description">참여 가능한 이벤트 및 쿠폰 현황을 확인합니다.</p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <h2>이벤트 및 쿠폰 현황</h2>
      <p>
        여기에 현재 참여 가능한 이벤트, 보유 쿠폰 목록, 지난 이벤트 기록 등을
        표시합니다.
      </p>
      <p>이 페이지는 현재 개발 중입니다.</p>
      <router-link to="/dashboard" class="back-button">
        <i class="fas fa-arrow-left"></i> 대시보드로 돌아가기
      </router-link>
    </main>
  </div>
</template>

<script>
export default {
  name: "MyEventsPage",
};
</script>

<style scoped>
.my-events-page {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px auto;
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
  color: #e67e22; /* 이벤트 아이콘 색상 */
}

.page-header .description {
  font-size: 1.1em;
  color: #666;
}

.content-wrapper {
  padding: 30px;
  text-align: center;
}

.content-wrapper h2 {
  font-size: 2em;
  color: #333;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
}

.content-wrapper p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 20px;
  line-height: 1.6;
}

.card.glassmorphism {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.back-button {
  background-color: #6c757d;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  text-decoration: none;
  transition: background-color 0.3s ease, transform 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.back-button:hover {
  background-color: #5a6268;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2.2em;
  }
  .content-wrapper {
    padding: 20px;
  }
  .content-wrapper h2 {
    font-size: 1.8em;
  }
  .back-button {
    padding: 10px 20px;
    font-size: 0.9em;
  }
}
</style>

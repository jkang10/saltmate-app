<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> NFT 마켓플레이스</h1>
      <p class="description">보유한 NFT를 확인하고 멤버십 혜택을 누리세요.</p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <h2><i class="fas fa-wrench"></i> 기능 준비 중</h2>
      <p>
        NFT 마켓플레이스 기능은 현재 준비 중에 있습니다.
        <br />
        곧 멋진 모습으로 찾아뵙겠습니다!
      </p>
      <router-link to="/dashboard" class="back-button">
        <i class="fas fa-arrow-left"></i> 대시보드로 돌아가기
      </router-link>
    </main>
  </div>
</template>

<script>
export default {
  name: "NFTMarketplacePage",
};
</script>

<style scoped>
.page-container {
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
  color: #17a2b8; /* NFT 아이콘 색상 */
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  padding: 50px 30px;
  text-align: center;
}
.content-wrapper h2 {
  font-size: 2em;
  color: #333;
  margin-bottom: 20px;
}
.content-wrapper p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 30px;
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
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
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
</style>

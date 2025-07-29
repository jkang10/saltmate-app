<template>
  <div class="nft-marketplace-page">
    <header class="page-header">
      <h1>🖼️ NFT 마켓플레이스 (개발 중)</h1>
      <p class="description">
        솔트메이트의 특별한 NFT들을 만나볼 수 있는 공간입니다.
      </p>
    </header>

    <main class="content-wrapper">
      <div class="placeholder-content card glassmorphism">
        <h2>이 페이지는 현재 개발 중입니다.</h2>
        <p>곧 멋진 NFT 기능과 상품들을 만나보실 수 있도록 준비하고 있습니다.</p>
        <router-link to="/dashboard" class="back-to-dashboard-button">
          대시보드로 돌아가기
        </router-link>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  name: "NFTMarketplacePage",
};
</script>

<style scoped>
.nft-marketplace-page {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 2.8em;
  color: #333;
  margin-bottom: 10px;
}

.page-header .description {
  font-size: 1.1em;
  color: #666;
}

.placeholder-content {
  padding: 40px;
  text-align: center;
  margin-top: 50px;
}

.placeholder-content h2 {
  font-size: 2em;
  color: #4caf50;
  margin-bottom: 20px;
}

.placeholder-content p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 30px;
}

.back-to-dashboard-button {
  display: inline-block;
  background-color: #007bff;
  color: white;
  padding: 12px 25px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  transition: background-color 0.3s ease;
}

.back-to-dashboard-button:hover {
  background-color: #0056b3;
}

/* Glassmorphism 스타일 */
.card {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>

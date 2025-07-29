<template>
  <div class="nft-detail-page">
    <header class="page-header">
      <h1>✨ NFT 상세 정보 (개발 중)</h1>
      <p class="description">요청하신 NFT의 상세 정보를 표시할 페이지입니다.</p>
    </header>

    <main class="content-wrapper">
      <div class="placeholder-content card glassmorphism">
        <h2>이 페이지는 현재 개발 중입니다.</h2>
        <p>
          특정 NFT ID: <span class="nft-id-display" v-if="id">{{ id }}</span>
        </p>
        <p>NFT에 대한 상세 정보, 거래 기록 등이 여기에 표시될 예정입니다.</p>
        <router-link to="/nft-marketplace" class="back-to-marketplace-button">
          마켓플레이스로 돌아가기
        </router-link>
        <router-link to="/dashboard" class="back-to-dashboard-button">
          대시보드로 돌아가기
        </router-link>
      </div>
    </main>
  </div>
</template>

<script>
import { useRoute } from "vue-router";
import { ref, onMounted } from "vue";

export default {
  name: "NFTDetailPage",
  setup() {
    const route = useRoute();
    const id = ref(null);

    onMounted(() => {
      // URL 파라미터에서 NFT ID 가져오기
      id.value = route.params.id;
    });

    return {
      id,
    };
  },
};
</script>

<style scoped>
.nft-detail-page {
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

.nft-id-display {
  font-weight: bold;
  color: #007bff;
}

.back-to-marketplace-button,
.back-to-dashboard-button {
  display: inline-block;
  background-color: #007bff;
  color: white;
  padding: 12px 25px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  transition: background-color 0.3s ease;
  margin: 0 10px; /* 버튼 간 간격 */
}

.back-to-marketplace-button:hover,
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

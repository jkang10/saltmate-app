<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> NFT 마켓플레이스</h1>
      <p class="description">보유한 NFT를 확인하고 멤버십 혜택을 누리세요.</p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>NFT 정보를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else>
        <section class="nft-gallery">
          <h2>나의 보유 NFT</h2>
          <div v-if="myNfts.length === 0" class="empty-state">
            <p>보유하고 있는 NFT가 없습니다.</p>
          </div>
          <div v-else class="nft-grid">
            <div v-for="nft in myNfts" :key="nft.id" class="nft-card">
              <img :src="nft.imageUrl" :alt="nft.name" class="nft-image" />
              <div class="nft-info">
                <h3 class="nft-name">{{ nft.name }}</h3>
                <p class="nft-description">{{ nft.description }}</p>
                <span :class="['nft-tier-badge', nft.tier]">{{
                  nft.tier
                }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="benefits-section">
          <h2>NFT 멤버십 혜택</h2>
          <ul class="benefits-list">
            <li>
              <strong>GOLD TIER:</strong> 솔트메이트 몰 5% 할인 쿠폰 매월 지급
            </li>
            <li>
              <strong>DIAMOND TIER:</strong> 솔트메이트 몰 10% 할인 및 월간 특별
              상품 제공
            </li>
            <li>
              <strong>PLATINUM TIER:</strong> 모든 혜택 포함 및 분기별 오프라인
              이벤트 우선 초청
            </li>
          </ul>
        </section>
      </div>
      <router-link to="/dashboard" class="back-button">
        <i class="fas fa-arrow-left"></i> 대시보드로 돌아가기
      </router-link>
    </main>
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default {
  name: "NFTMarketplacePage",
  data() {
    return {
      myNfts: [],
      isLoading: true,
      error: null,
    };
  },
  async created() {
    await this.fetchMyNfts();
  },
  methods: {
    async fetchMyNfts() {
      this.isLoading = true;
      this.error = null;
      if (!auth.currentUser) {
        this.error = "로그인이 필요합니다.";
        this.isLoading = false;
        return;
      }

      try {
        // 'nfts' 컬렉션에서 현재 로그인한 사용자의 ID를 가진 NFT 문서를 조회합니다.
        const q = query(
          collection(db, "nfts"),
          where("ownerId", "==", auth.currentUser.uid),
        );
        const querySnapshot = await getDocs(q);

        // Firestore에서 가져온 데이터를 컴포넌트의 데이터에 맞게 가공합니다.
        this.myNfts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          // 예시 이미지 URL입니다. 실제로는 Firestore에 저장된 URL을 사용해야 합니다.
          imageUrl: doc.data().imageUrl || "https://via.placeholder.com/300",
          ...doc.data(),
        }));
      } catch (e) {
        console.error("NFT 정보 조회 오류:", e);
        this.error = "NFT 정보를 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style scoped>
/* 기존 스타일과 유사하게 구성 */
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 70px auto 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.8em;
  color: #333;
}
.page-header h1 i {
  color: #17a2b8;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  padding: 30px;
}
.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.nft-gallery h2,
.benefits-section h2 {
  font-size: 1.8em;
  color: #333;
  margin-bottom: 25px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
}
.nft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 25px;
}
.nft-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}
.nft-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
.nft-image {
  width: 100%;
  height: 250px;
  object-fit: cover;
  display: block;
}
.nft-info {
  padding: 20px;
}
.nft-name {
  margin: 0 0 10px 0;
  font-size: 1.2em;
}
.nft-description {
  font-size: 0.9em;
  color: #555;
  margin-bottom: 15px;
}
.nft-tier-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
  color: white;
}
.nft-tier-badge.GOLD {
  background-color: #ffd700;
  color: #333;
}
.nft-tier-badge.DIAMOND {
  background-color: #b9f2ff;
  color: #333;
}
.nft-tier-badge.PLATINUM {
  background-color: #e5e4e2;
  color: #333;
}

.benefits-section {
  margin-top: 50px;
}
.benefits-list {
  list-style: none;
  padding: 0;
  text-align: left;
}
.benefits-list li {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
}
.back-button:hover {
  background-color: #5a6268;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>

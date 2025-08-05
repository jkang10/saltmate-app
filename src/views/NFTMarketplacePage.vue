<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> NFT 마켓플레이스</h1>
      <p class="description">보유한 NFT를 확인하고 멤버십 혜택을 누리세요.</p>
    </header>

    <main class="content-wrapper card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>NFT 정보를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else>
        <section class="summary-section">
          <div class="summary-card">
            <label>총 보유 NFT</label>
            <span>{{ myNfts.length }} 개</span>
          </div>
          <div class="summary-card">
            <label>PLATINUM</label>
            <span>{{ countByTier("PLATINUM") }} 개</span>
          </div>
          <div class="summary-card">
            <label>DIAMOND</label>
            <span>{{ countByTier("DIAMOND") }} 개</span>
          </div>
          <div class="summary-card">
            <label>GOLD</label>
            <span>{{ countByTier("GOLD") }} 개</span>
          </div>
        </section>

        <section class="nft-gallery">
          <h2>나의 보유 NFT</h2>
          <div v-if="myNfts.length === 0" class="empty-state">
            <p>보유하고 있는 NFT가 없습니다.</p>
          </div>
          <div v-else class="nft-grid">
            <div v-for="nft in myNfts" :key="nft.id" class="nft-card-container">
              <div class="nft-card">
                <div class="nft-card-front">
                  <img :src="nft.imageUrl" :alt="nft.name" class="nft-image" />
                  <div class="nft-info">
                    <h3 class="nft-name">{{ nft.name }}</h3>
                    <span :class="['nft-tier-badge', nft.tier]">{{
                      nft.tier
                    }}</span>
                  </div>
                </div>
                <div class="nft-card-back">
                  <h4>{{ nft.name }}</h4>
                  <p>{{ nft.description }}</p>
                  <div class="nft-properties">
                    <div class="property">
                      <strong>발행일:</strong
                      ><span>{{ formatDate(nft.mintDate) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
        const q = query(
          collection(db, "nfts"),
          where("ownerId", "==", auth.currentUser.uid),
        );
        const querySnapshot = await getDocs(q);

        this.myNfts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          imageUrl:
            doc.data().imageUrl || "https://via.placeholder.com/400x500",
          ...doc.data(),
        }));
      } catch (e) {
        console.error("NFT 정보 조회 오류:", e);
        this.error = "NFT 정보를 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    countByTier(tier) {
      return this.myNfts.filter((nft) => nft.tier === tier).length;
    },
    formatDate(timestamp) {
      if (!timestamp?.toDate) return "N/A";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    },
  },
};
</script>

<style scoped>
/* 페이지 기본 스타일 */
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
  color: #1a1a1a;
}
.page-header h1 i {
  color: #17a2b8;
}
.page-header .description {
  font-size: 1.1em;
  color: #555;
}
.content-wrapper {
  padding: 30px;
  background-color: #f8f9fa;
  border-radius: 15px;
}

/* 요약 섹션 */
.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 50px;
}
.summary-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #e9ecef;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}
.summary-card label {
  display: block;
  color: #666;
  font-size: 1em;
  margin-bottom: 10px;
  font-weight: 500;
}
.summary-card span {
  font-size: 2em;
  font-weight: bold;
  color: #333;
}

/* NFT 갤러리 */
.nft-gallery h2 {
  font-size: 1.8em;
  color: #333;
  margin-bottom: 25px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 15px;
}
.nft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 30px;
}

.nft-card-container {
  perspective: 1000px;
}
.nft-card {
  width: 100%;
  height: 400px;
  position: relative;
  transition: transform 0.8s;
  transform-style: preserve-3d;
  cursor: pointer;
}
.nft-card-container:hover .nft-card {
  transform: rotateY(180deg);
}
.nft-card-front,
.nft-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
.nft-card-front {
  background-color: #fff;
}
.nft-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.nft-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  color: white;
}
.nft-name {
  margin: 0 0 10px 0;
  font-size: 1.4em;
  text-shadow: 0 1px 3px black;
}
.nft-tier-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
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

.nft-card-back {
  background: linear-gradient(135deg, #495057, #343a40);
  color: white;
  transform: rotateY(180deg);
  padding: 25px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.nft-card-back h4 {
  font-size: 1.5em;
  margin-bottom: 15px;
}
.nft-card-back p {
  font-size: 0.95em;
  line-height: 1.6;
  flex-grow: 1;
}
.nft-properties {
  font-size: 0.9em;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 15px;
}
.property {
  display: flex;
  justify-content: space-between;
}

/* 돌아가기 버튼 */
.back-button {
  background: #007bff;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  text-decoration: none;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 40px;
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
}
.back-button:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
}
</style>

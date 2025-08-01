<template>
  <div class="shop-page">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 등급 선택 및 업그레이드</h1>
      <p class="description">
        솔트메이트의 등급을 선택하여 더 많은 혜택을 누리세요.
      </p>
    </header>

    <div v-if="isLoading" class="loading-container">
      <div class="spinner"></div>
      <p>등급 정보를 불러오는 중입니다...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
    </div>

    <main v-else class="tiers-grid">
      <div
        v-for="tier in tiers"
        :key="tier.amount"
        :class="['tier-card', tier.name.toLowerCase()]"
      >
        <div class="tier-header">
          <h3 class="tier-name">{{ tier.name }}</h3>
          <p v-if="tier.isSubscription" class="subscription-badge">매월 구독</p>
        </div>
        <div class="tier-price">
          <span class="amount">{{ tier.amount.toLocaleString() }}</span>
          <span class="currency">원</span>
        </div>
        <ul class="tier-features">
          <li><i class="fas fa-check"></i> 직접 추천 보너스 3%</li>
          <li><i class="fas fa-check"></i> 1대 매칭 보너스 3%</li>
          <li><i class="fas fa-check"></i> 300% 수익 순환</li>
        </ul>
        <button
          @click="purchaseTier(tier)"
          class="purchase-button"
          :disabled="isProcessing"
        >
          <span v-if="isProcessing" class="spinner-small"></span>
          <span v-else>이 등급으로 시작하기</span>
        </button>
      </div>
    </main>
  </div>
</template>

<script>
import { db, auth } from "@/firebaseConfig";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

export default {
  name: "ShopPage",
  setup() {
    const router = useRouter();
    const tiers = ref([]);
    const isLoading = ref(true);
    const isProcessing = ref(false);
    const error = ref(null);

    const fetchTiers = async () => {
      try {
        const configRef = doc(db, "configuration", "marketingPlan");
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const configTiers = configSnap.data().tiers;
          // Firestore map을 배열로 변환하여 정렬
          tiers.value = Object.entries(configTiers)
            .map(([amount, details]) => ({
              amount: Number(amount),
              ...details,
            }))
            .sort((a, b) => a.amount - b.amount);
        } else {
          throw new Error("등급 설정 정보를 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("Failed to fetch tiers:", err);
        error.value = "등급 정보를 불러오는 데 실패했습니다.";
      } finally {
        isLoading.value = false;
      }
    };

    const purchaseTier = async (tierInfo) => {
      isProcessing.value = true;
      try {
        const user = auth.currentUser;
        if (!user) {
          alert("로그인이 필요합니다.");
          router.push("/login");
          return;
        }

        // 실제로는 여기에 PG사 결제 모듈 호출 코드가 들어갑니다.
        // 지금은 결제가 성공했다고 가정하고 바로 다음 단계로 진행합니다.
        const paymentSuccessful = window.confirm(
          `'${
            tierInfo.name
          }' 등급을 ${tierInfo.amount.toLocaleString()}원에 구매하시겠습니까?`,
        );

        if (paymentSuccessful) {
          // 'investments' 컬렉션에 문서 생성 (Cloud Function 트리거)
          await addDoc(collection(db, "investments"), {
            userId: user.uid,
            amount: tierInfo.amount,
            tier: tierInfo.name,
            createdAt: serverTimestamp(),
          });

          alert(
            `'${tierInfo.name}' 등급 구매가 완료되었습니다! 대시보드에서 결과를 확인하세요.`,
          );
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Failed to process purchase:", err);
        alert("처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
      } finally {
        isProcessing.value = false;
      }
    };

    onMounted(fetchTiers);

    return {
      tiers,
      isLoading,
      isProcessing,
      error,
      purchaseTier,
    };
  },
};
</script>

<style scoped>
.shop-page {
  max-width: 1200px;
  margin: 70px auto 20px auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}
.page-header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}
.page-header .description {
  font-size: 1.2em;
  color: #666;
}

.loading-container,
.error-container {
  text-align: center;
  padding: 50px;
  font-size: 1.2em;
}

.tiers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
}

.tier-card {
  border: 1px solid #e0e0e0;
  border-radius: 15px;
  padding: 30px;
  text-align: center;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  display: flex;
  flex-direction: column;
}

.tier-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
}

.tier-header {
  min-height: 60px;
}

.tier-name {
  font-size: 1.8em;
  font-weight: bold;
  color: #007bff;
}

.subscription-badge {
  display: inline-block;
  background-color: #17a2b8;
  color: white;
  font-size: 0.8em;
  padding: 4px 10px;
  border-radius: 12px;
  margin-top: 5px;
}

.tier-price {
  margin: 20px 0;
  font-size: 2.5em;
  font-weight: bold;
}
.tier-price .currency {
  font-size: 0.5em;
  margin-left: 5px;
  color: #333;
}

.tier-features {
  list-style: none;
  padding: 0;
  margin: 20px 0;
  text-align: left;
  color: #555;
  flex-grow: 1;
}
.tier-features li {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.tier-features i {
  color: #28a745;
}

.purchase-button {
  width: 100%;
  padding: 15px;
  font-size: 1.1em;
  font-weight: bold;
  color: white;
  background-color: #007bff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-top: auto;
}
.purchase-button:hover {
  background-color: #0056b3;
}
.purchase-button:disabled {
  background-color: #a0c9ff;
  cursor: not-allowed;
}

.spinner,
.spinner-small {
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}
.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
}
.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

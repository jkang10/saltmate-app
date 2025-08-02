<template>
  <div class="shop-page">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 등급 선택</h1>
      <p class="description">
        솔트메이트의 등급을 구독하여 더 많은 혜택을 누리세요.
      </p>
    </header>

    <div v-if="isLoading" class="loading-container"></div>
    <div v-else-if="error" class="error-container"></div>

    <main v-else class="tiers-grid">
      <div
        v-for="tier in tiers"
        :key="tier.amount"
        :class="['tier-card', tier.name.toLowerCase()]"
      >
        <button
          @click="requestSubscription(tier)"
          class="purchase-button"
          :disabled="isProcessing || hasPendingRequest"
        >
          <span v-if="isProcessing" class="spinner-small"></span>
          <span v-else-if="userProfile && userProfile.tier === tier.name"
            >현재 나의 등급</span
          >
          <span v-else-if="hasPendingRequest">승인 대기중</span>
          <span v-else>이 등급으로 구독 신청</span>
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
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

export default {
  name: "ShopPage",
  setup() {
    const router = useRouter();
    const tiers = ref([]);
    const userProfile = ref(null);
    const hasPendingRequest = ref(false);
    const isLoading = ref(true);
    const isProcessing = ref(false);
    const error = ref(null);

    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          // 1. 사용자 프로필 정보 가져오기 (현재 등급 확인용)
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) userProfile.value = userSnap.data();

          // 2. 이 사용자의 'pending' 상태 요청이 있는지 확인
          const q = query(
            collection(db, "subscription_requests"),
            where("userId", "==", user.uid),
            where("status", "==", "pending"),
          );
          const requestSnap = await getDocs(q);
          hasPendingRequest.value = !requestSnap.empty;
        }

        // 3. 등급 설정 정보 가져오기
        const configRef = doc(db, "configuration", "marketingPlan");
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          const configTiers = configSnap.data().tiers;
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
        console.error("Failed to fetch data:", err);
        error.value = "정보를 불러오는 데 실패했습니다.";
      } finally {
        isLoading.value = false;
      }
    };

    const requestSubscription = async (tierInfo) => {
      isProcessing.value = true;
      try {
        const user = auth.currentUser;
        if (!user) {
          alert("로그인이 필요합니다.");
          router.push("/login");
          return;
        }

        if (
          window.confirm(
            `'${tierInfo.name}' 등급을 구독 신청하시겠습니까?\n관리자 승인 후 등급이 적용됩니다.`,
          )
        ) {
          // 'investments' 대신 'subscription_requests'에 문서 생성
          await addDoc(collection(db, "subscription_requests"), {
            userId: user.uid,
            userName: userProfile.value?.name || user.email,
            userEmail: user.email,
            requestedAmount: tierInfo.amount,
            requestedTier: tierInfo.name,
            status: "pending", // '승인 대기' 상태로 생성
            createdAt: serverTimestamp(),
          });
          alert("구독 신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
          hasPendingRequest.value = true; // 신청 후 버튼 상태 즉시 변경
        }
      } catch (err) {
        console.error("Failed to process request:", err);
        alert("처리 중 오류가 발생했습니다.");
      } finally {
        isProcessing.value = false;
      }
    };

    onMounted(fetchData);

    return {
      tiers,
      userProfile,
      hasPendingRequest,
      isLoading,
      isProcessing,
      error,
      requestSubscription,
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

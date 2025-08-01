<template>
  <div class="investment-detail-page">
    <header class="page-header">
      <h1>📈 투자 상품 상세 정보</h1>
      <p class="description" v-if="investment">
        "{{ investment.productName }}" 상품의 상세 현황입니다.
      </p>
      <p class="description" v-else>
        투자 상품의 상세 정보를 불러오는 중입니다.
      </p>
    </header>

    <main class="content-wrapper">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>상세 정보를 불러오는 중입니다...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p class="error-message">
          😔 상세 정보를 불러오는 데 실패했습니다: {{ error }}
        </p>
        <button @click="fetchInvestmentDetails" class="retry-button">
          다시 시도
        </button>
      </div>

      <div v-else-if="!investment" class="not-found-state">
        <p>요청하신 투자 상품을 찾을 수 없습니다.</p>
        <router-link to="/my-investments" class="back-button"
          >내 투자 목록으로 돌아가기</router-link
        >
      </div>

      <div v-else class="detail-card card glassmorphism">
        <div class="card-section header-section">
          <h2>{{ investment.productName }}</h2>
          <span :class="['status-badge', investment.status]">{{
            getStatusText(investment.status)
          }}</span>
        </div>

        <div class="card-section summary-section">
          <div class="summary-item">
            <span class="label">투자 금액</span>
            <span class="value"
              >{{ investment.investedAmount.toLocaleString() }} 원</span
            >
          </div>
          <div class="summary-item">
            <span class="label">현재 가치</span>
            <span class="value"
              >{{ investment.currentValue.toLocaleString() }} 원</span
            >
          </div>
          <div class="summary-item">
            <span class="label">수익률</span>
            <span :class="['value', getReturnRateClass(investment.returnRate)]"
              >{{ investment.returnRate.toFixed(2) }} %</span
            >
          </div>
        </div>

        <div class="card-section info-section">
          <h3>기본 정보</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">투자일</span>
              <span class="info-value">{{
                formatDate(investment.investmentDate)
              }}</span>
            </div>
            <div class="info-item" v-if="investment.expectedReturnDate">
              <span class="info-label">예상 회수일</span>
              <span class="info-value">{{
                formatDate(investment.expectedReturnDate)
              }}</span>
            </div>
            <div class="info-item" v-if="investment.progress !== undefined">
              <span class="info-label">진행도</span>
              <span class="info-value">{{ investment.progress }}%</span>
              <div class="progress-bar-container">
                <div
                  class="progress-bar"
                  :style="{ width: investment.progress + '%' }"
                ></div>
              </div>
            </div>
            <div class="info-item">
              <span class="info-label">상품 설명</span>
              <span class="info-value-block">{{
                investment.description || "상세 설명이 없습니다."
              }}</span>
            </div>
          </div>
        </div>

        <div
          class="card-section payout-section"
          v-if="investment.payoutHistory && investment.payoutHistory.length > 0"
        >
          <h3>배당 내역</h3>
          <ul class="payout-list">
            <li
              v-for="(payout, index) in investment.payoutHistory"
              :key="index"
              class="payout-item"
            >
              <span>{{ formatDate(payout.date) }}</span>
              <span>{{ payout.amount.toLocaleString() }} 원</span>
            </li>
          </ul>
        </div>

        <div class="card-footer">
          <router-link to="/my-investments" class="back-button">
            <i class="fas fa-chevron-left"></i> 내 투자 목록으로
          </router-link>
          <button class="action-button">문의하기</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router"; // useRouter 제거
import { db } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

export default {
  name: "InvestmentDetailPage",
  setup() {
    const route = useRoute();
    // const router = useRouter(); // 이 줄을 제거하거나 주석 처리하세요.
    const investment = ref(null);
    const loading = ref(true);
    const error = ref(null);

    const fetchInvestmentDetails = async () => {
      loading.value = true;
      error.value = null;
      try {
        const investmentId = route.params.id; // URL 파라미터에서 ID 가져오기
        if (!investmentId) {
          error.value = "투자 ID가 제공되지 않았습니다.";
          loading.value = false;
          // 만약 여기서 강제로 대시보드나 다른 페이지로 이동시키고 싶다면
          // router.push('/my-investments'); // 이렇게 useRouter를 사용해야 합니다.
          return;
        }

        const investmentDocRef = doc(db, "investments", investmentId);
        const investmentDocSnap = await getDoc(investmentDocRef);

        if (investmentDocSnap.exists()) {
          investment.value = {
            id: investmentDocSnap.id,
            ...investmentDocSnap.data(),
          };
        } else {
          investment.value = null; // 문서가 존재하지 않음
        }
      } catch (err) {
        console.error("투자 상세 정보를 불러오는 데 실패했습니다:", err);
        error.value = err.message || "알 수 없는 오류가 발생했습니다.";
      } finally {
        loading.value = false;
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case "active":
          return "진행 중";
        case "completed":
          return "완료됨";
        case "pending":
          return "승인 대기 중";
        case "cancelled":
          return "취소됨";
        default:
          return "알 수 없음";
      }
    };

    const getReturnRateClass = (rate) => {
      if (rate > 0) return "positive";
      if (rate < 0) return "negative";
      return "";
    };

    const formatDate = (dateInput) => {
      if (!dateInput) return "";
      // Firebase Timestamp 객체 처리
      if (dateInput.toDate) {
        return dateInput.toDate().toLocaleDateString("ko-KR");
      }
      // JavaScript Date 객체 처리
      if (dateInput instanceof Date) {
        return dateInput.toLocaleDateString("ko-KR");
      }
      return String(dateInput); // 그 외의 경우 문자열로 변환
    };

    onMounted(() => {
      fetchInvestmentDetails();
    });

    return {
      investment,
      loading,
      error,
      getStatusText,
      getReturnRateClass,
      formatDate,
      fetchInvestmentDetails,
    };
  },
};
</script>

<style scoped>
/* 기존 스타일 유지 */
.investment-detail-page {
  padding: 40px 20px;
  background: linear-gradient(
    135deg,
    #e0f7f2 0%,
    #d1ede8 100%
  ); /* 부드러운 그라데이션 배경 */
  min-height: 100vh;
  font-family: "Pretendard", sans-serif;
  color: #333;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 3em;
  color: #2c7c51;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.page-header .description {
  font-size: 1.1em;
  color: #555;
  max-width: 700px;
  margin: 0 auto;
  line-height: 1.5;
}

/* 로딩, 오류, 찾을 수 없음 상태 */
.loading-state,
.error-state,
.not-found-state {
  text-align: center;
  padding: 50px;
  border-radius: 15px;
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  max-width: 700px;
  margin: 50px auto;
}

.spinner {
  border: 8px solid #f3f3f3;
  border-top: 8px solid #2ecc71;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
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
.not-found-state p {
  font-size: 1.2em;
  color: #555;
}

.error-message {
  color: #e74c3c;
  font-weight: bold;
}

.retry-button,
.back-button,
.action-button {
  background-color: #3498db;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  font-size: 1em;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  margin-top: 20px;
  text-decoration: none; /* a 태그 스타일 제거 */
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.retry-button:hover,
.back-button:hover,
.action-button:hover {
  background-color: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

/* 메인 콘텐츠 래퍼 */
.content-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

/* 상세 카드 기본 스타일 (Glassmorphism 적용) */
.detail-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 35px;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.detail-card .card-section {
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.detail-card .card-section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-section h2 {
  font-size: 2.2em;
  color: #2c3e50;
  margin: 0;
}

.status-badge {
  padding: 8px 15px;
  border-radius: 25px;
  font-size: 0.9em;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
}

.status-badge.active {
  background-color: #2ecc71;
}
.status-badge.completed {
  background-color: #3498db;
}
.status-badge.pending {
  background-color: #f39c12;
}
.status-badge.cancelled {
  background-color: #e74c3c;
}

.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  text-align: center;
}

.summary-item .label {
  display: block;
  font-size: 0.9em;
  color: #777;
  margin-bottom: 8px;
  font-weight: 500;
}

.summary-item .value {
  font-size: 1.6em;
  font-weight: bold;
  color: #2c3e50;
}

.summary-item .value.positive {
  color: #2ecc71;
}
.summary-item .value.negative {
  color: #e74c3c;
}

.info-section h3,
.payout-section h3 {
  font-size: 1.5em;
  color: #2c7c51;
  margin-bottom: 20px;
  border-left: 4px solid #2c7c51;
  padding-left: 10px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px 25px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-item .info-label {
  font-size: 0.9em;
  color: #777;
  margin-bottom: 5px;
}

.info-item .info-value,
.info-item .info-value-block {
  font-size: 1.05em;
  color: #2c3e50;
  font-weight: bold;
}

.info-item .info-value-block {
  margin-top: 10px;
  background-color: #f8f8f8;
  padding: 15px;
  border-radius: 10px;
  line-height: 1.8;
  font-weight: normal;
  white-space: pre-wrap; /* 줄바꿈 유지 */
}

.progress-bar-container {
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  height: 10px;
  margin-top: 10px;
}

.progress-bar {
  height: 100%;
  background-color: #3498db;
  border-radius: 10px;
  transition: width 0.5s ease-in-out;
}

.payout-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.payout-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.05);
  font-size: 1em;
  color: #555;
}

.payout-item:last-child {
  border-bottom: none;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  margin-top: 10px;
}

/* 버튼 재사용 */
.back-button {
  background-color: #6c757d;
}
.back-button:hover {
  background-color: #5a6268;
}
.action-button {
  background-color: #28a745; /* 예시 버튼 색상 */
}
.action-button:hover {
  background-color: #218838;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2.2em;
  }
  .detail-card {
    padding: 25px;
    margin: 0 10px;
  }
  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .header-section h2 {
    font-size: 1.8em;
  }
  .summary-section,
  .info-grid {
    grid-template-columns: 1fr;
  }
  .card-footer {
    flex-direction: column;
    gap: 15px;
  }
  .back-button,
  .action-button {
    width: 100%;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .investment-detail-page {
    padding: 20px 10px;
  }
  .page-header h1 {
    font-size: 1.8em;
  }
  .detail-card {
    padding: 20px;
  }
  .header-section h2 {
    font-size: 1.5em;
  }
  .summary-item .value {
    font-size: 1.4em;
  }
  .info-section h3,
  .payout-section h3 {
    font-size: 1.3em;
  }
}
</style>

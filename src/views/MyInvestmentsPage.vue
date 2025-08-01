<template>
  <div class="my-investments-page">
    <header class="page-header">
      <h1>💰 내 투자 현황</h1>
      <p class="description">
        솔트메이트와 함께하는 당신의 소금 투자 여정을 한눈에 확인하세요.
      </p>
    </header>

    <main class="content-wrapper">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>투자 정보를 불러오는 중입니다...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p class="error-message">
          😔 투자 정보를 불러오는 데 실패했습니다: {{ error }}
        </p>
        <button @click="fetchInvestments" class="retry-button">
          다시 시도
        </button>
      </div>

      <div v-else-if="investments.length === 0" class="no-investments-state">
        <p>
          아직 참여한 투자 상품이 없습니다. 지금 바로 새로운 기회를 찾아보세요!
        </p>
        <router-link to="/shop" class="explore-button"
          >새로운 투자 상품 탐색하기</router-link
        >
      </div>

      <div v-else class="investments-display">
        <section class="investment-summary card glassmorphism">
          <h2>📊 나의 총 투자 요약</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="label">총 투자 금액</span>
              <span class="value">{{ totalInvested.toLocaleString() }} 원</span>
            </div>
            <div class="summary-item">
              <span class="label">현재 가치</span>
              <span class="value"
                >{{ totalCurrentValue.toLocaleString() }} 원</span
              >
            </div>
            <div class="summary-item">
              <span class="label">총 수익률</span>
              <span :class="['value', overallReturnRateClass]"
                >{{ overallReturnRate.toFixed(2) }} %</span
              >
            </div>
            <div class="summary-item">
              <span class="label">총 예상 수익</span>
              <span class="value"
                >{{ totalExpectedProfit.toLocaleString() }} 원</span
              >
            </div>
          </div>
        </section>

        <section class="investment-list">
          <h2>✨ 나의 투자 상품</h2>
          <div class="investment-cards">
            <div
              v-for="investment in investments"
              :key="investment.id"
              class="investment-card card glassmorphism"
            >
              <div class="card-header">
                <h3 class="product-name">{{ investment.productName }}</h3>
                <span :class="['status-badge', investment.status]">{{
                  getStatusText(investment.status)
                }}</span>
              </div>
              <div class="card-body">
                <div class="info-row">
                  <span class="info-label">투자 금액</span>
                  <span class="info-value"
                    >{{ investment.investedAmount.toLocaleString() }} 원</span
                  >
                </div>
                <div class="info-row">
                  <span class="info-label">현재 가치</span>
                  <span class="info-value"
                    >{{ investment.currentValue.toLocaleString() }} 원</span
                  >
                </div>
                <div class="info-row">
                  <span class="info-label">수익률</span>
                  <span
                    :class="[
                      'info-value',
                      getReturnRateClass(investment.returnRate),
                    ]"
                  >
                    {{ investment.returnRate.toFixed(2) }} %
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">투자일</span>
                  <span class="info-value">{{
                    formatDate(investment.investmentDate)
                  }}</span>
                </div>
                <div class="info-row" v-if="investment.expectedReturnDate">
                  <span class="info-label">예상 회수일</span>
                  <span class="info-value">{{
                    formatDate(investment.expectedReturnDate)
                  }}</span>
                </div>

                <div
                  class="progress-section"
                  v-if="investment.progress !== undefined"
                >
                  <span class="info-label"
                    >진행도 ({{ investment.progress }}%)</span
                  >
                  <div class="progress-bar-container">
                    <div
                      class="progress-bar"
                      :style="{ width: investment.progress + '%' }"
                    ></div>
                  </div>
                </div>

                <div
                  class="payout-info"
                  v-if="
                    investment.payoutHistory &&
                    investment.payoutHistory.length > 0
                  "
                >
                  <span class="info-label"
                    >최근 배당:
                    {{
                      investment.payoutHistory[
                        investment.payoutHistory.length - 1
                      ].amount.toLocaleString()
                    }}원</span
                  >
                  <span class="info-value"
                    >({{
                      formatDate(
                        investment.payoutHistory[
                          investment.payoutHistory.length - 1
                        ].date,
                      )
                    }})</span
                  >
                </div>
              </div>
              <div class="card-footer">
                <router-link
                  :to="`/investment-detail/${investment.id}`"
                  class="detail-button"
                >
                  상세 보기 <i class="fas fa-chevron-right"></i>
                </router-link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router"; // useRouter가 필요하다면
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";

export default {
  name: "MyInvestmentsPage",
  setup() {
    const router = useRouter(); // 라우터 필요시
    const investments = ref([]);
    const loading = ref(true);
    const error = ref(null);

    // 가상 데이터 (Firestore에서 불러올 데이터 구조를 미리 정의)
    // 실제 Firestore 데이터와 일치시켜야 합니다.
    const getDummyInvestments = (userId) => {
      // 실제 앱에서는 userId에 따라 Firestore에서 데이터를 가져옵니다.
      // 여기서는 예시를 위해 더미 데이터를 반환합니다.
      return [
        {
          id: "inv001",
          userId: userId,
          productName: "솔트팜 1호 생산 투자",
          investedAmount: 1000000, // 원
          currentValue: 1050000, // 원 (5% 수익)
          returnRate: 5.0, // %
          status: "active", // active, completed, pending, cancelled
          investmentDate: new Date("2024-01-15"),
          expectedReturnDate: new Date("2025-01-15"),
          progress: 75, // 백분율
          payoutHistory: [
            { amount: 10000, date: new Date("2024-04-15") },
            { amount: 10000, date: new Date("2024-07-15") },
          ],
        },
        {
          id: "inv002",
          userId: userId,
          productName: "솔트웨어하우스 확장 펀드",
          investedAmount: 2500000,
          currentValue: 2450000, // 원 (-2% 손실)
          returnRate: -2.0,
          status: "active",
          investmentDate: new Date("2024-03-01"),
          expectedReturnDate: new Date("2026-03-01"),
          progress: 50,
          payoutHistory: [],
        },
        {
          id: "inv003",
          userId: userId,
          productName: "염전 현대화 프로젝트",
          investedAmount: 500000,
          currentValue: 580000, // 원 (16% 수익)
          returnRate: 16.0,
          status: "completed",
          investmentDate: new Date("2023-05-10"),
          expectedReturnDate: new Date("2024-05-10"),
          payoutHistory: [
            { amount: 20000, date: new Date("2023-08-10") },
            { amount: 20000, date: new Date("2023-11-10") },
            { amount: 20000, date: new Date("2024-02-10") },
            { amount: 520000, date: new Date("2024-05-10") }, // 원금 회수 포함
          ],
        },
        {
          id: "inv004",
          userId: userId,
          productName: "친환경 소금 생산 설비",
          investedAmount: 1500000,
          currentValue: 1500000,
          returnRate: 0.0,
          status: "pending", // 아직 활성화 대기 중
          investmentDate: new Date("2025-01-01"),
          expectedReturnDate: null,
          progress: 0,
          payoutHistory: [],
        },
      ];
    };

    const fetchInvestments = async () => {
      loading.value = true;
      error.value = null;
      try {
        const user = await new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (u) => {
            unsubscribe();
            resolve(u);
          });
        });

        if (!user) {
          router.push("/login"); // 로그인되지 않았다면 로그인 페이지로 리다이렉트
          return;
        }

        // 실제 Firestore에서 데이터 가져오기 (더미 데이터 대신 사용)
        const investmentsCollectionRef = collection(db, "investments");
        const q = query(
          investmentsCollectionRef,
          where("investorUID", "==", user.uid), // 'userId' 대신 'investorUID'로 변경
        );
        const querySnapshot = await getDocs(q);

        const fetchedData = [];
        querySnapshot.forEach((doc) => {
          fetchedData.push({ id: doc.id, ...doc.data() });
        });
        investments.value = fetchedData;

        // 만약 Firestore에 데이터가 없거나 테스트를 위해 더미 데이터를 사용하려면 아래 줄 활성화
        if (fetchedData.length === 0) {
          investments.value = getDummyInvestments(user.uid);
        }
      } catch (err) {
        console.error("투자 정보를 불러오는 데 실패했습니다:", err);
        error.value = err.message || "알 수 없는 오류가 발생했습니다.";
      } finally {
        loading.value = false;
      }
    };

    // 총 투자 금액 계산
    const totalInvested = computed(() => {
      return investments.value.reduce(
        (sum, inv) => sum + inv.investedAmount,
        0,
      );
    });

    // 총 현재 가치 계산
    const totalCurrentValue = computed(() => {
      return investments.value.reduce((sum, inv) => sum + inv.currentValue, 0);
    });

    // 총 수익률 계산
    const overallReturnRate = computed(() => {
      if (totalInvested.value === 0) return 0;
      return (
        ((totalCurrentValue.value - totalInvested.value) /
          totalInvested.value) *
        100
      );
    });

    // 총 예상 수익 (현재 가치 - 투자 금액)
    const totalExpectedProfit = computed(() => {
      return totalCurrentValue.value - totalInvested.value;
    });

    // 총 수익률에 따른 클래스 (색상 변경)
    const overallReturnRateClass = computed(() => {
      if (overallReturnRate.value > 0) return "positive";
      if (overallReturnRate.value < 0) return "negative";
      return "";
    });

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
      fetchInvestments();
    });

    return {
      investments,
      loading,
      error,
      totalInvested,
      totalCurrentValue,
      overallReturnRate,
      overallReturnRateClass,
      totalExpectedProfit,
      getStatusText,
      getReturnRateClass,
      formatDate,
      fetchInvestments, // retry 버튼을 위해 노출
    };
  },
};
</script>

<style scoped>
/* 전반적인 페이지 레이아웃 및 배경 */
.my-investments-page {
  padding: 40px 20px;
  background: linear-gradient(
    135deg,
    #e0f2f7 0%,
    #d1e8ed 100%
  ); /* 부드러운 그라데이션 배경 */
  min-height: 100vh;
  font-family: "Pretendard", sans-serif; /* 모던한 폰트 사용 */
  color: #333;
}

.page-header {
  text-align: center;
  margin-bottom: 50px;
}

.page-header h1 {
  font-size: 3em;
  color: #2c7c51; /* 솔트메이트 테마 색상 */
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.page-header .description {
  font-size: 1.1em;
  color: #555;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.5;
}

/* 로딩, 오류, 데이터 없음 상태 */
.loading-state,
.error-state,
.no-investments-state {
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
.no-investments-state p {
  font-size: 1.2em;
  color: #555;
}

.error-message {
  color: #e74c3c;
  font-weight: bold;
}

.retry-button,
.explore-button {
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
  display: inline-block;
}

.retry-button:hover,
.explore-button:hover {
  background-color: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

/* 메인 콘텐츠 래퍼 */
.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* 카드 기본 스타일 (Glassmorphism 적용) */
.card {
  background: rgba(255, 255, 255, 0.8); /* 반투명 배경 */
  border-radius: 20px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px); /* 블러 효과 */
  -webkit-backdrop-filter: blur(10px); /* Safari 지원 */
  border: 1px solid rgba(255, 255, 255, 0.3); /* 은은한 테두리 */
  padding: 30px;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

/* 투자 요약 섹션 */
.investment-summary {
  margin-bottom: 30px;
}

.investment-summary h2 {
  font-size: 2em;
  color: #2c7c51;
  margin-bottom: 30px;
  text-align: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 25px;
}

.summary-item {
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 25px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.5);
  transition: background-color 0.3s ease;
}

.summary-item:hover {
  background-color: rgba(245, 245, 245, 0.95);
}

.summary-item .label {
  display: block;
  font-size: 0.9em;
  color: #777;
  margin-bottom: 10px;
  font-weight: 500;
}

.summary-item .value {
  font-size: 1.8em;
  font-weight: bold;
  color: #2c3e50;
}

.summary-item .value.positive {
  color: #2ecc71; /* 긍정적인 수익률 */
}

.summary-item .value.negative {
  color: #e74c3c; /* 부정적인 수익률 */
}

/* 개별 투자 상품 목록 */
.investment-list h2 {
  font-size: 2em;
  color: #2c7c51;
  margin-bottom: 30px;
  text-align: center;
}

.investment-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 25px;
}

.investment-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.investment-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.investment-card .product-name {
  font-size: 1.5em;
  color: #2c3e50;
  margin: 0;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: bold;
  color: white;
  text-transform: uppercase;
}

.status-badge.active {
  background-color: #2ecc71; /* 진행 중 */
}
.status-badge.completed {
  background-color: #3498db; /* 완료됨 */
}
.status-badge.pending {
  background-color: #f39c12; /* 승인 대기 중 */
}
.status-badge.cancelled {
  background-color: #e74c3c; /* 취소됨 */
}

.investment-card .card-body {
  flex-grow: 1;
  margin-bottom: 25px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.05);
}

.info-row:last-of-type {
  border-bottom: none;
}

.info-label {
  font-size: 0.95em;
  color: #777;
  font-weight: 500;
}

.info-value {
  font-size: 1em;
  color: #2c3e50;
  font-weight: bold;
}

.info-value.positive {
  color: #2ecc71;
}

.info-value.negative {
  color: #e74c3c;
}

.progress-section {
  margin-top: 20px;
  margin-bottom: 15px;
}

.progress-bar-container {
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  height: 8px;
  margin-top: 10px;
}

.progress-bar {
  height: 100%;
  background-color: #3498db;
  border-radius: 10px;
  transition: width 0.5s ease-in-out;
}

.payout-info {
  margin-top: 15px;
  background-color: #eaf7ed;
  padding: 10px 15px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
  color: #2c7c51;
}

.investment-card .card-footer {
  text-align: right;
  padding-top: 15px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.detail-button {
  background-color: #4caf50; /* Green */
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.95em;
  text-decoration: none;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.detail-button:hover {
  background-color: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.detail-button i {
  font-size: 0.8em;
}

/* 반응형 디자인 */
@media (max-width: 992px) {
  .summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
  .investment-cards {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2.5em;
  }
  .page-header .description {
    font-size: 1em;
  }
  .summary-grid {
    grid-template-columns: 1fr; /* 모바일에서는 한 줄에 하나씩 */
  }
  .investment-cards {
    grid-template-columns: 1fr;
  }
  .card {
    padding: 25px;
    margin: 0 10px;
  }
}

@media (max-width: 480px) {
  .my-investments-page {
    padding: 20px 10px;
  }
  .page-header h1 {
    font-size: 2em;
  }
  .investment-summary h2,
  .investment-list h2 {
    font-size: 1.8em;
  }
  .summary-item .value {
    font-size: 1.5em;
  }
  .investment-card .product-name {
    font-size: 1.3em;
  }
}
</style>

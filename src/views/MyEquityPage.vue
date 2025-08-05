<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-chart-pie"></i> 나의 지분 정보</h1>
      <p class="description">나의 공장 지분 현황과 관련 정보를 확인합니다.</p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>지분 정보를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else>
        <section class="summary-section">
          <div class="summary-card">
            <label>나의 총 지분율</label>
            <span>{{ (equityData.totalPercentage || 0).toFixed(4) }} %</span>
          </div>
          <div class="summary-card">
            <label>총 투자 원금</label>
            <span
              >{{ (equityData.totalInvestment || 0).toLocaleString() }} 원</span
            >
          </div>
          <div class="summary-card">
            <label>예상 누적 배당금</label>
            <span
              >{{
                (equityData.estimatedDividends || 0).toLocaleString()
              }}
              원</span
            >
          </div>
        </section>

        <section class="history-section">
          <h2>지분 변동 내역</h2>
          <div v-if="equityHistory.length === 0" class="empty-state">
            <p>지분 변동 내역이 없습니다.</p>
          </div>
          <div v-else class="table-container">
            <table class="history-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>내용</th>
                  <th>변동 지분율</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in equityHistory" :key="item.id">
                  <td>{{ formatDate(item.date) }}</td>
                  <td>{{ item.reason }}</td>
                  <td
                    :class="[
                      'amount',
                      item.change > 0 ? 'positive' : 'negative',
                    ]"
                  >
                    {{ item.change > 0 ? "+" : ""
                    }}{{ item.change.toFixed(4) }} %
                  </td>
                </tr>
              </tbody>
            </table>
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
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";

export default {
  name: "MyEquityPage",
  data() {
    return {
      equityData: {},
      equityHistory: [],
      isLoading: true,
      error: null,
    };
  },
  async created() {
    await this.fetchEquityData();
  },
  methods: {
    async fetchEquityData() {
      this.isLoading = true;
      this.error = null;
      if (!auth.currentUser) {
        this.error = "로그인이 필요합니다.";
        this.isLoading = false;
        return;
      }

      try {
        const userId = auth.currentUser.uid;

        // 1. 'equity' 컬렉션에서 사용자 지분 요약 정보 조회
        const equityRef = doc(db, "equity", userId);
        const equitySnap = await getDoc(equityRef);
        if (equitySnap.exists()) {
          this.equityData = equitySnap.data();
        }

        // 2. 'equity_history' 컬렉션에서 사용자 지분 변동 내역 조회
        const historyQuery = query(
          collection(db, "equity_history"),
          where("userId", "==", userId),
          orderBy("date", "desc"),
        );
        const historySnapshot = await getDocs(historyQuery);
        this.equityHistory = historySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error("지분 정보 조회 오류:", e);
        this.error = "지분 정보를 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    formatDate(timestamp) {
      if (!timestamp?.toDate) return "";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    },
  },
};
</script>

<style scoped>
/* 이전 페이지와 유사한 스타일 */
.page-container {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px;
}
.page-header h1 i {
  color: #fd7e14;
}
.content-wrapper {
  padding: 30px;
}

.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}
.summary-card {
  background-color: #f8f9fa;
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #e9ecef;
}
.summary-card label {
  display: block;
  color: #666;
  font-size: 1em;
  margin-bottom: 10px;
}
.summary-card span {
  font-size: 2em;
  font-weight: bold;
  color: #333;
}

.history-section h2 {
  /* 이전과 동일 */
}
.history-table {
  width: 100%;
  border-collapse: collapse;
}
.history-table th,
.history-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}
.history-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
}
.amount {
  font-weight: bold;
  text-align: right;
}
.amount.positive {
  color: #28a745;
}
.amount.negative {
  color: #dc3545;
}
</style>

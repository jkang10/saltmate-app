<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-chart-pie"></i> 나의 지분 정보</h1>
      <p class="description">나의 공장 지분 현황과 관련 정보를 확인합니다.</p>
    </header>

    <main class="content-wrapper card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>지분 정보를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else>
        <section class="summary-section">
          <div class="summary-card main">
            <i class="card-icon fas fa-globe-asia"></i>
            <div class="card-content">
              <label>나의 총 지분율</label>
              <span>{{ (equityData.totalPercentage || 0).toFixed(4) }} %</span>
            </div>
          </div>
          <div class="summary-card sub">
            <label>영암공장</label>
            <span
              >{{ (equityData.types?.["영암공장"] || 0).toFixed(4) }} %</span
            >
          </div>
          <div class="summary-card sub">
            <label>양양공장</label>
            <span
              >{{ (equityData.types?.["양양공장"] || 0).toFixed(4) }} %</span
            >
          </div>
          <div class="summary-card sub">
            <label>글로벌 생산공장</label>
            <span
              >{{
                (equityData.types?.["글로벌 생산공장"] || 0).toFixed(4)
              }}
              %</span
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

        const equityRef = doc(db, "equity", userId);
        const equitySnap = await getDoc(equityRef);
        if (equitySnap.exists()) {
          this.equityData = equitySnap.data();
        }

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
.page-container {
  padding: 20px;
  max-width: 1000px;
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
  color: #fd7e14;
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
.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 50px;
}
.summary-card {
  background: white;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  text-align: center;
}
.summary-card.main {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 20px;
  text-align: left;
  background-color: #f0f3ff;
}
.card-icon {
  font-size: 2.5em;
  color: #fd7e14;
}
.card-content label {
  color: #666;
  font-size: 1.1em;
  margin-bottom: 8px;
  font-weight: 500;
}
.card-content span {
  font-size: 2.2em;
  font-weight: bold;
  color: #333;
}
.summary-card.sub label {
  font-size: 1em;
}
.summary-card.sub span {
  font-size: 1.5em;
}
.history-section h2 {
  font-size: 1.8em;
  color: #333;
  margin-bottom: 25px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 15px;
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

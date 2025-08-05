<template>
  <div class="my-tokens-page">
    <header class="page-header">
      <h1><i class="fas fa-coins"></i> 나의 토큰 관리</h1>
      <p class="description">
        보유하신 COBS 및 BND 토큰의 상세 내역을 확인하고 관리합니다.
      </p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>토큰 정보를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else>
        <section class="balance-section">
          <div class="token-balance-card cobs">
            <div class="token-icon">
              <img src="@/assets/COBS.png" alt="COBS Token" />
            </div>
            <div class="token-info">
              <label>COBS (생태계 토큰)</label>
              <span class="balance"
                >{{
                  (userProfile.tokens?.cobs || 0).toLocaleString()
                }}
                COBS</span
              >
            </div>
          </div>
          <div class="token-balance-card bnd">
            <div class="token-icon">
              <img src="@/assets/BND_LOGO.png" alt="BND Token" />
            </div>
            <div class="token-info">
              <label>BND (밈 토큰)</label>
              <span class="balance"
                >{{ (userProfile.tokens?.bnd || 0).toLocaleString() }} BND</span
              >
            </div>
          </div>
        </section>

        <section class="history-section">
          <h2>토큰 변동 내역</h2>
          <div v-if="sortedTransactions.length === 0" class="empty-state">
            <p>토큰 변동 내역이 없습니다.</p>
          </div>
          <div v-else class="table-container">
            <table class="transaction-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>내용</th>
                  <th>토큰 종류</th>
                  <th>수량</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tx in sortedTransactions" :key="tx.id">
                  <td>{{ formatDate(tx.timestamp) }}</td>
                  <td>{{ tx.description }}</td>
                  <td>
                    <span :class="['token-badge', tx.balanceType]">{{
                      tx.balanceType
                    }}</span>
                  </td>
                  <td
                    :class="['amount', tx.amount > 0 ? 'positive' : 'negative']"
                  >
                    {{ formatAmount(tx.amount) }} {{ tx.balanceType }}
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
  orderBy,
  getDocs,
} from "firebase/firestore";

export default {
  name: "MyTokensPage",
  data() {
    return {
      userProfile: null,
      transactions: [],
      isLoading: true,
      error: null,
    };
  },
  computed: {
    sortedTransactions() {
      return [...this.transactions].sort(
        (a, b) => b.timestamp.toDate() - a.timestamp.toDate(),
      );
    },
  },
  async created() {
    await this.fetchTokenData();
  },
  methods: {
    async fetchTokenData() {
      this.isLoading = true;
      this.error = null;

      if (!auth.currentUser) {
        this.error = "로그인이 필요합니다.";
        this.isLoading = false;
        return;
      }

      try {
        const userId = auth.currentUser.uid;

        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          this.userProfile = userSnap.data();
        } else {
          throw new Error("사용자 정보를 찾을 수 없습니다.");
        }

        const q = query(
          collection(db, "transactions"),
          where("userId", "==", userId),
          where("balanceType", "in", ["COBS", "BND"]),
          orderBy("timestamp", "desc"),
        );

        const querySnapshot = await getDocs(q);
        this.transactions = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error("토큰 데이터 조회 오류:", e);
        this.error = "토큰 정보를 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    formatDate(timestamp) {
      if (!timestamp || !timestamp.toDate) return "";
      return timestamp.toDate().toLocaleString("ko-KR");
    },
    formatAmount(amount) {
      const sign = amount > 0 ? "+" : "";
      return `${sign}${amount.toLocaleString()}`;
    },
  },
};
</script>

<style scoped>
.my-tokens-page {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px auto;
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.page-header {
  text-align: center;
  margin-bottom: 20px;
}
.page-header h1 {
  font-size: 2.8em;
  color: #333;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}
.page-header h1 i {
  color: #f39c12;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  padding: 30px;
}
.card.glassmorphism {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.balance-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}
.token-balance-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  color: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}
.token-balance-card.cobs {
  background: linear-gradient(135deg, #007bff, #0056b3);
}
.token-balance-card.bnd {
  background: linear-gradient(135deg, #6f42c1, #483d8b);
}
.token-icon img {
  width: 50px;
  height: 50px;
  margin-right: 20px;
}
.token-info label {
  display: block;
  font-size: 1em;
  opacity: 0.9;
}
.token-info .balance {
  font-size: 2em;
  font-weight: bold;
}
.history-section h2 {
  font-size: 1.8em;
  color: #333;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
}
.table-container {
  max-height: 500px;
  overflow-y: auto;
}
.transaction-table {
  width: 100%;
  border-collapse: collapse;
}
.transaction-table th,
.transaction-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}
.transaction-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
}
.token-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  color: white;
  font-size: 0.85em;
}
.token-badge.COBS {
  background-color: #007bff;
}
.token-badge.BND {
  background-color: #6f42c1;
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
  background-color: #6c757d;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  text-decoration: none;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 30px;
}
.back-button:hover {
  background-color: #5a6268;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>

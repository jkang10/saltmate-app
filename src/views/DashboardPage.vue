<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h2>환영합니다, {{ userProfile?.name || "솔트메이트" }}님!</h2>
    </header>

    <main class="dashboard-content">
      <section class="performance-card card">
        <div class="card-header">
          <h3><i class="fas fa-crown"></i> 나의 등급 및 수익 현황</h3>
          <span :class="['tier-badge', userProfile?.tier?.toLowerCase()]">{{
            userProfile?.tier || "Loding.."
          }}</span>
        </div>

        <div class="investment-info">
          <span>나의 투자 원금</span>
          <strong
            >{{
              (userProfile?.investmentAmount || 0).toLocaleString()
            }}
            원</strong
          >
        </div>
        <div class="performance-body">
          <h4>수익 사이클 (300%)</h4>
          <div class="progress-bar-container">
            <div
              class="progress-bar-fill"
              :style="{ width: cycleProgress + '%' }"
            ></div>
          </div>
          <div class="progress-labels">
            <span class="current-earnings"
              >{{
                (userProfile?.currentCycleEarnings || 0).toLocaleString()
              }}
              원</span
            >
            <span class="cycle-cap"
              >달성 목표:
              {{ (userProfile?.cycleCap || 0).toLocaleString() }} 원</span
            >
          </div>
        </div>
        <div class="balances">
          <div class="balance-item cash">
            <label><i class="fas fa-wallet"></i> 현금성 수익</label>
            <span>{{ (userProfile?.cashBalance || 0).toLocaleString() }}</span>
            <small>원</small>
          </div>
          <div class="balance-item saltmate">
            <label><i class="fas fa-gifts"></i> 솔트메이트</label>
            <span>{{
              (userProfile?.saltmatePoints || 0).toLocaleString()
            }}</span>
            <small>P</small>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
// ... script 내용은 이전과 동일 ...
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default {
  name: "DashboardPage",
  data() {
    return {
      userProfile: null,
      loadingUser: true,
      error: null,
    };
  },
  computed: {
    cycleProgress() {
      if (
        !this.userProfile ||
        !this.userProfile.cycleCap ||
        this.userProfile.cycleCap === 0
      ) {
        return 0;
      }
      const progress =
        (this.userProfile.currentCycleEarnings / this.userProfile.cycleCap) *
        100;
      return Math.min(progress, 100); // 100%를 넘지 않도록
    },
  },
  async created() {
    await this.fetchUserProfile();
  },
  methods: {
    async fetchUserProfile() {
      this.loadingUser = true;
      try {
        const user = await new Promise((resolve, reject) => {
          const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
              unsubscribe();
              resolve(user);
            },
            reject,
          );
        });

        if (user) {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            this.userProfile = {
              ...data,
              tier: data.tier || "BRONZE",
              investmentAmount: data.investmentAmount || 0, // investmentAmount 필드 추가
              cycleCap: data.cycleCap || 0,
              currentCycleEarnings: data.currentCycleEarnings || 0,
              cashBalance: data.cashBalance || 0,
              saltmatePoints: data.saltmatePoints || 0,
              cobsBalance: data.cobsBalance || 0,
              bndBalance: data.bndBalance || 0,
            };
          } else {
            this.error = "사용자 프로필을 찾을 수 없습니다.";
          }
        }
      } catch (e) {
        console.error("사용자 프로필 가져오기 실패:", e);
        this.error = "프로필 로딩에 실패했습니다.";
      } finally {
        this.loadingUser = false;
      }
    },
  },
};
</script>

<style scoped>
.investment-info {
  text-align: center;
  margin-bottom: 20px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}
.investment-info span {
  opacity: 0.8;
  margin-right: 10px;
}
.investment-info strong {
  font-size: 1.2em;
  font-weight: bold;
}
.dashboard-container {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px auto;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.dashboard-header {
  text-align: center;
}

.dashboard-header h2 {
  font-size: 2.2em;
  color: #333;
}

.card {
  background: white;
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
}

/* [신설] 수익 현황판 스타일 */
.performance-card {
  background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
  color: white;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  padding-bottom: 15px;
  margin-bottom: 20px;
}

.card-header h3 {
  font-size: 1.5em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tier-badge {
  font-size: 1em;
  font-weight: bold;
  padding: 6px 15px;
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
}
.tier-badge.vip {
  background-color: #ffd700;
  color: #333;
}
.tier-badge.vvip {
  background-color: #c0c0c0;
  color: #333;
}
.tier-badge.infinite {
  background: linear-gradient(45deg, #f3ec78, #af4261);
  color: white;
}

.performance-body h4 {
  font-size: 1.1em;
  margin-bottom: 10px;
  font-weight: 500;
}

.progress-bar-container {
  width: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  height: 20px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #17a2b8 0%, #28a745 100%);
  border-radius: 10px;
  transition: width 0.5s ease-in-out;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 0.9em;
  opacity: 0.9;
}

.balances {
  margin-top: 25px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  text-align: center;
}

.balance-item {
  background: rgba(0, 0, 0, 0.15);
  padding: 20px;
  border-radius: 10px;
}

.balance-item label {
  display: block;
  font-size: 1em;
  margin-bottom: 8px;
  opacity: 0.8;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.balance-item span {
  font-size: 2em;
  font-weight: bold;
  line-height: 1;
}

.balance-item small {
  font-size: 1em;
  margin-left: 5px;
}

.tokens-section h2,
.quick-access-section h2 {
  font-size: 1.5em;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.token-display {
  display: flex;
  gap: 20px;
  justify-content: space-around;
}

.token-item {
  display: flex;
  align-items: center;
  gap: 15px;
}
.token-logo {
  width: 40px;
  height: 40px;
}
.token-details {
  text-align: left;
}
.token-name {
  font-size: 1em;
  color: #666;
}
.token-balance {
  font-size: 1.4em;
  font-weight: bold;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 15px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  color: white;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.action-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}
.action-button i {
  font-size: 1.2em;
}

.action-button.primary {
  background-color: #007bff;
}
.action-button.secondary {
  background-color: #6c757d;
}
.action-button.info {
  background-color: #17a2b8;
}
.action-button.success {
  background-color: #28a745;
}
</style>

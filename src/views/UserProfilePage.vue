<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-user-circle"></i> 나의 프로필</h1>
      <p class="description">계정 정보를 확인하고 설정을 변경할 수 있습니다.</p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>프로필 정보를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else class="profile-layout">
        <section class="profile-info-section">
          <div class="profile-header">
            <div class="profile-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="profile-name">
              <h2>{{ userProfile.name }}</h2>
              <p>{{ userProfile.email }}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <label>가입일</label>
              <span>{{ formatDate(userProfile.createdAt) }}</span>
            </div>
            <div class="info-item">
              <label>소속 센터</label>
              <span>{{ userProfile.region || "미지정" }}</span>
            </div>
            <div class="info-item">
              <label>연락처</label>
              <span>{{ userProfile.phone || "미등록" }}</span>
            </div>
          </div>
        </section>

        <section class="profile-details-section">
          <div class="detail-card">
            <h3><i class="fas fa-chart-bar"></i> 투자 요약</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <label>현재 등급</label>
                <span>{{ userProfile.tier }}</span>
              </div>
              <div class="summary-item">
                <label>총 구독 원금</label>
                <span
                  >{{
                    (userProfile.investmentAmount || 0).toLocaleString()
                  }}
                  원</span
                >
              </div>
              <div class="summary-item">
                <label>총 추천인 수</label>
                <span>{{ referralCount }} 명</span>
              </div>
            </div>
          </div>

          <div class="detail-card">
            <h3><i class="fas fa-cog"></i> 계정 설정</h3>
            <div class="settings-grid">
              <button class="setting-item" @click="openChangePasswordModal">
                <i class="fas fa-key"></i>
                <span>비밀번호 변경</span>
              </button>
              <button
                class="setting-item"
                @click="openNotificationSettingsModal"
              >
                <i class="fas fa-bell"></i>
                <span>알림 설정</span>
              </button>
            </div>
          </div>
        </section>
      </div>
      <router-link to="/dashboard" class="back-button">
        <i class="fas fa-arrow-left"></i> 대시보드로 돌아가기
      </router-link>
    </main>

    <ChangePasswordModal
      v-if="isPasswordModalVisible"
      @close="isPasswordModalVisible = false"
    />
    <NotificationSettingsModal
      v-if="isNotificationSettingsModalVisible"
      @close="isNotificationSettingsModalVisible = false"
    />
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
} from "firebase/firestore";
import ChangePasswordModal from "@/components/ChangePasswordModal.vue";
import NotificationSettingsModal from "@/components/NotificationSettingsModal.vue";

export default {
  name: "UserProfilePage",
  components: {
    ChangePasswordModal,
    NotificationSettingsModal,
  },
  data() {
    return {
      userProfile: null,
      referralCount: 0,
      isLoading: true,
      error: null,
      isPasswordModalVisible: false,
      isNotificationSettingsModalVisible: false,
    };
  },
  async created() {
    await this.fetchProfileData();
  },
  methods: {
    async fetchProfileData() {
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
          throw new Error("사용자 프로필을 찾을 수 없습니다.");
        }

        const referralsQuery = query(
          collection(db, "users"),
          where("uplineReferrer", "==", userId),
        );
        const referralsSnapshot = await getDocs(referralsQuery);
        this.referralCount = referralsSnapshot.size;
      } catch (e) {
        console.error("프로필 데이터 조회 오류:", e);
        this.error = "프로필 정보를 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    formatDate(timestamp) {
      if (!timestamp?.toDate) return "N/A";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    },
    // [수정됨] alert 대신 모달을 열도록 변경
    openChangePasswordModal() {
      this.isPasswordModalVisible = true;
    },
    openNotificationSettingsModal() {
      this.isNotificationSettingsModalVisible = true;
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
  color: #333;
}
.page-header h1 i {
  color: #007bff;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  padding: 30px;
}
.loading-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.profile-layout {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 30px;
}

/* 왼쪽 프로필 정보 */
.profile-info-section {
  background-color: #fff;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}
.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 20px;
}
.profile-avatar {
  font-size: 3em;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #007bff;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
}
.profile-name h2 {
  margin: 0;
  font-size: 1.8em;
}
.profile-name p {
  margin: 5px 0 0;
  color: #666;
}
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.info-item label {
  color: #555;
  font-weight: 500;
}
.info-item span {
  font-weight: bold;
  color: #333;
}

/* 오른쪽 상세 정보 */
.profile-details-section {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.detail-card {
  background-color: #fff;
  padding: 25px;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
}
.detail-card h3 {
  font-size: 1.4em;
  margin: 0 0 20px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  text-align: center;
}
.summary-item label {
  display: block;
  color: #666;
  margin-bottom: 8px;
}
.summary-item span {
  font-size: 1.5em;
  font-weight: bold;
  color: #007bff;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.setting-item {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1em;
  font-weight: 500;
  color: #333;
}
.setting-item:hover {
  background-color: #e9ecef;
  transform: translateY(-2px);
}
.setting-item i {
  display: block;
  font-size: 1.8em;
  margin-bottom: 10px;
  color: #007bff;
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

@media (max-width: 768px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}
</style>

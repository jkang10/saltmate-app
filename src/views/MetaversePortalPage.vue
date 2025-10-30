<template>
  <div class="portal-container">
    <h1>솔레인 디지털 유토피아</h1>
    <p class="subtitle">곧 펼쳐질 새로운 세계를 미리 만나보세요!</p>

    <div class="portal-content">
      <section class="avatar-preview-section card">
        <h2>내 아바타 미리보기</h2>
        <div v-if="isLoadingAvatar" class="loading-spinner"></div>
        <div v-else-if="avatarUrl" class="avatar-viewer">
          <model-viewer :src="avatarUrl"
                        camera-controls
                        auto-rotate
                        rotation-per-second="20deg"
                        shadow-intensity="1"
                        alt="내 아바타">
          </model-viewer>
          <router-link to="/my-avatar" class="edit-avatar-link">
            아바타 수정하기 <i class="fas fa-edit"></i>
          </router-link>
        </div>
        <div v-else class="no-avatar">
          <p>아직 생성된 아바타가 없습니다.</p>
          <router-link to="/my-avatar" class="btn-create-avatar">
            아바타 만들러 가기
          </router-link>
        </div>
      </section>

      <section class="info-section card">
        <h2>세계관 소개</h2>
        <p>솔레인 디지털 유토피아는 소금과 결정, 그리고 첨단 기술이 어우러진 신비로운 가상 테마파크입니다. 이곳에서 당신은 자신만의 아바타로 다른 '솔트메이트'들과 교류하고, 게임 존에서 획득한 보상을 자랑하며, 제작 공방에서 만든 특별한 아이템을 착용할 수 있습니다.</p>
      </section>

      <section class="features-section card">
        <h2>주요 기능 (예정)</h2>
        <ul>
          <li><i class="fas fa-users"></i> 실시간 소셜 광장: 다른 유저들과 만나 소통하세요!</li>
          <li><i class="fas fa-gift"></i> 연동된 보상: 게임과 제작 공방의 결과물을 아바타로 뽐내세요!</li>
          <li><i class="fas fa-map-marked-alt"></i> 탐험과 발견: 숨겨진 장소와 특별한 이벤트를 찾아보세요!</li>
        </ul>
      </section>

      <section class="announcements-section card">
        <h2>관련 소식</h2>
        <p>현재 준비 중입니다. 곧 새로운 소식을 알려드리겠습니다!</p>
      </section>

      <section class="enter-plaza-section">
        <div class="portal-gate-wrapper">
          <router-link to="/plaza" class="portal-gate-link" title="Plaza 입장하기">
            <div class="portal-icon">
              <i class="fas fa-door-open"></i>
            </div>
            <span class="portal-text">지금 입장하기</span>
            <div class="portal-particles"></div>
          </router-link>
        </div>
        <p class="portal-subtext">
          당신의 아바타와 함께 미니 소셜 광장을 경험해보세요!
        </p>
      </section>
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { auth, db } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import '@google/model-viewer'; // model-viewer 컴포넌트 import

const avatarUrl = ref(null);
const isLoadingAvatar = ref(true);
let unsubscribe = null;

onMounted(() => {
  const user = auth.currentUser;
  if (user) {
    const userRef = doc(db, "users", user.uid);
    unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().avatarUrl) {
        avatarUrl.value = docSnap.data().avatarUrl;
      } else {
        avatarUrl.value = null; // 아바타 URL이 없는 경우
      }
      isLoadingAvatar.value = false;
    }, (error) => {
      console.error("Failed to get user avatar:", error);
      isLoadingAvatar.value = false;
    });
  } else {
    isLoadingAvatar.value = false; // 로그인 안 된 경우
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.portal-container {
  max-width: 1000px;
  margin: 80px auto 20px;
  padding: 20px;
  color: #333;
}
h1 {
  text-align: center;
  font-size: 2.5em;
  margin-bottom: 10px;
  color: #1e3c72; /* 포인트 색상 */
}
.subtitle {
  text-align: center;
  font-size: 1.2em;
  color: #555;
  margin-bottom: 40px;
}
.portal-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 25px;
}
.card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
.card h2 {
  font-size: 1.5em;
  margin-top: 0;
  margin-bottom: 20px;
  color: #2a5298;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 10px;
}
.avatar-preview-section {
  text-align: center;
}
.avatar-viewer {
  width: 100%;
  height: 300px; /* 아바타 뷰어 크기 조절 */
  margin-bottom: 15px;
  border-radius: 10px;
  overflow: hidden; /* 모델 뷰어가 넘치지 않도록 */
  background: #f0f0f0; /* 로딩 중 배경 */
}
model-viewer {
  width: 100%;
  height: 100%;
  --poster-color: transparent;
}
.edit-avatar-link, .btn-create-avatar {
  display: inline-block;
  margin-top: 10px;
  padding: 8px 15px;
  background-color: #3498db;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  font-weight: bold;
  transition: background-color 0.2s;
}
.edit-avatar-link:hover, .btn-create-avatar:hover {
  background-color: #2980b9;
}
.no-avatar p {
  margin-bottom: 15px;
  color: #777;
}
.features-section ul {
  list-style: none;
  padding: 0;
}
.features-section li {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.features-section li i {
  color: #1abc9c; /* 기능 아이콘 색상 */
  width: 20px;
  text-align: center;
}
.loading-spinner { /* 간단한 로딩 스피너 */
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #09f;
  animation: spin 1s ease infinite;
  margin: 50px auto; /* 중앙 정렬 */
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }


/* ▼▼▼ [신규] 신비로운 플라자 입장 버튼 스타일 ▼▼▼ */
.enter-plaza-section {
  grid-column: 1 / -1; /* 그리드 레이아웃에서 가로 전체 너비를 차지 */
  text-align: center;
  margin-top: 20px;
  padding: 40px 20px;
  background: rgba(0, 0, 0, 0.05); /* 다른 카드보다 약간 어둡게 */
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.portal-gate-wrapper {
  display: inline-block;
  position: relative;
}

.portal-gate-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: linear-gradient(145deg, #667eea, #764ba2); /* 신비로운 보라/파랑 */
  color: white;
  text-decoration: none;
  font-size: 1.4em;
  font-weight: bold;
  border: 5px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 25px rgba(118, 75, 162, 0.7), /* 보라색 글로우 */
              inset 0 0 15px rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  animation: portal-pulse 2.5s infinite alternate; /* 부드럽게 반짝이는 효과 */
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.portal-icon {
  font-size: 2.2em;
  margin-bottom: 10px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.4);
}

.portal-text {
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}

.portal-gate-link:hover {
  transform: scale(1.05);
  box-shadow: 0 0 40px rgba(118, 75, 162, 1),
              inset 0 0 20px rgba(255, 255, 255, 0.4);
}

/* 포털 버튼이 부드럽게 빛나는 애니메이션 */
@keyframes portal-pulse {
  from {
    box-shadow: 0 0 20px rgba(118, 75, 162, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.2);
  }
  to {
    box-shadow: 0 0 35px rgba(118, 75, 162, 0.9), inset 0 0 15px rgba(255, 255, 255, 0.4);
  }
}

/* 포털 버튼 내부의 신비로운 파티클 효과 (선택 사항) */
.portal-particles {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  border-radius: 50%;
  background-image: radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.2) 0%, transparent 10%),
                    radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.15) 0%, transparent 8%),
                    radial-gradient(circle at 50% 70%, rgba(255, 255, 255, 0.2) 0%, transparent 12%);
  animation: particles-float 8s linear infinite;
  opacity: 0;
  transition: opacity 0.5s;
  z-index: -1;
}

.portal-gate-link:hover .portal-particles {
  opacity: 1; /* 호버 시 파티클 나타남 */
}

/* 파티클이 천천히 움직이는 애니메이션 */
@keyframes particles-float {
  0% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(5px, 5px) rotate(180deg); }
  100% { transform: translate(0, 0) rotate(360deg); }
}

.portal-subtext {
  margin-top: 25px;
  font-size: 1.1em;
  color: #444;
  font-weight: 500;
}
/* ▲▲▲ [신규] 스타일 끝 ▲▲▲ */
</style>
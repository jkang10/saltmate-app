<template>
  <div class="avatar-showcase-widget premium-glass">
    <div class="widget-header">
      <h3><i class="fas fa-users"></i> 솔레인 아바타 쇼케이스</h3>
      <p>메타버스의 새로운 주민들을 만나보세요</p>
    </div>
    <div v-if="loading" class="loading-spinner"></div>
    
    <div v-else-if="avatars.length > 0" class="showcase-scroll-container">
      <ul class="avatar-list">
        <li v-for="(user, index) in avatars" :key="index" class="avatar-item">
          <div class="avatar-display">
            <img v-if="user.avatar.body" :src="getAvatarPartUrl(user.avatar.body)" alt="Body" class="avatar-part layer-1" />
            <img v-if="user.avatar.outfit" :src="getAvatarPartUrl(user.avatar.outfit)" alt="Outfit" class="avatar-part layer-2" />
            <img v-if="user.avatar.hair" :src="getAvatarPartUrl(user.avatar.hair)" alt="Hair" class="avatar-part layer-3" />
            <img v-if="user.avatar.face" :src="getAvatarPartUrl(user.avatar.face)" alt="Face" class="avatar-part layer-4" />
            </div>
          <span class="player-name">{{ user.userName }}</span>
        </li>
      </ul>
    </div>
    <p v-else class="no-data">아직 생성된 아바타가 없습니다.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebaseConfig";

const avatars = ref([]);
const loading = ref(true);

// 아바타 이미지 파일이 public/avatars/ 폴더에 있다고 가정합니다.
const getAvatarPartUrl = (partFileName) => {
  // 예: partFileName = 'body_male.png'
  return `/avatars/${partFileName}`; //
};

onMounted(async () => {
  try {
    const getAvatars = httpsCallable(functions, "getRecentAvatars");
    const result = await getAvatars();
    avatars.value = result.data.avatars;
  } catch (error) {
    console.error("최근 아바타 로딩 실패:", error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* (TotalGoldRankingWidget과 유사한 프리미엄 테마) */
.premium-glass {
  background: rgba(10, 0, 20, 0.7) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(170, 70, 255, 0.3) !important;
  color: #f0f0f0 !important;
  padding: 20px;
  border-radius: 15px;
}

.widget-header { text-align: left; margin-bottom: 20px; }
.widget-header h3 {
  font-size: 1.8em;
  font-weight: 700;
  color: #FFD700; /* 금색 헤더 */
  display: flex; align-items: center; gap: 12px;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}
.widget-header p { font-size: 0.9em; color: #bdc3c7; margin-top: 5px; }

/* 가로 스크롤 컨테이너 */
.showcase-scroll-container {
  overflow-x: auto;
  padding-bottom: 10px; /* 스크롤바를 위한 여백 */
}
/* 스크롤바 스타일링 (선택사항) */
.showcase-scroll-container::-webkit-scrollbar {
  height: 8px;
}
.showcase-scroll-container::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.2);
  border-radius: 4px;
}
.showcase-scroll-container::-webkit-scrollbar-thumb {
  background: #FFD700;
  border-radius: 4px;
}
.showcase-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #E0A800;
}

.avatar-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  gap: 20px; /* 아바타 간 간격 */
}
.avatar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

/* 아바타 렌더링 영역 */
.avatar-display {
  width: 120px;
  height: 120px;
  position: relative;
  background: rgba(0,0,0,0.2);
  border-radius: 50%;
  border: 2px solid rgba(255, 215, 0, 0.5);
  overflow: hidden;
}
.avatar-part {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* 또는 cover */
}
/* z-index 순서 (숫자가 높을수록 위) */
.layer-1 { z-index: 1; } /* Body */
.layer-2 { z-index: 2; } /* Outfit */
.layer-3 { z-index: 3; } /* Hair */
.layer-4 { z-index: 4; } /* Face/Eyes */

.player-name {
  font-size: 0.9em;
  font-weight: 600;
  color: #ecf0f1;
  background: rgba(0,0,0,0.3);
  padding: 3px 10px;
  border-radius: 10px;
}

.no-data { text-align: center; padding: 20px; color: #94a3b8; }
.loading-spinner {
  margin: 20px auto;
  display: block;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #FFD700;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
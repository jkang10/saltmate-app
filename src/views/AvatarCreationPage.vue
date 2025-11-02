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
            
            <img v-if="user.avatar && user.avatar.renderUrl" 
                 :src="user.avatar.renderUrl" 
                 alt="Avatar" 
                 class="avatar-image-rpm" />
            
            <div v-else class="avatar-fallback">
              <i class="fas fa-user-astronaut"></i>
            </div>

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

// [★삭제★] public/avatars/ 경로를 사용하던 getAvatarPartUrl 함수 삭제

onMounted(async () => {
  try {
    const getAvatars = httpsCallable(functions, "getRecentAvatars");
    const result = await getAvatars();
    // [★수정★] avatar 객체가 없는 경우(예: avatarUpdatedAt만 있음)를 필터링
    avatars.value = result.data.avatars.filter(a => a.avatar); 
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
/* (스크롤바 스타일링 ...) */
.showcase-scroll-container::-webkit-scrollbar { height: 8px; }
.showcase-scroll-container::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
.showcase-scroll-container::-webkit-scrollbar-thumb { background: #FFD700; border-radius: 4px; }
.showcase-scroll-container::-webkit-scrollbar-thumb:hover { background: #E0A800; }

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

/* ▼▼▼ [★핵심 수정★] 아바타 렌더링 영역 스타일 ▼▼▼ */
.avatar-display {
  width: 120px;
  height: 120px;
  position: relative;
  background: rgba(0,0,0,0.2);
  border-radius: 50%;
  border: 2px solid rgba(255, 215, 0, 0.5);
  overflow: hidden;
  /* 폴백 아이콘 중앙 정렬 */
  display: flex;
  justify-content: center;
  align-items: center;
}

/* [★신규★] Ready Player Me 2D 렌더링 이미지 */
.avatar-image-rpm {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 원을 꽉 채우도록 */
}

/* [★신규★] 폴백(Fallback) 아이콘 */
.avatar-fallback {
  font-size: 3rem;
  color: rgba(255, 215, 0, 0.5);
}
/* ▲▲▲ (수정 완료) ▲▲▲ */


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
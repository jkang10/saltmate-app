<template>
  <div class="avatar-page-container">
    <div class="customization-panel">
      <div class="avatar-preview-wrapper">
        <div class="spotlight"></div>
        <div v-if="loading" class="loading-spinner"></div>
        <div velse class="avatar-preview">
          <img :src="getBodyImage" class="avatar-part body" alt="Body" />
          <img :src="getOutfitImage" class="avatar-part outfit" alt="Outfit" />
          <img :src="getHairImage" class="avatar-part hair" alt="Hair" />
          <img :src="getEyesImage" class="avatar-part eyes" alt="Eyes" />
          <img :src="getNoseImage" class="avatar-part nose" alt="Nose" />
          <img :src="getMouthImage" class="avatar-part mouth" alt="Mouth" />
        </div>
      </div>

      <div class="options-panel">
        <div class="tabs">
          <button @click="activeTab = 'body'" :class="{ active: activeTab === 'body' }"><i class="fas fa-male"></i> 체형</button>
          <button @click="activeTab = 'hair'" :class="{ active: activeTab === 'hair' }"><i class="fas fa-hat-wizard"></i> 헤어</button>
          <button @click="activeTab = 'face'" :class="{ active: activeTab === 'face' }"><i class="fas fa-smile"></i> 얼굴</button>
          <button @click="activeTab = 'outfit'" :class="{ active: activeTab === 'outfit' }"><i class="fas fa-tshirt"></i> 의상</button>
        </div>

        <div class="options-grid">
          <template v-if="activeTab === 'body'">
            <div v-for="body in bodyOptions" :key="body.id"
                 class="option-item" :class="{ selected: avatar.body === body.id }" @click="avatar.body = body.id">
              <img :src="body.icon" :alt="body.name" />
              <span>{{ body.name }}</span>
            </div>
          </template>

          <template v-if="activeTab === 'hair'">
            <div v-for="hair in hairOptions" :key="hair.id"
                 class="option-item" :class="{ selected: avatar.hair === hair.id }" @click="avatar.hair = hair.id">
              <img :src="hair.icon" :alt="hair.name" />
              <span>{{ hair.name }}</span>
            </div>
          </template>
          
          <div v-if="activeTab === 'face'" class="face-options">
            <div class="face-category">
              <label>눈</label>
              <div class="option-group">
                <div v-for="eyes in eyesOptions" :key="eyes.id" class="option-item" :class="{ selected: avatar.eyes === eyes.id }" @click="avatar.eyes = eyes.id">
                   <img :src="eyes.icon" :alt="eyes.name" />
                </div>
              </div>
            </div>
            <div class="face-category">
              <label>코</label>
              <div class="option-group">
                <div v-for="nose in noseOptions" :key="nose.id" class="option-item" :class="{ selected: avatar.nose === nose.id }" @click="avatar.nose = nose.id">
                  <img :src="nose.icon" :alt="nose.name" />
                </div>
              </div>
            </div>
            <div class="face-category">
              <label>입</label>
              <div class="option-group">
                <div v-for="mouth in mouthOptions" :key="mouth.id" class="option-item" :class="{ selected: avatar.mouth === mouth.id }" @click="avatar.mouth = mouth.id">
                   <img :src="mouth.icon" :alt="mouth.name" />
                </div>
              </div>
            </div>
          </div>

          <template v-if="activeTab === 'outfit'">
            <div v-for="outfit in outfitOptions" :key="outfit.id"
                 class="option-item" :class="{ selected: avatar.outfit === outfit.id }" @click="avatar.outfit = outfit.id">
              <img :src="outfit.icon" :alt="outfit.name" />
              <span>{{ outfit.name }}</span>
            </div>
          </template>
        </div>

        <div class="action-buttons">
          <router-link to="/dashboard" class="btn-secondary">나중에</router-link>
          <button @click="saveAvatar" class="btn-primary" :disabled="isSaving">
            {{ isSaving ? '저장 중...' : '이 모습으로 결정' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// --- 데이터 정의 ---
const loading = ref(true);
const isSaving = ref(false);
const activeTab = ref('hair');

// 현재 사용자가 선택한 아바타 정보
const avatar = reactive({
  body: 'body_male',
  hair: 'hair_short_white',
  outfit: 'outfit_hoodie',
});

// 선택 가능한 옵션 목록
const hairOptions = ref([
  { id: 'hair_short_white', name: '하얀 스포츠컷', icon: require('@/assets/avatar/hair_short_white.png') },
  { id: 'hair_bob_blue', name: '푸른 단발', icon: require('@/assets/avatar/hair_bob_blue.png') },
  { id: 'hair_long_silver', name: '은빛 장발', icon: require('@/assets/avatar/hair_long_silver.png') },
]);
const outfitOptions = ref([
  { id: 'outfit_hoodie', name: '탐험가 후드', icon: require('@/assets/avatar/outfit_hoodie.png') },
  { id: 'outfit_labcoat', name: '솔레인 연구원 가운', icon: require('@/assets/avatar/outfit_labcoat.png') },
]);

// --- computed 속성 (이미지 경로 반환) ---
const getBodyImage = computed(() => require(`@/assets/avatar/${avatar.body}.png`));
const getOutfitImage = computed(() => require(`@/assets/avatar/${avatar.outfit}.png`));
const getHairImage = computed(() => require(`@/assets/avatar/${avatar.hair}.png`));

// --- 함수 정의 ---
onMounted(async () => {
  const uid = auth.currentUser.uid;
  if (!uid) return;

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists() && userSnap.data().avatar) {
    const savedAvatar = userSnap.data().avatar;
    Object.assign(avatar, savedAvatar); // 저장된 데이터로 덮어쓰기
  }
  loading.value = false;
});

const saveAvatar = async () => {
  isSaving.value = true;
  try {
    const saveFunc = httpsCallable(functions, 'saveAvatarCustomization');
    await saveFunc({ avatarData: avatar });
    alert('아바타가 성공적으로 저장되었습니다!');
  } catch (error) {
    console.error("아바타 저장 실패:", error);
    alert(`저장 실패: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.avatar-page-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
  padding: 20px;
  background: linear-gradient(135deg, #2c3e50, #1d2b3a);
  color: #ecf0f1;
}
.customization-panel {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  width: 100%;
  max-width: 900px;
  height: 600px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
}

/* 1. 아바타 미리보기 영역 */
.avatar-preview-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  border-right: 1px solid rgba(255,255,255,0.1);
  overflow: hidden;
}
.spotlight {
  position: absolute;
  width: 400px; /* 스포트라이트 크기 조정 */
  height: 400px;
  background: radial-gradient(circle, rgba(241, 196, 15, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  animation: pulse-light 4s infinite alternate;
}
@keyframes pulse-light {
  from { transform: scale(0.9); opacity: 0.8; }
  to { transform: scale(1.1); opacity: 1; }
}

/* ▼▼▼ [핵심 수정 1] 미리보기 영역을 정사각형으로 변경 ▼▼▼ */
.avatar-preview {
  position: relative;
  width: 300px;
  height: 300px;
}
/* ▲▲▲ */

.avatar-part {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  animation: fade-in 0.5s ease-out;
}
@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ▼▼▼ [핵심 수정 2] 레이어 순서를 z-index로 명확하게 지정 ▼▼▼ */
.avatar-part.body { z-index: 1; }
.avatar-part.outfit { z-index: 2; }
.avatar-part.hair { z-index: 3; }
.avatar-part.eyes { z-index: 4; }
.avatar-part.nose { z-index: 4; }
.avatar-part.mouth { z-index: 4; }
/* ▲▲▲ */

/* 2. 커스터마이징 옵션 영역 (나머지는 동일) */
/* ... (다른 모든 스타일은 기존과 동일하게 유지) ... */
.options-panel {
  display: flex;
  flex-direction: column;
  padding: 20px;
}
.tabs {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 20px;
}
/* ... */
.face-options { display: flex; flex-direction: column; gap: 15px; width: 100%; }
.face-category { text-align: left; }
.face-category label { font-weight: bold; margin-bottom: 8px; display: block; }
.option-group { display: flex; gap: 10px; flex-wrap: wrap; }
.option-group .option-item { padding: 5px; }
.option-group .option-item img { width: 40px; height: 40px; }

/* 모바일 화면 대응 */
@media (max-width: 768px) {
  .customization-panel {
    grid-template-columns: 1fr;
    height: auto;
    max-height: calc(100vh - 100px);
  }
  .avatar-preview-wrapper {
    height: 300px;
    border-right: none;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  /* ▼▼▼ [핵심 수정 3] 모바일 미리보기 영역도 정사각형으로 변경 ▼▼▼ */
  .avatar-preview {
    width: 200px;
    height: 200px;
  }
  /* ▲▲▲ */
  .options-panel {
    padding: 15px;
  }
  .options-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>
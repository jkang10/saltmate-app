<template>
  <div class="customization-panel">
    <div class="avatar-preview-wrapper">
      <div class="spotlight"></div>
      <div v-if="loading" class="loading-spinner"></div>
      <div v-else class="avatar-preview">
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
/* ▼▼▼ [핵심 수정] 페이지 전체 스타일을 제거하고, 패널 스타일을 수정합니다. ▼▼▼ */
.customization-panel {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  width: 100%;
  max-width: 900px;
  margin: 20px auto; /* 페이지 중앙 정렬 */
  background: rgba(44, 62, 80, 0.8);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
}
/* ▲▲▲ */

/* 1. 아바타 미리보기 영역 */
.avatar-preview-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  border-right: 1px solid rgba(255,255,255,0.1);
  overflow: hidden;
  /* ▼▼▼ [핵심 수정 2] 미리보기 영역을 정사각형 비율로 강제합니다. ▼▼▼ */
  aspect-ratio: 1 / 1;
}
.spotlight {
  position: absolute;
  width: 150%;
  height: 150%;
  background: radial-gradient(circle, rgba(241, 196, 15, 0.1) 0%, transparent 60%);
  border-radius: 50%;
  animation: pulse-light 4s infinite alternate;
}
@keyframes pulse-light {
  from { transform: scale(0.9); opacity: 0.8; }
  to { transform: scale(1.1); opacity: 1; }
}
.avatar-preview {
  position: relative;
  width: 80%; /* 부모(wrapper) 크기에 맞춰 유동적으로 변경 */
  height: 80%;
}
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
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.avatar-part.body { z-index: 1; }
.avatar-part.outfit { z-index: 2; }
.avatar-part.hair { z-index: 3; }
.avatar-part.eyes { z-index: 4; }
.avatar-part.nose { z-index: 4; }
.avatar-part.mouth { z-index: 4; }

/* 2. 커스터마이징 옵션 영역 */
.options-panel {
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto; /* 내용이 많아지면 스크롤 */
}
.tabs {
  display: flex;
  gap: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  margin-bottom: 20px;
  flex-shrink: 0;
}
.tabs button {
  padding: 10px 20px;
  background: none;
  border: none;
  color: #bdc3c7;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}
.tabs button.active {
  color: #f1c40f;
  border-bottom-color: #f1c40f;
}
.options-grid {
  flex-grow: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  overflow-y: auto;
  padding: 10px;
}
.option-item {
  background: rgba(255,255,255,0.05);
  border-radius: 10px;
  padding: 10px;
  text-align: center;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
  aspect-ratio: 1 / 1.2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.option-item:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(241, 196, 15, 0.5);
}
.option-item.selected {
  border-color: #f1c40f;
  box-shadow: 0 0 15px rgba(241, 196, 15, 0.3);
}
.option-item img {
  width: 80%;
  height: 80%;
  object-fit: contain;
  margin-bottom: 5px;
}
.option-item span {
  font-size: 0.9em;
}

.face-options { display: flex; flex-direction: column; gap: 15px; width: 100%; }
.face-category { text-align: left; }
.face-category label { font-weight: bold; margin-bottom: 8px; display: block; }
.option-group { display: flex; gap: 10px; flex-wrap: wrap; }
.option-group .option-item { padding: 5px; width: 60px; height: 60px; }
.option-group .option-item img { width: 100%; height: 100%; }

/* 3. 액션 버튼 */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}
.btn-primary, .btn-secondary {
  padding: 12px 25px;
  font-size: 1em;
  font-weight: bold;
  cursor: pointer;
  border-radius: 8px;
  border: none;
  transition: all 0.3s ease;
  text-decoration: none;
}
.btn-primary {
  background: linear-gradient(145deg, #f1c40f, #e67e22);
  color: white;
}
.btn-secondary {
  background: rgba(255,255,255,0.1);
  color: #ecf0f1;
}

/* ▼▼▼ [핵심 수정 3] 모바일에서 세로로 쌓이도록 변경합니다. ▼▼▼ */
@media (max-width: 768px) {
  .customization-panel {
    grid-template-columns: 1fr;
    height: auto;
    max-height: calc(100vh - 40px); /* 화면 높이에 맞게 조절 */
    margin: 0;
  }
  .avatar-preview-wrapper {
    border-right: none;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .avatar-preview {
    width: 60%;
    height: 60%;
  }
  .options-panel {
    padding: 15px;
  }
  .options-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>
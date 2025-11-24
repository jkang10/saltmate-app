<template>
  <div class="avatar-container">
    <iframe
      ref="rpmFrame"
      :src="iframeSrc"
      class="rpm-iframe"
      allow="camera *; microphone *"
    ></iframe>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
// [★수정★] Firestore (updateDoc) 대신 Firebase Functions (httpsCallable)를 import 합니다.
import { functions, auth } from '@/firebaseConfig'; //
import { httpsCallable } from 'firebase/functions'; //
import { useRouter } from 'vue-router';

export default {
  name: 'AvatarCreationPage',
  setup() {
    const rpmFrame = ref(null);
    const router = useRouter();

    const subdomain = 'saltmate';
    const iframeSrc = computed(() => {
      return `https://${subdomain}.readyplayer.me/avatar?frameApi`;
    });

    // [★신규★] saveAvatarCustomization 함수에 대한 호출기(callable)를 생성합니다.
    const saveAvatarFunc = httpsCallable(functions, 'saveAvatarCustomization'); //

    const handleMessage = (event) => {
      if (event.source !== rpmFrame.value?.contentWindow) return;
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (error) { console.error('Failed to parse RPM message:', error); return; }

      if (data.eventName === 'v1.frame.ready') {
        rpmFrame.value.contentWindow.postMessage(JSON.stringify({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.**' }), '*');
      }

      if (data.eventName === 'v1.avatar.exported') {
        console.log('아바타 데이터 수신 성공:', data.data);
        const glbUrl = data.data.url;
        // [★신규★] Ready Player Me가 제공하는 2D 렌더링(초상화) 이미지 URL
        const renderUrl = data.data.renderUrl; 
        
        // [★수정★] 이전 함수 대신 새 함수를 호출합니다.
        saveAvatarData(glbUrl, renderUrl);
      }
    };

    // [★수정★] Firestore 직접 저장 대신, 백엔드 함수를 호출하는 로직으로 변경
const saveAvatarData = async (glbUrl, renderUrl) => {
  try {
    const user = auth.currentUser;
    if (user) {
      // [확인] glbUrl이 avatarUrl로 저장될 핵심 데이터입니다.
      const avatarDataPayload = {
        glbUrl: glbUrl, 
        renderUrl: renderUrl
      };

      await saveAvatarFunc({ avatarData: avatarDataPayload });

      console.log('Firestore에 avatarUrl 저장 완료!');
      alert('아바타가 성공적으로 저장되었습니다!');
      
      router.push({ name: 'DashboardPage' });
        } else {
           console.error('사용자 인증 정보를 찾을 수 없습니다.');
           alert('로그인 상태를 확인해주세요.');
        }
      } catch (error) {
        console.error('아바타 저장 중 오류 발생 (Cloud Function 호출):', error);
        alert(`아바타 저장 중 오류가 발생했습니다: ${error.message}`);
      }
    };

    onMounted(() => { window.addEventListener('message', handleMessage); });
    onBeforeUnmount(() => { window.removeEventListener('message', handleMessage); });

    return { rpmFrame, iframeSrc };
  },
};

</script>

<style scoped>
.avatar-container {
  /* position: fixed;를 사용하여 헤더 위에 덮어씌웁니다. */
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw; /* 화면 전체 너비 */
  height: 100dvh; /* [★수정★] 100vh -> 100dvh (모바일 브라우저 UI 고려) */
  z-index: 1001; /* App.vue의 헤더(z-index: 1000)보다 높게 설정 */
  background-color: #f0f0f0; /* 배경색 지정 (선택 사항) */
  padding: 0;
  margin: 0;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}
.rpm-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* 모바일 화면 (예: 768px 이하)에서 iframe 주변에 약간의 여백을 주어
   Ready Player Me UI가 잘리지 않도록 합니다. */
@media (max-width: 768px) {
  .avatar-container {
    /* 모바일에서는 상단 헤더 공간만큼 패딩을 줄 수 있습니다. */
    /* padding-top: 70px; */ /* 헤더 높이만큼 패딩 (필요 시 주석 해제) */
    /* height: calc(100vh - 70px); */ /* 패딩 적용 시 높이 조정 (필요 시 주석 해제) */
  }
  /* iframe 자체 크기를 조정할 수도 있습니다. */
  /* .rpm-iframe { height: calc(100% - 70px); } */
}
</style>
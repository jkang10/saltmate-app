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
// [수정 1] Firestore 및 Auth 모듈 import 주석 해제 및 경로 확인
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/firebaseConfig';
// [수정 2] Vue Router의 useRouter 훅 import 추가
import { useRouter } from 'vue-router';

export default {
  name: 'AvatarCreationPage',
  setup() {
    const rpmFrame = ref(null);
    // [수정 2] useRouter 훅 사용
    const router = useRouter();

    const subdomain = 'saltmate';
    const iframeSrc = computed(() => {
      return `https://${subdomain}.readyplayer.me/avatar?frameApi`;
    });

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
        console.log('아바타 URL 수신 성공:', data.data.url);
        const avatarGlbUrl = data.data.url;
        saveUrlToFirestore(avatarGlbUrl);
      }
    };

    const saveUrlToFirestore = async (url) => {
      try {
        // [수정 1] Firestore 저장 로직 주석 해제
        const user = auth.currentUser;
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            avatarUrl: url // Firestore에 avatarUrl 필드로 저장
          });
          console.log('Firestore에 avatarUrl 저장 완료!');
          // [수정 2] router 변수 사용하여 페이지 이동 (주석 해제)
          // router.push({ name: 'SoleinDigitalUtopia' }); // 저장 후 이동할 페이지 이름 확인 필요
          // [대안] 대시보드로 이동하려면
          router.push({ name: 'DashboardPage' });
        } else {
           console.error('사용자 인증 정보를 찾을 수 없습니다.');
           alert('로그인 상태를 확인해주세요.'); // 사용자에게 알림
        }
        // [수정 3] 시뮬레이션 alert 제거 (또는 console.log로 변경)
        // alert(`아바타 URL 저장 성공 (시뮬레이션): ${url}`);
      } catch (error) {
        console.error('Firestore 저장 중 오류 발생:', error);
        alert(`아바타 저장 중 오류가 발생했습니다: ${error.message}`); // 사용자에게 오류 알림
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
  height: 100vh; /* 화면 전체 높이 */
  z-index: 1001; /* App.vue의 헤더(z-index: 1000)보다 높게 설정 */
  background-color: #f0f0f0; /* 배경색 지정 (선택 사항) */
  padding: 0;
  margin: 0; /* 기존 margin 제거 */
  overflow: hidden; /* 스크롤 방지 */
  display: flex; /* 혹시 모를 내부 정렬 위해 추가 */
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
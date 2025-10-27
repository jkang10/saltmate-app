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
  /* [수정 1] 헤더 높이(70px)만큼 위쪽 여백 추가 */
  margin-top: 70px; 
  /* [수정 2] 전체 높이에서 헤더 높이만큼 빼기 */
  height: calc(100vh - 70px); 
  width: 100%; 
  padding: 0; 
  overflow: hidden; /* 스크롤 방지 */
}
.rpm-iframe {
  width: 100%;
  height: 100%; /* 컨테이너 높이에 맞춤 */
  border: none;
}
</style>
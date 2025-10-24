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
// firestore와 auth 관련 서비스를 가져옵니다 (프로젝트에 맞게 경로 수정)
import { doc, updateDoc } from 'firebase/firestore'; 
import { db, auth } from '@/firebaseConfig'; 

export default {
  name: 'AvatarCreationPage',
  setup() {
    const rpmFrame = ref(null);
    
    // 1. 여기에 RPM 스튜디오에서 발급받은 하위 도메인을 입력합니다.
	const subdomain = 'saltmate'; // 형님의 고유 서브도메인
	const iframeSrc = computed(() => {
	  return `https://${subdomain}.readyplayer.me/avatar?frameApi`;
	});

    // 2. RPM iframe으로부터 메시지를 수신하는 핸들러
    const handleMessage = (event) => {
      // 메시지 소스가 RPM인지 확인
      if (event.source !== rpmFrame.value?.contentWindow) {
        return;
      }

      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (error) {
        console.error('Failed to parse RPM message:', error);
        return;
      }

      // 3. iframe이 준비되면, 우리가 받을 이벤트를 구독(subscribe)합니다.
      if (data.eventName === 'v1.frame.ready') {
        rpmFrame.value.contentWindow.postMessage(
          JSON.stringify({
            target: 'readyplayerme',
            type: 'subscribe',
            eventName: 'v1.**', // 모든 v1 이벤트를 구독합니다.
          }),
          '*'
        );
      }

      // 4. (가장 중요) 아바타 생성이 완료되고 '완료' 버튼을 누른 시점
      if (data.eventName === 'v1.avatar.exported') {
        console.log('아바타 URL 수신 성공:', data.data.url);
        const avatarGlbUrl = data.data.url;
        
        // 5. 이 URL을 Firestore에 저장합니다.
        saveUrlToFirestore(avatarGlbUrl);
      }
    };

    // 6. 수신한 URL을 Firestore에 저장하는 함수 (형님의 로직)
    const saveUrlToFirestore = async (url) => {
      try {
         const user = auth.currentUser;
         if (user) {
         const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            avatarUrl: url
          });
          console.log('Firestore에 avatarUrl 저장 완료!');
         // 저장이 완료되면 플라자 페이지로 이동시킵니다.
        router.push({ name: 'SoleinDigitalUtopia' });
         }
        alert(`아바타 URL 저장 성공 (시뮬레이션): ${url}`);
      } catch (error) {
        console.error('Firestore 저장 중 오류 발생:', error);
      }
    };

    // 컴포넌트 마운트/제거 시 이벤트 리스너 등록 및 해제
    onMounted(() => {
      window.addEventListener('message', handleMessage);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('message', handleMessage);
    });

    return {
      rpmFrame,
      iframeSrc,
    };
  },
};
</script>

<style scoped>
.avatar-container {
  width: 100%;
  height: 100vh;
  padding: 0;
  margin: 0;
}
.rpm-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
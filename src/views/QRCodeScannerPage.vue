<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-qrcode"></i> 센터 방문 인증</h1>
      <p v-if="!route.query.qrId" class="description">센터에 비치된 QR코드를 스캔하여 방문을 인증하세요.</p>
    </header>

    <div class="scanner-card card">
      <div v-if="route.query.qrId" class="status-display">
        <div v-if="isLoading" class="loading-spinner"></div>
        <p v-if="isLoading" class="loading-message">인증 처리 중...</p>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
      
      <div v-else class="scanner-container">
        <div v-if="!cameraReady && !error" class="loading-overlay">
          <div class="spinner-small"></div>
          <p class="loading-message">카메라를 불러오는 중...</p>
        </div>
        <div class="scanner-viewport" :class="{ ready: cameraReady }">
          <qrcode-stream @decode="onDecode" @init="onInit" />
        </div>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { QrcodeStream } from 'vue-qrcode-reader';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useRouter, useRoute } from 'vue-router';

const error = ref('');
const isLoading = ref(false);
const cameraReady = ref(false);
const router = useRouter();
const route = useRoute();

// [핵심] QR 코드 인증을 처리하는 공통 함수
const processQRCode = async (qrId) => {
  if (isLoading.value) return;
  isLoading.value = true;
  error.value = '';

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const claimReward = httpsCallable(functions, "claimCenterVisitReward");
    const result = await claimReward({ qrId });

    alert(result.data.message);
    router.push('/dashboard'); // 성공 시 대시보드로 이동
  } catch (err) {
    console.error("QR코드 인증 오류:", err);
    error.value = `인증 실패: ${err.message}`;
    // 오류 발생 후 3초 뒤에 다시 스캔할 수 있도록 초기화
    setTimeout(() => {
      isLoading.value = false;
      error.value = '';
      if (route.query.qrId) router.push('/dashboard');
    }, 3000);
  }
};

// [핵심] 카메라로 QR 코드를 스캔했을 때 호출되는 함수
const onDecode = (decodedString) => {
  // 스캔한 내용이 전체 URL이어도 ID만 추출하여 처리
  try {
    const url = new URL(decodedString);
    const qrId = url.searchParams.get('qrId');
    if (qrId) {
      processQRCode(qrId);
    } else {
      throw new Error("URL에 qrId가 없습니다.");
    }
  } catch (e) {
    // URL이 아닌 단순 텍스트(ID)여도 처리
    processQRCode(decodedString);
  }
};

const onInit = async (promise) => {
  try {
    await promise;
    cameraReady.value = true;
  } catch (err) {
    console.error("카메라 초기화 오류:", err);
    if (err.name === 'NotAllowedError') error.value = '카메라 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.';
    else if (err.name === 'NotFoundError') error.value = '사용 가능한 카메라를 찾을 수 없습니다.';
    else error.value = '카메라를 시작하는 중 오류가 발생했습니다.';
  }
};

onMounted(() => {
  const qrIdFromUrl = route.query.qrId;
  if (qrIdFromUrl) {
    processQRCode(qrIdFromUrl);
  }
});
</script>

<style scoped>
.page-container { max-width: 600px; margin: 70px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.scanner-card { padding: 30px; }
.scanner-container { position: relative; max-width: 400px; margin: 0 auto; }
.scanner-viewport {
  border: 5px solid #007bff; 
  border-radius: 12px; 
  overflow: hidden;
  background: #000;
  position: relative;
  width: 100%;
  padding-top: 100%;
  transition: opacity 0.5s ease-in-out;
  opacity: 0;
}
.scanner-viewport.ready {
  opacity: 1;
}
.scanner-viewport > :first-child {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.loading-overlay {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #555;
  height: 400px;
}
.error-message, .loading-message { text-align: center; margin-top: 20px; font-weight: bold; }
.error-message { color: #dc3545; }
.status-display { padding: 40px 0; text-align: center; }
.loading-spinner, .spinner-small {
  border: 4px solid rgba(0,0,0,0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}
.loading-spinner { width: 40px; height: 40px; }
.spinner-small { width: 24px; height: 24px; border-width: 3px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
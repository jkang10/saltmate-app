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
        <div class="scanner-viewport">
          <qrcode-stream @decode="onDecode" @init="onInit" />
          <div v-if="!cameraReady && !error" class="loading-overlay">
            <div class="spinner-small"></div>
            <p class="loading-message">카메라를 불러오는 중...</p>
          </div>
        </div>
        <p v-if="error && !isLoading" class="error-message">{{ error }}</p>
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

const processQRCode = async (qrId) => {
  if (isLoading.value) return;
  isLoading.value = true;
  error.value = '';

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const claimReward = httpsCallable(functions, "claimCenterVisitReward");
    const result = await claimReward({ qrId: qrId });

    alert(result.data.message);
    router.push('/dashboard');
  } catch (err) {
    console.error("QR코드 인증 오류:", err);
    error.value = `인증 실패: ${err.message}`;
    setTimeout(() => {
      isLoading.value = false;
      error.value = '';
      if (route.query.qrId) { // URL로 접근했다 실패하면 대시보드로 보냄
        router.push('/dashboard');
      }
    }, 3000);
  }
};

const onDecode = (decodedString) => {
  try {
    const url = new URL(decodedString);
    const qrId = url.searchParams.get('qrId');
    if (qrId) {
      processQRCode(qrId);
    } else {
      throw new Error("URL에 qrId가 없습니다.");
    }
  } catch (e) {
    processQRCode(decodedString);
  }
};

const onInit = async (promise) => {
  // 10초 후에 카메라가 준비되지 않으면 타임아웃 오류를 표시합니다.
  const timeout = setTimeout(() => {
    if (!cameraReady.value) {
      error.value = '카메라를 불러오는 데 시간이 너무 오래 걸립니다. 페이지를 새로고침하거나 브라우저의 카메라 권한을 확인해주세요.';
    }
  }, 10000); // 10초 타임아웃

  try {
    // 카메라 스트림을 성공적으로 가져올 때까지 기다립니다.
    await promise;
    // 성공 시, 카메라 준비 상태를 true로 변경합니다.
    cameraReady.value = true;
  } catch (err) {
    console.error("카메라 초기화 오류:", err);
    if (err.name === 'NotAllowedError') {
      error.value = '카메라 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.';
    } else if (err.name === 'NotFoundError') {
      error.value = '사용 가능한 카메라를 찾을 수 없습니다.';
    } else {
      error.value = '카메라를 시작하는 중 오류가 발생했습니다.';
    }
  } finally {
    // 성공하든 실패하든, 설정해둔 타임아웃은 반드시 제거합니다.
    clearTimeout(timeout);
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
.scanner-container {
  position: relative;
  max-width: 400px;
  margin: 0 auto;
}
.scanner-viewport {
  border: 5px solid #007bff; 
  border-radius: 12px; 
  overflow: hidden;
  background: #000;
  position: relative;
  width: 100%;
  padding-top: 100%; 
}
.scanner-viewport > :first-child { /* qrcode-stream 컴포넌트 */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #000;
  color: white;
  border-radius: 7px;
  z-index: 10;
}
.error-message, .loading-message { text-align: center; margin-top: 20px; font-weight: bold; }
.error-message { color: #dc3545; }
.status-display, .loading-overlay { padding: 40px 0; }
.loading-spinner, .spinner-small {
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}
.loading-spinner { width: 40px; height: 40px; }
.spinner-small { width: 24px; height: 24px; border-width: 3px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
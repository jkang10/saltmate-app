<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-qrcode"></i> 센터 방문 인증</h1>
      <p v-if="!route.query.qrId" class="description">센터에 비치된 QR코드를 스캔하여 방문을 인증하세요.</p>
    </header>

    <div class="scanner-card card">
      <div v-if="route.query.qrId">
        <p v-if="isLoading" class="loading-message">인증 처리 중...</p>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
      <div v-else class="scanner-viewport">
        <qrcode-stream @decode="onDecode" @init="onInit" />
        <p v-if="!cameraReady && !error" class="loading-message">카메라를 불러오는 중...</p>
      </div>
      <p v-if="error && !isLoading" class="error-message">{{ error }}</p>
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
const route = useRoute(); // 현재 라우트 정보를 가져옵니다.

// QR코드 인증을 처리하는 공통 함수
const processQRCode = async (qrId) => {
  if (isLoading.value) return;
  isLoading.value = true;
  error.value = '';

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const claimReward = httpsCallable(functions, "claimCenterVisitReward");
    const result = await claimReward({ qrId: qrId });

    alert(result.data.message);
    router.push('/dashboard'); // 성공 시 대시보드로 이동
  } catch (err) {
    console.error("QR코드 인증 오류:", err);
    error.value = `인증 실패: ${err.message}`;
    // 오류 발생 후 3초 뒤에 다시 스캔할 수 있도록 초기화
    setTimeout(() => {
      isLoading.value = false;
      error.value = '';
    }, 3000);
  }
};

// 카메라로 스캔했을 때 호출되는 함수
const onDecode = (decodedString) => {
  processQRCode(decodedString);
};

// onInit 함수 수정 제안
const onInit = async (promise) => {
  // 10초 타임아웃 설정
  const timeout = setTimeout(() => {
    if (!cameraReady.value) {
      error.value = '카메라를 불러오는 데 시간이 너무 오래 걸립니다. 페이지를 새로고침하거나 브라우저의 카메라 권한을 확인해주세요.';
    }
  }, 10000);

  try {
    await promise;
    cameraReady.value = true;
  } catch (err) {
    console.error("카메라 초기화 오류:", err);
    if (err.name === 'NotAllowedError') {
      error.value = '카메라 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.';
    } else {
      error.value = '카메라를 시작하는 중 오류가 발생했습니다.';
    }
  } finally {
    // 성공하든 실패하든 타임아웃은 제거
    clearTimeout(timeout);
  }
};

// [핵심 추가] 페이지가 마운트될 때 URL을 확인하는 로직
onMounted(() => {
  const qrIdFromUrl = route.query.qrId;
  if (qrIdFromUrl) {
    // URL에 qrId가 있으면, 카메라를 켜지 않고 바로 인증을 시도합니다.
    processQRCode(qrIdFromUrl);
  }
  // URL에 qrId가 없으면, 템플릿의 <qrcode-stream>이 카메라를 켭니다.
});
</script>

<style scoped>
.page-container { max-width: 600px; margin: 70px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.scanner-card { padding: 30px; }
.scanner-viewport { max-width: 400px; margin: 0 auto; border: 5px solid #007bff; border-radius: 12px; overflow: hidden; }
.error-message, .loading-message { text-align: center; margin-top: 20px; font-weight: bold; }
.error-message { color: #dc3545; }
</style>
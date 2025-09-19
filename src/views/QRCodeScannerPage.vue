<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-qrcode"></i> 센터 방문 인증</h1>
      <p class="description">센터에 비치된 QR코드를 스캔하여 방문을 인증하세요.</p>
    </header>

    <div class="scanner-card card">
      <div class="scanner-viewport">
        <qrcode-stream @decode="onDecode" @init="onInit" />
      </div>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="isLoading" class="loading-message">인증 처리 중...</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { QrcodeStream } from 'vue-qrcode-reader';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useRouter } from 'vue-router';

const error = ref('');
const isLoading = ref(false);
const router = useRouter();

const onDecode = async (decodedString) => {
  if (isLoading.value) return;
  isLoading.value = true;
  error.value = '';

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const claimReward = httpsCallable(functions, "claimCenterVisitReward");
    const result = await claimReward({ qrId: decodedString });

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

const onInit = async (promise) => {
  try {
    await promise;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      error.value = '카메라 접근 권한이 필요합니다. 브라우저 설정을 확인해주세요.';
    } else if (err.name === 'NotFoundError') {
      error.value = '카메라를 찾을 수 없습니다.';
    } else {
      error.value = '카메라 초기화 중 오류가 발생했습니다.';
    }
  }
};
</script>

<style scoped>
.page-container { max-width: 600px; margin: 70px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.scanner-card { padding: 30px; }
.scanner-viewport { max-width: 400px; margin: 0 auto; border: 5px solid #007bff; border-radius: 12px; overflow: hidden; }
.error-message, .loading-message { text-align: center; margin-top: 20px; font-weight: bold; }
.error-message { color: #dc3545; }
</style>
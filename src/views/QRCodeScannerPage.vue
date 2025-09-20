<template>
  <div class="qr-scanner-page">
    <div class="scanner-container">
      <div v-if="isLoading || successMessage || errorMessage" class="status-overlay">
        <div v-if="isLoading" class="status-content">
          <div class="spinner"></div>
          <p>QR 코드를 확인 중입니다...</p>
        </div>
        <div v-if="successMessage" class="status-content success">
          <i class="fas fa-check-circle"></i>
          <p>{{ successMessage }}</p>
          <button @click="goBack" class="btn-action">대시보드로 돌아가기</button>
        </div>
        <div v-if="errorMessage && !isLoading" class="status-content error">
            <i class="fas fa-times-circle"></i>
            <p class="error-text">{{ errorMessage }}</p>
            <button @click="initCamera" class="btn-action retry">다시 시도하기</button>
        </div>
      </div>
      
      <video ref="video" autoplay playsinline></video>
      <canvas ref="canvas" style="display: none;"></canvas>
      
      <div v-if="isScanning" class="scanner-guide">
        <div class="qr-frame"></div>
        <p class="guide-text">센터에 비치된 QR코드를 화면에 맞춰주세요.</p>
      </div>
    </div>
  </div>
</template>

<script>
import jsQR from "jsqr";
import { functions } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";

export default {
  data() {
    return {
      errorMessage: "",
      successMessage: "",
      stream: null,
      scanRequest: null,
      isLoading: false,
      isScanning: false, // 초기 상태를 false로 변경
    };
  },
  mounted() {
    this.initCamera();
  },
  beforeUnmount() {
    this.stopScannerAndCamera();
  },
  methods: {
    stopScannerAndCamera() {
      if (this.scanRequest) {
        cancelAnimationFrame(this.scanRequest);
        this.scanRequest = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      this.isScanning = false;
    },

    async initCamera() {
      // 모든 상태 초기화
      this.errorMessage = "";
      this.successMessage = "";
      this.isLoading = false;
      this.isScanning = true;

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.errorMessage = "이 브라우저에서는 카메라를 지원하지 않습니다.";
          this.isScanning = false;
          return;
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });

        const video = this.$refs.video;
        if (video) {
          video.srcObject = this.stream;
          video.onloadedmetadata = () => {
            this.scanQRCode();
          };
        }
      } catch (err) {
        console.error("카메라 접근 실패:", err);
        if (err.name === "NotAllowedError") {
          this.errorMessage = "카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.";
        } else {
          this.errorMessage = "카메라를 시작할 수 없습니다. 잠시 후 다시 시도해주세요.";
        }
        this.isScanning = false;
      }
    },
    
    scanQRCode() {
      if (!this.isScanning) return;

      const video = this.$refs.video;
      const canvas = this.$refs.canvas;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        this.scanRequest = requestAnimationFrame(this.scanQRCode);
        return;
      }
      
      const ctx = canvas.getContext("2d");
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        this.stopScannerAndCamera();
        this.processQRCode(code.data);
      } else {
        this.scanRequest = requestAnimationFrame(this.scanQRCode);
      }
    },

    async processQRCode(qrId) {
      this.isLoading = true;
      this.errorMessage = "";
      
      try {
        const claimReward = httpsCallable(functions, 'claimCenterVisitReward');
        const result = await claimReward({ qrId: qrId });

        if (result.data.success) {
          this.successMessage = result.data.message || "방문 인증이 완료되었습니다!";
        } else {
          // [핵심 수정] 에러 발생 시 initCamera() 호출 제거
          this.errorMessage = result.data.message || "알 수 없는 오류가 발생했습니다.";
        }
      } catch (error) {
        console.error("QR 코드 처리 오류:", error);
        // [핵심 수정] 에러 발생 시 initCamera() 호출 제거
        this.errorMessage = error.message || "인증에 실패했습니다. QR코드를 다시 확인해주세요.";
      } finally {
        this.isLoading = false;
      }
    },
    
    goBack() {
      this.$router.push('/dashboard');
    }
  }
};
</script>

<style scoped>
/* 기존 스타일 유지, 일부 수정 및 추가 */
.qr-scanner-page { display: flex; justify-content: center; align-items: center; min-height: 80vh; background-color: #f4f7f6; padding: 20px; }
.scanner-container { position: relative; width: 100%; max-width: 450px; overflow: hidden; border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15); background: #333; }
video { width: 100%; display: block; }
.scanner-guide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; pointer-events: none; }
.qr-frame { width: 70%; padding-bottom: 70%; border: 4px solid rgba(255, 255, 255, 0.8); border-radius: 12px; box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.5); }
.guide-text { margin-top: 24px; color: white; font-size: 1rem; font-weight: 500; background-color: rgba(0, 0, 0, 0.6); padding: 8px 16px; border-radius: 8px; }
.status-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; z-index: 10; color: white; text-align: center; padding: 20px; }
.status-content { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.status-content.success i { font-size: 4rem; color: #4caf50; }
.status-content.error i { font-size: 4rem; color: #dc3545; }
.status-content p { font-size: 1.2rem; font-weight: 500; margin: 0; }
.error-text { color: #f8d7da; }
.btn-action { margin-top: 20px; padding: 12px 24px; border: none; color: white; font-weight: bold; border-radius: 8px; cursor: pointer; background-color: #007bff; }
.btn-action.retry { background-color: #28a745; }
.spinner { border: 5px solid rgba(255, 255, 255, 0.3); border-top: 5px solid #fff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
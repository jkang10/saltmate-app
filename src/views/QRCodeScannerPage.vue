<template>
  <div class="qr-scanner-page">
    <div class="scanner-container">
      <div v-if="!isScanning" class="status-overlay">
        <div v-if="isLoading" class="status-content">
          <div class="spinner"></div>
          <p>QR 코드를 확인 중입니다...</p>
        </div>
        <div v-if="successMessage" class="status-content success">
          <i class="fas fa-check-circle"></i>
          <p>{{ successMessage }}</p>
          <button @click="goBack" class="btn-back">대시보드로 돌아가기</button>
        </div>
      </div>
      
      <video ref="video" :class="{ 'hidden': !isScanning }" autoplay playsinline></video>
      <canvas ref="canvas" style="display: none;"></canvas>
      
      <div class="scanner-guide">
        <div class="qr-frame"></div>
        <p class="guide-text">센터에 비치된 QR코드를 화면에 맞춰주세요.</p>
      </div>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script>
import jsQR from "jsqr";
import { functions } from "@/firebaseConfig"; // Firebase 설정 import
import { httpsCallable } from "firebase/functions"; // httpsCallable import

export default {
  data() {
    return {
      errorMessage: "",
      successMessage: "",
      stream: null,
      scanRequest: null,
      isLoading: false,
      isScanning: true, // 스캔 활성화 상태
    };
  },
  mounted() {
    this.initCamera();
  },
  beforeUnmount() {
    this.stopScannerAndCamera();
  },
  methods: {
    // 카메라와 스캐너를 정지하는 함수
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
      this.errorMessage = "";
      this.successMessage = "";
      this.isScanning = true;
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.errorMessage = "이 브라우저에서는 카메라를 지원하지 않습니다.";
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
      }
    },
    
    // QR 코드 스캔 루프
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
        // QR 코드를 찾으면 스캔을 중지하고 처리 함수 호출
        this.stopScannerAndCamera();
        this.processQRCode(code.data);
      } else {
        // 못 찾으면 다음 프레임에서 계속 스캔
        this.scanRequest = requestAnimationFrame(this.scanQRCode);
      }
    },

    // 스캔된 QR 코드를 백엔드로 보내 처리하는 함수
    async processQRCode(qrId) {
      this.isLoading = true;
      this.errorMessage = "";
      
      try {
        const claimReward = httpsCallable(functions, 'claimCenterVisitReward');
        const result = await claimReward({ qrId: qrId });

        if (result.data.success) {
          this.successMessage = result.data.message || "방문 인증이 완료되었습니다!";
        } else {
          // 성공은 했지만 비즈니스 로직 상 실패 메시지가 온 경우
          this.errorMessage = result.data.message || "알 수 없는 오류가 발생했습니다.";
          this.initCamera(); // 스캐너 다시 시작
        }
      } catch (error) {
        console.error("QR 코드 처리 오류:", error);
        // 백엔드에서 보낸 구체적인 오류 메시지를 표시
        this.errorMessage = error.message || "인증에 실패했습니다. QR코드를 다시 확인해주세요.";
        this.initCamera(); // 에러 발생 시, 스캐너 다시 시작
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
.qr-scanner-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  background-color: #f4f7f6;
  padding: 20px;
}

.scanner-container {
  position: relative;
  width: 100%;
  max-width: 450px;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  background: #333;
}

video {
  width: 100%;
  display: block;
}

video.hidden {
  visibility: hidden;
}

.scanner-guide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.qr-frame {
  width: 70%;
  padding-bottom: 70%; /* 정사각형 비율 */
  border: 4px solid rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.5);
}

.guide-text {
  margin-top: 24px;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  background-color: rgba(0, 0, 0, 0.6);
  padding: 8px 16px;
  border-radius: 8px;
}

.status-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  color: white;
  text-align: center;
}

.status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.status-content.success i {
  font-size: 4rem;
  color: #4caf50;
}

.status-content p {
  font-size: 1.2rem;
  font-weight: 500;
  margin: 0;
}

.error-message {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(220, 53, 69, 0.9);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  z-index: 20;
  font-size: 0.95rem;
  text-align: center;
}

.btn-back {
  margin-top: 20px;
  padding: 12px 24px;
  border: none;
  background-color: #007bff;
  color: white;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
}

.spinner {
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-top: 5px solid #fff;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
<template>
  <div class="qr-scanner-page">
    <div class="scanner-container">
      <video ref="video" autoplay playsinline></video>
      <canvas ref="canvas" style="display: none;"></canvas>
      
      <div v-if="isScanning" class="scanner-guide">
        <div class="qr-frame"></div>
        <p class="guide-text">센터에 비치된 QR코드를 화면에 맞춰주세요.</p>
      </div>

      <header class="page-header">
        <h1>센터 방문 QR 인증</h1>
        <p class="subtitle">센터에 방문하여 QR코드를 스캔하고<br>1,000 SaltMate를 획득하세요!</p>
      </header>
    </div>

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
  </div>
</template>

<script>
import jsQR from "jsqr";
import { functions } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";

export default {
  // 스크립트(script) 부분은 기존 기능 그대로 유지되므로 변경할 필요 없습니다.
  data() {
    return {
      errorMessage: "",
      successMessage: "",
      stream: null,
      scanRequest: null,
      isLoading: false,
      isScanning: false, 
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
    
    async processQRCode(scannedData) {
      let qrId = scannedData;

      try {
        const url = new URL(scannedData);
        if (url.searchParams.has('qrId')) {
          qrId = url.searchParams.get('qrId');
        }
      } catch (e) {
        // URL 변환 실패 시 scannedData를 그대로 사용
      }

      if (!qrId || qrId.trim() === '') {
        this.errorMessage = "QR 코드의 내용이 비어있습니다. 다른 코드를 스캔해주세요.";
        this.isScanning = false;
        return;
      }

      this.isLoading = true;
      this.errorMessage = "";
      
      try {
        const claimReward = httpsCallable(functions, 'claimCenterVisitReward');
        const result = await claimReward({ qrId: qrId });

        if (result.data.success) {
          this.successMessage = result.data.message || "방문 인증이 완료되었습니다!";
        } else {
          this.errorMessage = result.data.message || "알 수 없는 오류가 발생했습니다.";
        }
      } catch (error) {
        console.error("QR 코드 처리 오류:", error);
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
/* [디자인 수정] 전체 스타일링 개선 */
.qr-scanner-page {
  /* 전체 화면을 사용하도록 설정 */
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden; /* 스크롤 방지 */
}

.scanner-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

video {
  width: 100%;
  height: 100%;
  object-fit: cover; /* 화면을 가득 채우도록 설정 */
}

.scanner-guide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.qr-frame {
  width: 70%;
  max-width: 300px;
  padding-bottom: 70%; /* 정사각형 비율 유지 */
  border: 4px solid rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  /* 스캐너 영역만 밝게 보이게 하는 효과 */
  box-shadow: 0 0 0 200vmax rgba(0, 0, 0, 0.6); 
  position: relative;

  /* 애니메이션 효과를 위한 가상 요소 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, transparent, #3498db, transparent);
    animation: scan-line 3s infinite ease-in-out;
  }
}

@keyframes scan-line {
  0% { top: 0; }
  50% { top: calc(100% - 3px); }
  100% { top: 0; }
}

/* 상단 설명 텍스트 */
.page-header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding: 40px 20px;
  text-align: center;
  color: white;
  z-index: 5;
  background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
}
.page-header h1 {
  font-size: 2em;
  margin: 0 0 10px 0;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.5);
}
.page-header .subtitle {
  font-size: 1.1em;
  opacity: 0.9;
  line-height: 1.5;
}

/* 상태 오버레이 (기존 스타일과 거의 동일) */
.status-overlay {
  position: fixed; /* 전체 화면을 덮도록 fixed로 변경 */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  color: white;
  text-align: center;
  padding: 20px;
  backdrop-filter: blur(5px);
}
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
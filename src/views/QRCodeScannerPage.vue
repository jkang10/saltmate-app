<template>
  <div class="qr-scanner">
    <video ref="video" autoplay playsinline></video>
    <canvas ref="canvas" style="display: none;"></canvas>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<script>
import jsQR from "jsqr";

export default {
  data() {
    return {
      errorMessage: "",
      stream: null, // 비디오 스트림을 관리하기 위한 변수
      scanRequest: null // requestAnimationFrame을 관리하기 위한 변수
    };
  },
  mounted() {
    this.initCamera();
  },
  // 컴포넌트가 파괴되기 전에 카메라와 스캔 루프를 정리합니다.
  beforeUnmount() {
    if (this.scanRequest) {
      cancelAnimationFrame(this.scanRequest);
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  },
  methods: {
    async initCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.errorMessage = "이 브라우저에서는 카메라를 지원하지 않습니다.";
          return;
        }

        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, // 후면 카메라 우선
          audio: false
        });

        const video = this.$refs.video;
        video.srcObject = this.stream;
        
        // 비디오가 재생될 준비가 되면 스캔을 시작합니다.
        video.onloadedmetadata = () => {
          this.scanQRCode();
        };

      } catch (err) {
        console.error("카메라 접근 실패:", err);
        if (err.name === "NotAllowedError") {
          this.errorMessage = "카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.";
        } else if (err.name === "NotFoundError") {
          this.errorMessage = "사용 가능한 카메라 장치를 찾을 수 없습니다.";
        } else if (err.name === "NotReadableError") {
          this.errorMessage = "카메라 장치에 접근할 수 없습니다. 다른 앱에서 사용 중인지 확인해주세요.";
        } else {
          this.errorMessage = "카메라 초기화 중 오류가 발생했습니다: " + err.message;
        }
      }
    },
    scanQRCode() {
      const video = this.$refs.video;
      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext("2d");

      // 비디오가 충분히 재생될 수 있는 상태인지 확인합니다.
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // 캔버스의 크기를 비디오 크기와 맞춥니다.
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;

        // 캔버스에 현재 비디오 프레임을 그립니다.
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 캔버스에서 이미지 데이터를 가져와 jsQR로 QR 코드를 찾습니다.
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        // QR 코드를 찾았다면!
        if (code) {
          console.log("QR 코드 발견:", code.data);
          alert(`QR 코드 내용: ${code.data}`);
          // 여기서 원하는 동작을 추가하세요. (예: 페이지 이동, 데이터 처리 등)
          // 스캔을 멈추려면 return; 을 사용하세요.
          // return; 
        }
      }
      // requestAnimationFrame을 사용하여 다음 프레임에서 다시 스캔을 시도합니다.
      this.scanRequest = requestAnimationFrame(this.scanQRCode);
    }
  }
};
</script>

<style scoped>
.qr-scanner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

video {
  width: 100%;
  max-width: 400px;
  border: 2px solid #ccc;
  border-radius: 8px;
}

.error {
  margin-top: 10px;
  color: red;
  font-size: 14px;
}
</style>
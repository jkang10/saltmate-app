<template>
<div class="qr-scanner">
<video ref="video" autoplay playsinline></video>
<p v-if="errorMessage" class="error">{{ errorMessage }}</p>
</div>
</template>


<script>
export default {
data() {
return {
errorMessage: ""
};
},
mounted() {
this.initCamera();
},
methods: {
async initCamera() {
try {
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
this.errorMessage = "이 브라우저에서는 카메라를 지원하지 않습니다.";
return;
}


const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode: { ideal: "environment" } },
audio: false
});


this.$refs.video.srcObject = stream;
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
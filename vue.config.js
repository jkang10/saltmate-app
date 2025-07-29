// vue.config.js
const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  // 중요: 빌드된 파일이 제공될 기본 URL 경로를 설정합니다.
  // Netlify와 같은 정적 호스팅에서는 루트 경로 '/'를 사용합니다.
  publicPath: "/",
});

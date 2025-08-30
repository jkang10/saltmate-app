const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
  transpileDependencies: true,
  chainWebpack: (config) => {
    // [핵심 수정] CopyWebpackPlugin 설정을 추가하여 서비스 워커 파일을 복사합니다.
    config.plugin("copy").tap(([options]) => {
      options.patterns.push({
        from: "src/firebase-messaging-sw.js", // 원본 파일 위치
        to: "dist", // 복사될 위치
      });
      return [options];
    });
  },
});

const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  // [신규 추가] PWA 플러그인 설정을 추가하여 서비스 워커를 관리합니다.
  pwa: {
    name: "Saltmate App",
    themeColor: "#007bff",
    msTileColor: "#000000",
    appleMobileWebAppCapable: "yes",
    appleMobileWebAppStatusBarStyle: "black",

    // 서비스 워커 관련 설정
    workboxPluginMode: "InjectManifest",
    workboxOptions: {
      // 빌드 시 제외할 파일을 지정할 수 있습니다.
      // exclude: [/...\\/\\.map$/, /_redirects/],

      // [핵심] src 폴더에 있는 서비스 워커 파일을 사용하도록 지정합니다.
      swSrc: "src/firebase-messaging-sw.js",
    },
  },
});

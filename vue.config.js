const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  // PWA 플러그인 설정
  pwa: {
    name: 'Saltmate',
    themeColor: '#007bff',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',

    // [핵심 수정] InjectManifest 모드를 사용하여 우리 고유의 서비스 워커 파일에 PWA 기능을 주입합니다.
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      // PWA 플러그인이 사용할 원본 서비스 워커 파일 경로를 src 폴더로 지정합니다.
      swSrc: 'src/service-worker.js',
      // 최종적으로 생성될 서비스 워커 파일 이름
      swDest: 'service-worker.js',
    }
  }
});
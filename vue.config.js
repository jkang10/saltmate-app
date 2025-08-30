const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  // PWA 플러그인 설정을 추가하여 서비스 워커를 관리합니다.
  pwa: {
    name: 'Saltmate App',
    themeColor: '#007bff',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',

    // 서비스 워커 관련 설정
    workboxPluginMode: 'InjectManifest',
    workboxOptions: {
      // [핵심] src 폴더에 있는 서비스 워커 파일을 사용하도록 지정합니다.
      swSrc: 'src/firebase-messaging-sw.js',
      // swDest는 기본적으로 'service-worker.js'로 생성됩니다.
      // Firebase 호스팅에서 이 파일을 찾도록 설정하거나, 이름을 firebase-messaging-sw.js로 변경할 수 있습니다.
      // 여기서는 기본값을 사용합니다.
    }
  }
});
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  pwa: {
    name: 'Saltmate App',
    themeColor: '#007bff',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',

    // [핵심 수정] 서비스 워커 생성 모드를 'GenerateSW'로 변경합니다.
    workboxPluginMode: 'GenerateSW', 
    workboxOptions: {
      // [핵심 수정] InjectManifest 대신, 생성될 서비스 워커에
      // 우리 F-CM 파일을 import하도록 설정합니다.
      importScripts: ['firebase-messaging-sw.js']
    }
  }
});
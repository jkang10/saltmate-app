const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  // 개발 서버 설정 (기존과 동일)
  devServer: {
    historyApiFallback: {
      rewrites: [
        { from: /^\/firebase-messaging-sw\.js$/, to: '/firebase-messaging-sw.js' }
      ]
    }
  },

  // PWA 플러그인 설정
  pwa: {
    name: 'Saltmate App',
    themeColor: '#007bff',
    msTileColor: '#000000',
    appleMobileWebAppCapable: 'yes',
    appleMobileWebAppStatusBarStyle: 'black',
    
    // 서비스 워커 생성 모드는 'GenerateSW'로 유지
    workboxPluginMode: 'GenerateSW', 
    workboxOptions: {
      // 생성될 서비스 워커에 FCM 스크립트를 import 하도록 설정 (기존과 동일)
      importScripts: ['firebase-messaging-sw.js'],
      
      // [핵심 추가] 아래 3줄의 코드를 추가합니다.
      // Firebase와 관련된 특정 경로는 서비스 워커가 캐싱하지 않고,
      // 네트워크 요청을 그대로 통과시키도록 예외 처리하여 카메라 충돌을 방지합니다.
      navigateFallbackDenylist: [
        /^\/firebase-cloud-messaging-push-scope/
      ]
    }
  }
});
const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  transpileDependencies: true,
  
  // 개발 서버 설정
  devServer: {
    historyApiFallback: {
      rewrites: [
        // 서비스 워커 파일은 index.html로 리디렉션되지 않도록 예외 처리
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
    
    // 서비스 워커 생성 모드를 'GenerateSW'로 설정
    workboxPluginMode: 'GenerateSW', 
    workboxOptions: {
      // 생성될 서비스 워커에 FCM 스크립트를 import 하도록 설정
      importScripts: ['firebase-messaging-sw.js']
    }
  }
});

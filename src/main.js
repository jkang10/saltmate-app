// 파일 경로: src/main.js

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
// [핵심] functions를 firebaseConfig에서 직접 import 합니다.
import { auth, functions } from "./firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
// [핵심] httpsCallable을 firebase/functions에서 직접 import 합니다.
import { httpsCallable } from "firebase/functions";

// ECharts 관련 코드는 그대로 둡니다.
import ECharts from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
// [핵심 수정] 경로를 'charts/echarts' -> 'echarts/charts'로 변경합니다.
import { GraphChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
// import './registerServiceWorker'

use([
  CanvasRenderer,
  GraphChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
]);

let app;

onAuthStateChanged(auth, () => {
  if (!app) {
    app = createApp(App);
    app.component("v-chart", ECharts);
    app.use(router).mount("#app");

    // [디버깅용 코드 추가] 아래 두 줄을 추가해주세요.
    // 앱이 사용하는 functions와 httpsCallable을 window 객체에 할당하여 콘솔에서 접근할 수 있게 합니다.
    window.f_functions = functions;
    window.f_httpsCallable = httpsCallable;
  }
});
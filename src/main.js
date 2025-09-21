// 파일 경로: src/main.js

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { auth } from "./firebaseConfig"; // [핵심] auth import 추가
import { onAuthStateChanged } from "firebase/auth"; // [핵심] onAuthStateChanged import 추가

// ECharts 관련 코드는 그대로 둡니다.
import ECharts from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { GraphChart } from "charts/echarts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import './registerServiceWorker'

use([
  CanvasRenderer,
  GraphChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
]);

// [핵심 수정] Firebase 인증 상태가 확인될 때까지 앱 실행을 보류합니다.
let app;

onAuthStateChanged(auth, () => {
  if (!app) {
    app = createApp(App);
    app.component("v-chart", ECharts);
    app.use(router).mount("#app");
  }
});
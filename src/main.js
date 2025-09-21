// 파일 경로: src/main.js

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { auth } from "./firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

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
import './registerServiceWorker'

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
  }
});
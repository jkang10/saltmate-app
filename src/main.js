// src/main.js

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

// ���� [�ű�] ECharts ���� �ڵ� �߰� ����
import ECharts from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { GraphChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";

use([
  CanvasRenderer,
  GraphChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
]);
// ���� ������� �߰� ����

const app = createApp(App);

app.component("v-chart", ECharts); // [�ű�] v-chart ������Ʈ ���� ���

app.use(router).mount("#app");

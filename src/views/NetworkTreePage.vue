<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-sitemap"></i> 네트워크</h1>
      <p class="description">
        <span v-if="isAdminView">전체 회원의 추천 네트워크를 확인합니다.</span>
        <span v-else
          >나를 기준으로 한 하위 추천 라인을 시각적으로 확인합니다.</span
        >
      </p>
    </header>

    <main class="content-wrapper card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>네트워크 데이터를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else class="chart-container">
        <v-chart
          class="chart"
          :option="chartOption"
          autoresize
          :init-options="{ renderer: 'canvas' }"
        />
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, reactive } from "vue";
import { auth, db } from "@/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import "echarts";
import VChart from "vue-echarts";

export default {
  name: "NetworkTreePage",
  components: {
    VChart,
  },
  setup() {
    const isLoading = ref(true);
    const error = ref(null);
    const chartOption = reactive({});
    const isAdminView = ref(false);

    const fetchAllNetworks = async () => {
      // (관리자용 코드는 변경 없음)
      const usersSnapshot = await getDocs(collection(db, "users"));
      const nodes = [];
      const links = [];
      const userMap = new Map();

      usersSnapshot.forEach((userDoc) => {
        const userData = { id: userDoc.id, ...userDoc.data() };
        userMap.set(userData.id, userData);
        const isRoot = !userData.uplineReferrer;
        nodes.push({
          id: userData.id,
          name: userData.name,
          value: userData.investmentAmount || 10000,
          symbolSize: isRoot
            ? 40
            : 15 + Math.log(userData.investmentAmount || 10000) * 2,
          category: isRoot ? "최상위" : "일반",
          label: { show: true, formatter: "{b}" },
          itemStyle: isRoot ? { borderColor: "#ffc107", borderWidth: 3 } : {},
        });
      });

      userMap.forEach((user) => {
        if (user.uplineReferrer && userMap.has(user.uplineReferrer)) {
          links.push({
            source: user.uplineReferrer,
            target: user.id,
          });
        }
      });
      setChartOption(nodes, links, ["최상위", "일반"]);
    };

    const fetchMyDownline = async (userId) => {
      const nodes = [];
      const links = [];

      const currentUserSnap = await getDoc(doc(db, "users", userId));
      if (!currentUserSnap.exists())
        throw new Error("사용자 정보를 찾을 수 없습니다.");
      const me = { id: currentUserSnap.id, ...currentUserSnap.data() };

      nodes.push({
        id: me.id,
        name: `${me.name} (나)`,
        value: me.investmentAmount || 10000,
        symbolSize: 50,
        category: 0,
        label: {
          show: true,
          formatter: "{b}",
          fontSize: 14,
          fontWeight: "bold",
        },
        itemStyle: { borderColor: "#ffc107", borderWidth: 3 },
      });

      // --- [핵심 수정] ---
      // 1. maxLevel 파라미터와 레벨 제한 로직을 제거하여 모든 하위 라인을 탐색
      const fetchRecursive = async (parentId, level) => {
        const q = query(
          collection(db, "users"),
          where("uplineReferrer", "==", parentId),
        );
        const querySnapshot = await getDocs(q);

        for (const userDoc of querySnapshot.docs) {
          const userData = { id: userDoc.id, ...userDoc.data() };
          nodes.push({
            id: userData.id,
            name: userData.name,
            value: userData.investmentAmount || 10000,
            symbolSize: 15 + Math.log(userData.investmentAmount || 10000) * 2,
            category: level,
            label: { show: true, formatter: "{b}" },
          });
          links.push({ source: parentId, target: userData.id });
          await fetchRecursive(userData.id, level + 1); // 다음 레벨을 재귀 호출
        }
      };

      // 2. 최대 레벨 제한 없이 함수 호출
      await fetchRecursive(me.id, 1);

      // 3. 깊은 레벨도 표시할 수 있도록 카테고리를 동적으로 생성 (최대 15대까지)
      const categories = ["나"];
      for (let i = 1; i < 15; i++) {
        categories.push(`${i}대`);
      }
      setChartOption(nodes, links, categories);
      // --- 수정 끝 ---
    };

    const buildNetworkTree = async () => {
      isLoading.value = true;
      if (!auth.currentUser) {
        error.value = "로그인이 필요합니다.";
        isLoading.value = false;
        return;
      }
      try {
        const currentUserProfile = await getDoc(
          doc(db, "users", auth.currentUser.uid),
        );
        const isAdmin =
          currentUserProfile.exists() && currentUserProfile.data().isAdmin;
        isAdminView.value = isAdmin;

        if (isAdmin) {
          await fetchAllNetworks();
        } else {
          await fetchMyDownline(auth.currentUser.uid);
        }
      } catch (e) {
        console.error("네트워크 트리 생성 오류:", e);
        error.value = "데이터를 불러오는 데 실패했습니다.";
      } finally {
        isLoading.value = false;
      }
    };

    const setChartOption = (nodes, links, categories) => {
      Object.assign(chartOption, {
        tooltip: {
          formatter: (params) => {
            if (params.dataType === "node") {
              return `<strong>${params.data.name}</strong><br/>투자금: ${params.data.value.toLocaleString()}원`;
            }
          },
        },
        legend: [
          {
            data: categories,
            textStyle: { color: "#333" },
            // [수정] 범례 위치 및 모양 설정
            orient: "vertical",
            left: "left",
            top: "top",
          },
        ],
        series: [
          {
            type: "graph",
            layout: "force",
            roam: true,
            draggable: true,
            categories: categories.map((c) => ({ name: c })),
            data: nodes,
            links: links,
            force: { repulsion: 200, edgeLength: 60, gravity: 0.1 },
            lineStyle: { color: "source", curveness: 0.1 },
          },
        ],
      });
    };

    onMounted(buildNetworkTree);

    return { isLoading, error, chartOption, isAdminView };
  },
};
</script>

<style scoped>
.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 70px auto 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.5em;
  color: #333;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  padding: 20px;
  min-height: 70vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
.loading-state,
.error-state {
  text-align: center;
  color: #666;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.chart-container {
  width: 100%;
  height: 65vh;
}
.chart {
  height: 100%;
  width: 100%;
}
</style>

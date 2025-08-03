<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-sitemap"></i> 나의 추천 네트워크</h1>
      <p class="description">
        나를 기준으로 한 하위 추천 라인을 시각적으로 확인합니다.
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
        <v-chart class="chart" :option="chartOption" autoresize />
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

export default {
  name: "NetworkTreePage",
  setup() {
    const isLoading = ref(true);
    const error = ref(null);
    const chartOption = reactive({});

    const nodes = [];
    const links = [];

    // 하위 라인 탐색 재귀 함수
    const fetchDownline = async (parentId, parentName, level, maxLevel) => {
      if (level > maxLevel) return;

      const q = query(
        collection(db, "users"),
        where("uplineReferrer", "==", parentId),
      );
      const querySnapshot = await getDocs(q);

      for (const userDoc of querySnapshot.docs) {
        const userData = { id: userDoc.id, ...userDoc.data() };

        // 노드 추가 (노드 크기는 투자금액에 비례하도록 설정)
        nodes.push({
          id: userData.id,
          name: userData.name,
          value: userData.investmentAmount || 10000,
          symbolSize: 15 + Math.log(userData.investmentAmount || 10000) * 2,
          category: level, // 레벨별로 카테고리(색상) 지정
          label: {
            show: true,
            formatter: "{b}", // 이름(b) 표시
          },
        });

        // 링크 추가
        links.push({
          source: parentId,
          target: userData.id,
        });

        // 다음 레벨 탐색
        await fetchDownline(userData.id, userData.name, level + 1, maxLevel);
      }
    };

    // 네트워크 데이터 빌드 메인 함수
    const buildNetworkTree = async () => {
      isLoading.value = true;
      if (!auth.currentUser) {
        error.value = "로그인이 필요합니다.";
        isLoading.value = false;
        return;
      }

      try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const currentUserSnap = await getDoc(currentUserRef);
        if (!currentUserSnap.exists()) {
          throw new Error("사용자 정보를 찾을 수 없습니다.");
        }

        const me = { id: currentUserSnap.id, ...currentUserSnap.data() };

        // 1. 루트 노드 (본인) 추가
        nodes.push({
          id: me.id,
          name: `${me.name} (나)`,
          value: me.investmentAmount || 10000,
          symbolSize: 50, // 본인은 더 크게 표시
          category: 0, // 카테고리 0번 (본인)
          label: {
            show: true,
            formatter: "{b}",
            fontSize: 14,
            fontWeight: "bold",
          },
          itemStyle: {
            borderColor: "#ffc107",
            borderWidth: 3,
          },
        });

        // 2. 하위 라인 데이터 불러오기 (최대 3레벨)
        await fetchDownline(me.id, me.name, 1, 3);

        // 3. 차트 옵션 설정
        setChartOption();
      } catch (e) {
        console.error("네트워크 트리 생성 오류:", e);
        error.value = "데이터를 불러오는 데 실패했습니다.";
      } finally {
        isLoading.value = false;
      }
    };

    const setChartOption = () => {
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
            data: ["나", "1대", "2대", "3대"],
            textStyle: { color: "#333" },
          },
        ],
        series: [
          {
            type: "graph",
            layout: "force",
            roam: true, // 확대/축소, 이동 가능
            draggable: true,
            categories: [
              { name: "나" },
              { name: "1대" },
              { name: "2대" },
              { name: "3대" },
            ],
            data: nodes,
            links: links,
            force: {
              repulsion: 200, // 노드 간 밀어내는 힘
              edgeLength: 60, // 간선 기본 길이
              gravity: 0.1,
            },
            lineStyle: {
              color: "source",
              curveness: 0.1,
            },
          },
        ],
      });
    };

    onMounted(buildNetworkTree);

    return {
      isLoading,
      error,
      chartOption,
    };
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

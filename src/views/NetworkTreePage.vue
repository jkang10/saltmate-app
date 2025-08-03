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
    const isAdminView = ref(false); // 관리자 뷰인지 여부

    // --- 관리자용: 전체 네트워크 생성 ---
    const fetchAllNetworks = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const nodes = [];
      const links = [];
      const userMap = new Map();

      // 1. 모든 사용자를 노드로 추가하고, Map에 저장
      usersSnapshot.forEach((userDoc) => {
        const userData = { id: userDoc.id, ...userDoc.data() };
        userMap.set(userData.id, userData);

        const isRoot = !userData.uplineReferrer; // 최상위 노드 여부
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

      // 2. 사용자들을 순회하며 링크 생성
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

    // --- 일반 사용자용: 내 하위 네트워크 생성 ---
    const fetchMyDownline = async (userId) => {
      const nodes = [];
      const links = [];

      const currentUserSnap = await getDoc(doc(db, "users", userId));
      if (!currentUserSnap.exists())
        throw new Error("사용자 정보를 찾을 수 없습니다.");

      const me = { id: currentUserSnap.id, ...currentUserSnap.data() };

      // 1. 루트 노드 (본인) 추가
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

      // 2. 하위 라인 데이터 재귀적으로 불러오기
      const fetchRecursive = async (parentId, level, maxLevel) => {
        if (level > maxLevel) return;
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
          await fetchRecursive(userData.id, level + 1, maxLevel);
        }
      };

      await fetchRecursive(me.id, 1, 3); // 최대 3레벨
      setChartOption(nodes, links, ["나", "1대", "2대", "3대"]);
    };

    // --- 메인 로직 ---
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
        isAdminView.value = isAdmin; // 관리자 뷰 여부 설정

        if (isAdmin) {
          await fetchAllNetworks(); // 관리자는 전체 네트워크 조회
        } else {
          await fetchMyDownline(auth.currentUser.uid); // 일반 사용자는 내 하위 네트워크 조회
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
        legend: [{ data: categories, textStyle: { color: "#333" } }],
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

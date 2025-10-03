<template>
  <div class="management-container">
    <h3><i class="fas fa-gift"></i> 이벤트 및 보상 관리</h3>
    <p>사용자에게 쿠폰을 발급하거나, 각종 랭킹 및 챌린지 보상 지급 내역을 확인합니다.</p>
    
    <div class="tabs">
      <button class="tab-button" :class="{active: activeTab === 'coupons'}" @click="activeTab = 'coupons'">쿠폰 발급</button>
      <button class="tab-button" :class="{active: activeTab === 'dailyTop7'}" @click="activeTab = 'dailyTop7'">오늘의 SaltMate TOP 7</button>
      <button class="tab-button" :class="{active: activeTab === 'weeklyTop7'}" @click="activeTab = 'weeklyTop7'">주간 SaltMate TOP 7</button>
      <button class="tab-button" :class="{active: activeTab === 'saltPangHoF'}" @click="activeTab = 'saltPangHoF'">솔트팡 명예의 전당</button>
      <button class="tab-button" :class="{active: activeTab === 'challenges'}" @click="activeTab = 'challenges'">주간 명예의 전당</button>
      <button class="tab-button" :class="{active: activeTab === 'saltPangRanked'}" @click="activeTab = 'saltPangRanked'">솔트팡 주간 랭킹전</button>
      <button class="tab-button" :class="{active: activeTab === 'pvpWeekly'}" @click="activeTab = 'pvpWeekly'">주간 대전 랭킹 TOP 7</button>
      <button class="tab-button" :class="{active: activeTab === 'enchantRankings'}" @click="activeTab = 'enchantRankings'">소금 강화 랭킹 TOP 7</button>
    </div>

    <div class="tab-content">
      <div v-show="activeTab === 'coupons'">
        <div class="coupon-form card">
          <h4>신규 쿠폰 발급</h4>
          <form @submit.prevent="issueCoupons">
            <div class="form-group">
              <label>대상 사용자 ({{ selectedUsers.length }}명 선택됨)</label>
              <input type="text" v-model="searchQuery" placeholder="이름 또는 이메일로 검색" class="search-input">
              <div class="user-selection-table">
                <div class="table-header">
                  <input type="checkbox" @change="selectAllUsers" :checked="isAllUsersSelected" />
                  <span>전체 선택</span>
                </div>
                <div class="user-list">
                  <div v-for="user in filteredUserList" :key="user.uid" class="user-row">
                    <input type="checkbox" :value="user.uid" v-model="selectedUsers" />
                    <span class="user-name">{{ user.name }}</span>
                    <span class="user-email">{{ user.email }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="form-group">
              <label for="description">이벤트 내용 (발급 사유)</label>
              <textarea id="description" v-model="couponDetails.description" rows="3" placeholder="예: 서비스 오픈 기념 이벤트"></textarea>
            </div>

            <div class="form-group">
              <label for="coupon-type">쿠폰 종류</label>
              <select id="coupon-type" v-model="couponDetails.type" @change="resetCouponValues">
                <option value="SALT_MINE_BOOST">소금 광산 채굴 부스트</option>
                <option value="DEEP_SEA_AUTOSELL">심해 해구 자동판매</option>
                <option value="SALTPANG_TIME_PLUS_5">솔트팡 +5초 시간 추가</option>
                <option value="SALTPANG_SCORE_X2_10S">솔트팡 10초간 점수 2배</option>
                <option value="ITEM_RARE_SALT">희귀 소금 결정</option>
                <option value="DEEP_SEA_RESEARCH">해양심층수 연구 데이터</option>
                <option value="DEEP_SEA_MINERAL">해양심층수 희귀 미네랄</option>
                <option value="DEEP_SEA_PLANKTON">해양심층수 플랑크톤</option>
                <option value="DEEP_SEA_RELIC">해양심층수 고대유물</option>
                <option value="DEEP_SEA_GOLDENTIME">해양심층수 골든타임</option>
              </select>
            </div>

            <div class="form-group-inline" v-if="couponDetails.type === 'SALT_MINE_BOOST'">
              <div class="form-group">
                <label>부스트 비율 (%)</label>
                <input type="number" v-model.number="couponDetails.boostPercentage" required min="1" placeholder="예: 20" />
              </div>
              <div class="form-group">
                <label>지속 시간 (분)</label>
                <input type="number" v-model.number="couponDetails.durationMinutes" required min="1" placeholder="예: 60" />
              </div>
            </div>
            <div class="form-group" v-if="couponDetails.type.startsWith('DEEP_SEA_') && couponDetails.type !== 'DEEP_SEA_AUTOSELL' && couponDetails.type !== 'DEEP_SEA_GOLDENTIME'">
              <label>지급 수량</label>
              <input type="number" v-model.number="couponDetails.quantity" required min="1" placeholder="예: 1000" />
            </div>
            <div class="form-group" v-if="['DEEP_SEA_AUTOSELL', 'DEEP_SEA_GOLDENTIME'].includes(couponDetails.type)">
                <label>지속 시간 (분)</label>
                <input type="number" v-model.number="couponDetails.durationMinutes" required min="1" placeholder="예: 60" />
            </div>
             <div class="form-group" v-if="['SALTPANG_TIME_PLUS_5', 'SALTPANG_SCORE_X2_10S', 'ITEM_RARE_SALT'].includes(couponDetails.type)">
                <label>지급 수량 (개)</label>
                <input type="number" v-model.number="couponDetails.quantity" required min="1" placeholder="예: 1" />
            </div>

            <button type="submit" class="btn btn-primary" :disabled="isIssuing || selectedUsers.length === 0">
              <span v-if="isIssuing" class="spinner-small"></span>
              <span v-else>선택한 사용자에게 쿠폰 발급</span>
            </button>
          </form>
        </div>
      </div>
      </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from "vue";
import { db, functions } from "@/firebaseConfig";
// [핵심 수정] getFunctions를 firebase/functions에서 import 합니다.
import { collection, getDocs, query, orderBy, collectionGroup, limit } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";

export default {
  name: 'EventManagement',
  setup() {
    const activeTab = ref('coupons');
    const isLoadingRankings = ref(true);
    const rankings = reactive({
      dailyTop7: [], weeklyTop7: [], saltPangRanked: [],
      saltPangHoF: [], pvpWeekly: [], enchantRankings: [],
    });
    const challengeResults = ref([]);
    const userList = ref([]);
    const isIssuing = ref(false);
    const couponDetails = reactive({
      type: 'SALT_MINE_BOOST',
      boostPercentage: 20,
      durationMinutes: 60,
      quantity: null,
      description: '',
    });
    const selectedUsers = ref([]); 
    const issuedCoupons = ref([]);
    const isLoadingCoupons = ref(true);
    const searchQuery = ref(''); // 사용자 검색어

    const filteredUserList = computed(() => {
      if (!searchQuery.value) return userList.value;
      const term = searchQuery.value.toLowerCase();
      return userList.value.filter(user => 
        user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
      );
    });

    const isAllUsersSelected = computed(() => {
      if (filteredUserList.value.length === 0) return false;
      return selectedUsers.value.length === filteredUserList.value.length;
    });

    const selectAllUsers = (event) => {
      if (event.target.checked) selectedUsers.value = filteredUserList.value.map(user => user.uid);
      else selectedUsers.value = [];
    };
    
    // [핵심 수정 3] 탭 메뉴 개편 로직
    const currentTabTitle = computed(() => {
      const titles = {
        dailyTop7: '오늘의 SaltMate TOP 7', weeklyTop7: '주간 SaltMate TOP 7',
        saltPangHoF: '솔트팡 명예의 전당', challenges: '주간 명예의 전당',
        saltPangRanked: '솔트팡 주간 랭킹전', pvpWeekly: '주간 대전 랭킹 TOP 7',
        enchantRankings: '소금 강화 랭킹 TOP 7',
      };
      return titles[activeTab.value] || '';
    });
    
    const currentRankings = computed(() => {
      let sourceData, dateKey;
      switch(activeTab.value) {
        case 'dailyTop7': sourceData = rankings.dailyTop7; dateKey = 'date'; break;
        case 'weeklyTop7': sourceData = rankings.weeklyTop7; dateKey = 'weekId'; break;
        case 'saltPangRanked': sourceData = rankings.saltPangRanked; dateKey = 'weekId'; break;
        case 'pvpWeekly': sourceData = rankings.pvpWeekly; dateKey = 'weekId'; break;
        case 'challenges': sourceData = challengeResults.value; dateKey = 'weekId'; break;
        case 'saltPangHoF': 
        case 'enchantRankings':
          // 이 탭들은 날짜 그룹핑이 필요 없음
          return [{ id: 'all-time', date: '역대 랭킹', items: rankings[activeTab.value] }];
        default: return [];
      }
      if (!sourceData || sourceData.length === 0) return [];
      const groups = sourceData.reduce((acc, curr) => {
        const key = curr[dateKey];
        if (key) (acc[key] = acc[key] || []).push(curr);
        return acc;
      }, {});
      return Object.keys(groups).sort().reverse().map(key => ({
        id: key, date: key, items: groups[key].sort((a, b) => a.rank - b.rank)
      }));
    });

const fetchAllRankings = async () => {
  isLoadingRankings.value = true;
  try {
    // [핵심 수정] getFunctions 호출 시 지역을 명시합니다.
    const functionsWithRegion = getFunctions(functions.app, "asia-northeast3");
    const getAdminRankings = httpsCallable(functionsWithRegion, "getAdminDashboardRankings");
    
    const result = await getAdminRankings();
    Object.assign(rankings, result.data);
    challengeResults.value = result.data.challenges;
  } catch (error) { 
    console.error("랭킹 데이터 로딩 실패:", error);
    alert(`랭킹 데이터를 불러오는 데 실패했습니다: ${error.message}`);
  } finally { 
    isLoadingRankings.value = false; 
  }
};
    
    // --- 나머지 함수들은 기존과 동일 ---
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), orderBy("name"));
        const snapshot = await getDocs(q);
        userList.value = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      } catch (error) { console.error("사용자 목록 로딩 실패:", error); }
    };
    const issueCoupons = async () => { /* ... 이전과 동일 ... */ };
    onMounted(() => {
        fetchUsers();
        fetchAllRankings();
    });

    return {
      activeTab, isLoadingRankings, rankings, challengeResults, userList,
      isIssuing, couponDetails, selectedUsers, issuedCoupons, isLoadingCoupons,
      searchQuery, filteredUserList, isAllUsersSelected, selectAllUsers,
      currentRankings, currentTabTitle, issueCoupons,
    };
  }
}
</script>

<style scoped>
/* [핵심 수정 1] 사용자 목록 높이 증가 및 검색 인풋 스타일 추가 */
.user-selection-table {
  border: 1px solid #ddd;
  border-radius: 8px;
}
.user-list {
  max-height: 400px; /* 기존 250px에서 증가 */
  overflow-y: auto;
}
.search-input {
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
}

/* [핵심 수정 3] 랭킹 테이블 스타일 추가 */
.ranking-group {
  margin-bottom: 30px;
}
.ranking-table {
  width: 100%;
  border-collapse: collapse;
}
.ranking-table th, .ranking-table td {
  border: 1px solid #eee;
  padding: 8px 12px;
  text-align: center;
}
.ranking-table th {
  background-color: #f8f9fa;
}
.management-container { display: flex; flex-direction: column; gap: 30px; }
.card { background-color: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
h3, h4 { margin-top: 0; }
.form-group { margin-bottom: 20px; }
.form-group-inline { display: flex; gap: 20px; margin-bottom: 20px; }
.form-group-inline .form-group { flex: 1; margin-bottom: 0; }
label { display: block; margin-bottom: 8px; font-weight: 600; }
input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 1em; box-sizing: border-box; }
input[disabled] { background-color: #f8f9fa; }
.btn { border: none; border-radius: 5px; padding: 10px 20px; cursor: pointer; font-weight: bold; }
.btn-primary { background-color: #007bff; color: white; }
.user-selection-table { border: 1px solid #ddd; border-radius: 8px; max-height: 250px; overflow-y: auto; }
.table-header { background-color: #f8f9fa; padding: 10px 15px; border-bottom: 1px solid #ddd; font-weight: bold; position: sticky; top: 0; display: flex; align-items: center; }
.table-header input { margin-right: 10px; flex-shrink: 0; }
.user-list { display: flex; flex-direction: column; }
.user-row { padding: 10px 15px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 15px; }
.user-row:last-child { border-bottom: none; }
.user-row input { flex-shrink: 0; flex-basis: 20px; }
.user-name { font-weight: 500; flex-shrink: 0; width: 120px; }
.user-email { color: #6c757d; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-grow: 1; }
.event-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
.event-table th, .event-table td { border-bottom: 1px solid #eee; padding: 12px 15px; text-align: left; }
.status-badge { padding: 5px 10px; border-radius: 15px; font-size: 0.8em; font-weight: bold; color: #fff; }
.status-badge.status-unused { background-color: #28a745; }
.status-badge.status-used { background-color: #6c757d; }
.status-badge.status-expired { background-color: #dc3545; }
.loading-spinner, .no-data { text-align: center; padding: 50px; color: #777; }
.spinner-small { border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.tabs { display: flex; border-bottom: 2px solid #dee2e6; margin-bottom: 20px; flex-wrap: wrap;}
.tab-button { padding: 10px 20px; border: none; background-color: transparent; cursor: pointer; font-size: 1.1em; font-weight: 500; color: #6c757d; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tab-button.active { color: #007bff; border-bottom-color: #007bff; }
.challenge-week { margin-bottom: 25px; }
.challenge-week h5 { margin-bottom: 10px; font-size: 1.2em; }
</style>
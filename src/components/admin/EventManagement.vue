<template>
  <div class="management-container">
    <h3><i class="fas fa-gift"></i> 이벤트 및 보상 관리</h3>
    <p>사용자에게 쿠폰을 발급하거나, 각종 랭킹 및 챌린지 보상 지급 내역을 확인합니다.</p>
    
    <div class="tabs">
      <button class="tab-button" :class="{active: activeTab === 'coupons'}" @click="activeTab = 'coupons'">쿠폰 발급</button>
      <button class="tab-button" :class="{active: activeTab === 'challenges'}" @click="activeTab = 'challenges'">주간 명예의 전당</button>
      <button class="tab-button" :class="{active: activeTab === 'dailyTop7'}" @click="activeTab = 'dailyTop7'">오늘의 TOP 7</button>
      <button class="tab-button" :class="{active: activeTab === 'weeklyTop7'}" @click="activeTab = 'weeklyTop7'">주간 TOP 7</button>
      <button class="tab-button" :class="{active: activeTab === 'saltPangRanked'}" @click="activeTab = 'saltPangRanked'">솔트팡 랭킹전</button>
    </div>

    <div class="tab-content">
      <div v-show="activeTab === 'coupons'">
        <div class="coupon-form card">
          <h4>신규 쿠폰 발급</h4>
          <form @submit.prevent="issueCoupons">
            <div class="form-group">
              <label>대상 사용자 ({{ selectedUsers.length }}명 선택됨)</label>
              <div class="user-selection-table">
                <div class="table-header">
                  <input type="checkbox" @change="selectAllUsers" :checked="isAllUsersSelected" />
                  <span>전체 선택</span>
                </div>
                <div class="user-list">
                  <div v-for="user in userList" :key="user.id" class="user-row">
                    <input type="checkbox" :value="user.id" v-model="selectedUsers" />
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
              <input type="text" id="coupon-type" value="소금 광산 채굴 부스트" disabled />
            </div>
            <div class="form-group-inline">
              <div class="form-group">
                <label for="boost-percentage">부스트 비율 (%)</label>
                <select id="boost-percentage" v-model="couponDetails.boostPercentage" required>
                  <option value="20">20%</option><option value="40">40%</option><option value="60">60%</option>
                  <option value="80">80%</option><option value="100">100%</option>
                </select>
              </div>
              <div class="form-group">
                <label for="duration">지속 시간 (분)</label>
                <input type="number" id="duration" v-model="couponDetails.durationMinutes" required min="1" placeholder="예: 60" />
              </div>
            </div>
            <button type="submit" class="btn btn-primary" :disabled="isIssuing || selectedUsers.length === 0">
              <span v-if="isIssuing" class="spinner-small"></span>
              <span v-else>선택한 사용자에게 쿠폰 발급</span>
            </button>
          </form>
        </div>
        <div class="coupon-list-container card">
            <h4><i class="fas fa-history"></i> 발급된 쿠폰 내역</h4>
            <div v-if="isLoadingCoupons" class="loading-spinner"></div>
            <table v-else-if="issuedCoupons.length > 0" class="event-table">
                <thead><tr><th>발급 대상</th><th>이벤트 내용</th><th>효과</th><th>상태</th><th>발급일</th><th>만료일</th></tr></thead>
                <tbody>
                    <tr v-for="coupon in issuedCoupons" :key="coupon.id">
                        <td>{{ coupon.userName }}</td><td>{{ coupon.description }}</td>
                        <td>+{{ coupon.boostPercentage }}% ({{ coupon.durationMinutes }}분)</td>
                        <td><span class="status-badge" :class="`status-${coupon.status}`">{{ formatCouponStatus(coupon.status) }}</span></td>
                        <td>{{ formatDate(coupon.issuedAt) }}</td><td>{{ formatDate(coupon.expiresAt) }}</td>
                    </tr>
                </tbody>
            </table>
            <div v-else class="no-data"><p>아직 발급된 쿠폰이 없습니다.</p></div>
        </div>
      </div>
      
      <div v-show="activeTab === 'challenges'" class="card">
        <h4><i class="fas fa-trophy"></i> 명예의 전당 (주간 챌린지) 보상 내역</h4>
        <div v-if="isLoadingRankings" class="loading-spinner"></div>
        <div v-else-if="groupedChallenges.length > 0">
          <div v-for="(week, index) in groupedChallenges" :key="index" class="challenge-week">
            <h5>{{ week.weekId }} 주차</h5>
            <table class="event-table">
              <thead><tr><th>챌린지</th><th>순위</th><th>사용자</th><th>기록</th><th>보상</th></tr></thead>
              <tbody>
                <tr v-for="result in week.results" :key="result.id">
                  <td>{{ formatChallengeId(result.challengeId) }}</td>
                  <td>{{ result.rank }} 위</td>
                  <td>{{ result.userName }}</td>
                  <td>{{ (result.score || 0).toLocaleString() }}</td>
                  <td>{{ (result.reward || 0).toLocaleString() }} SaltMate</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="no-data"><p>챌린지 결과 기록이 없습니다.</p></div>
      </div>
      
      <div v-show="['dailyTop7', 'weeklyTop7', 'saltPangRanked'].includes(activeTab)" class="card">
        <div v-if="isLoadingRankings" class="loading-spinner"></div>
        <div v-else-if="currentRankings.length > 0">
           <h4>{{ currentTabTitle }} 보상 지급 내역 (최근 기록)</h4>
           <table class="event-table">
             <thead><tr><th>주차/일자</th><th>순위</th><th>사용자</th><th>점수/기록</th><th>보상</th><th>지급일</th></tr></thead>
             <tbody>
               <tr v-for="item in currentRankings" :key="item.id">
                 <td>{{ item.weekId || item.date }}</td>
                 <td>{{ item.rank }} 위</td>
                 <td>{{ item.userName }}</td>
                 <td>{{ (item.score || item.totalWinnings || 0).toLocaleString() }}</td>
                 <td>{{ (item.reward || 0).toLocaleString() }} SaltMate</td>
                 <td>{{ formatDate(item.awardedAt) }}</td>
               </tr>
             </tbody>
           </table>
        </div>
        <div v-else class="no-data"><p>보상 지급 내역이 없습니다.</p></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from "vue";
import { db, functions } from "@/firebaseConfig";
import { collection, getDocs, query, orderBy, collectionGroup, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const activeTab = ref('coupons');
const isLoadingRankings = ref(true);
const rankings = reactive({
  dailyTop7: [], weeklyTop7: [], saltPangRanked: []
});
const challengeResults = ref([]);

const userList = ref([]);
const isIssuing = ref(false);
const couponDetails = reactive({
  boostPercentage: 20,
  durationMinutes: 60,
  description: '',
});
const selectedUsers = ref([]); 
const issuedCoupons = ref([]);
const isLoadingCoupons = ref(true);

const isAllUsersSelected = computed(() => userList.value.length > 0 && selectedUsers.value.length === userList.value.length);

const groupedChallenges = computed(() => {
  const groups = challengeResults.value.reduce((acc, curr) => {
    (acc[curr.weekId] = acc[curr.weekId] || []).push(curr);
    return acc;
  }, {});
  return Object.keys(groups).sort().reverse().map(weekId => ({
    weekId,
    results: groups[weekId].sort((a, b) => a.challengeId.localeCompare(b.challengeId) || a.rank - b.rank)
  }));
});

const currentRankings = computed(() => {
  switch(activeTab.value) {
    case 'dailyTop7': return rankings.dailyTop7;
    case 'weeklyTop7': return rankings.weeklyTop7;
    case 'saltPangRanked': return rankings.saltPangRanked;
    default: return [];
  }
});

const currentTabTitle = computed(() => {
    const titles = {
        dailyTop7: '오늘의 TOP 7', weeklyTop7: '주간 TOP 7',
        saltPangRanked: '솔트팡 랭킹전'
    };
    return titles[activeTab.value] || '';
});

const selectAllUsers = (event) => {
    if (event.target.checked) selectedUsers.value = userList.value.map(user => user.id);
    else selectedUsers.value = [];
};

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "N/A";
  return timestamp.toDate().toLocaleString("ko-KR");
};

const formatCouponStatus = (status) => ({ unused: '미사용', used: '사용 완료', expired: '기간 만료' }[status] || status);
const formatChallengeId = (id) => ({ saltKing: '주간 소금왕', seaExplorer: '주간 해양탐험가' }[id] || id);

const fetchUsers = async () => {
  try {
    const q = query(collection(db, "users"), orderBy("name"));
    const snapshot = await getDocs(q);
    userList.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) { console.error("사용자 목록 로딩 실패:", error); }
};

const fetchIssuedCoupons = async () => {
    isLoadingCoupons.value = true;
    try {
        const q = query(collectionGroup(db, 'coupons'), orderBy('issuedAt', 'desc'), limit(50));
        const couponSnapshot = await getDocs(q);
        const usersSnapshot = await getDocs(collection(db, "users"));
        const userMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data().name]));
        issuedCoupons.value = couponSnapshot.docs.map(doc => {
            const userId = doc.ref.parent.parent.id;
            return { id: doc.id, ...doc.data(), userName: userMap.get(userId) || '알 수 없음' };
        });
    } catch (error) { console.error("발급된 쿠폰 목록 로딩 실패:", error); } 
    finally { isLoadingCoupons.value = false; }
};

const fetchAllRankings = async () => {
    isLoadingRankings.value = true;
    try {
        // [핵심 수정] collectionGroup 쿼리를 서버 함수로 이전합니다.
        const getAdminRankings = httpsCallable(functions, "getAdminDashboardRankings");
        const result = await getAdminRankings();
        
        rankings.dailyTop7 = result.data.dailyTop7;
        rankings.weeklyTop7 = result.data.weeklyTop7;
        challengeResults.value = result.data.challenges;
        rankings.saltPangRanked = result.data.saltPangRanked;

    } catch (error) { 
        console.error("랭킹 데이터 로딩 실패:", error); 
        alert(`랭킹 데이터를 불러오는 데 실패했습니다. Firestore 보안 규칙을 확인해주세요. (${error.message})`);
    } 
    finally { isLoadingRankings.value = false; }
};

const issueCoupons = async () => {
  if (selectedUsers.value.length === 0) return alert("쿠폰을 발급할 사용자를 선택해주세요.");
  if (!couponDetails.description) return alert("이벤트 내용을 입력해주세요.");
  if (!confirm(`${selectedUsers.value.length}명의 사용자에게 쿠폰을 발급하시겠습니까?`)) return;
  
  isIssuing.value = true;
  try {
    const issueCouponsToUser = httpsCallable(functions, "issueCouponsToUser");
    const result = await issueCouponsToUser({
      userIds: selectedUsers.value, couponType: 'SALT_MINE_BOOST',
      boostPercentage: couponDetails.boostPercentage, durationMinutes: couponDetails.durationMinutes,
      description: couponDetails.description,
    });
    alert(result.data.message);
    selectedUsers.value = []; 
    await fetchIssuedCoupons();
  } catch (error) { console.error("쿠폰 발급 실패:", error); alert(`오류: ${error.message}`); } 
  finally { isIssuing.value = false; }
};

onMounted(() => {
    fetchUsers();
    fetchIssuedCoupons();
    fetchAllRankings();
});
</script>

<style scoped>
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
.table-header input { margin-right: 10px; }
.user-list { 
  display: flex;
  flex-direction: column;
}
.user-row {
  padding: 10px 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
}
.user-row:last-child {
  border-bottom: none;
}
.user-row input {
  flex-shrink: 0;
  margin-right: 15px; /* 체크박스와 이름 사이 간격 */
}
.user-name {
  font-weight: 500;
  flex-shrink: 0; /* 이름 너비 고정 */
  width: 120px; /* 이름 너비 지정 */
}
.user-email {
  color: #6c757d;
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
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
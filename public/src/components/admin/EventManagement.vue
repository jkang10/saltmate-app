<template>
  <div class="management-container">
    <h3><i class="fas fa-calendar-alt"></i> 이벤트 관리</h3>
    <p>새로운 이벤트를 생성하고 당첨자를 관리합니다.</p>

    <div class="event-form card">
      <h4>새 이벤트 생성</h4>
      <form @submit.prevent="createEvent">
        <div class="form-group">
          <label for="title">이벤트 제목</label>
          <input
            type="text"
            id="title"
            v-model="newEvent.title"
            placeholder="이벤트 제목"
            required
          />
        </div>
        <div class="form-group">
          <label for="description">이벤트 설명</label>
          <textarea
            id="description"
            v-model="newEvent.description"
            rows="4"
            placeholder="이벤트 상세 내용"
            required
          ></textarea>
        </div>
        <div class="form-group-inline">
          <div class="form-group">
            <label for="startDate">시작일</label>
            <input type="date" id="startDate" v-model="newEvent.startDate" required />
          </div>
          <div class="form-group">
            <label for="endDate">종료일</label>
            <input type="date" id="endDate" v-model="newEvent.endDate" required />
          </div>
        </div>
        <button type="submit" class="btn btn-primary">이벤트 생성</button>
      </form>
    </div>

    <div class="event-list card">
      <h4>이벤트 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="events.length > 0" class="event-table">
        <thead>
          <tr>
            <th>제목</th>
            <th>기간</th>
            <th>상태</th>
            <th>당첨자</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.id">
            <td>{{ event.title }}</td>
            <td>{{ formatDate(event.startDate) }} ~ {{ formatDate(event.endDate) }}</td>
            <td>
              <span :class="`status-badge status-${getEventStatus(event)}`">
                {{ getEventStatusText(getEventStatus(event)) }}
              </span>
            </td>
            <td>{{ event.winnerName || '미선정' }}</td>
            <td>
              <button
                v-if="getEventStatus(event) === 'ended' && !event.winnerId"
                @click="selectWinner(event.id)"
                class="btn btn-sm btn-success"
              >
                당첨자 선정
              </button>
              <button @click="deleteEvent(event.id)" class="btn btn-sm btn-danger">
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">생성된 이벤트가 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { db } from '@/firebaseConfig';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
  orderBy,
  query,
} from 'firebase/firestore';

const events = ref([]);
const loading = ref(true);
const newEvent = reactive({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
});

// --- Helper Functions ---
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleDateString('ko-KR');
};

const getEventStatus = (event) => {
  const now = new Date();
  const start = event.startDate.toDate();
  const end = event.endDate.toDate();
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'ongoing';
};

const getEventStatusText = (status) => {
  const statusMap = {
    upcoming: '진행 예정',
    ongoing: '진행중',
    ended: '종료',
  };
  return statusMap[status] || status;
};


// --- Firestore Functions ---
const fetchEvents = async () => {
  loading.value = true;
  try {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, orderBy('startDate', 'desc'));
    const querySnapshot = await getDocs(q);
    events.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('이벤트 목록을 불러오는 중 오류 발생:', error);
  } finally {
    loading.value = false;
  }
};

const createEvent = async () => {
  if (!newEvent.title || !newEvent.description || !newEvent.startDate || !newEvent.endDate) {
    alert('모든 필드를 입력해주세요.');
    return;
  }
  try {
    await addDoc(collection(db, 'events'), {
      ...newEvent,
      startDate: Timestamp.fromDate(new Date(newEvent.startDate)),
      endDate: Timestamp.fromDate(new Date(newEvent.endDate)),
      winnerId: null,
      winnerName: null,
    });
    alert('이벤트가 성공적으로 생성되었습니다.');
    Object.assign(newEvent, { title: '', description: '', startDate: '', endDate: '' });
    await fetchEvents();
  } catch (error) {
    console.error('이벤트 생성 중 오류 발생:', error);
  }
};

const deleteEvent = async (eventId) => {
  if (!confirm('정말로 이 이벤트를 삭제하시겠습니까?')) return;
  try {
    await deleteDoc(doc(db, 'events', eventId));
    alert('이벤트가 삭제되었습니다.');
    await fetchEvents();
  } catch (error) {
    console.error('이벤트 삭제 중 오류 발생:', error);
  }
};

const selectWinner = async (eventId) => {
  if (!confirm('이벤트 당첨자를 무작위로 선정하시겠습니까?')) return;
  
  // 실제 운영 환경에서는 이벤트 참여자 목록에서 추첨해야 합니다.
  // 여기서는 임시로 전체 사용자 중 한 명을 무작위로 선택합니다.
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (allUsers.length === 0) {
      alert('추첨할 사용자가 없습니다.');
      return;
    }
    
    const winner = allUsers[Math.floor(Math.random() * allUsers.length)];
    
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      winnerId: winner.id,
      winnerName: winner.name,
    });

    alert(`당첨자가 선정되었습니다: ${winner.name}`);
    await fetchEvents();
  } catch (error) {
    console.error('당첨자 선정 중 오류 발생:', error);
    alert('당첨자 선정에 실패했습니다.');
  }
};

onMounted(fetchEvents);
</script>

<style scoped>
/* 이전 컴포넌트들과 유사한 스타일 */
.management-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3, h4 {
  margin-top: 0;
}

/* 이벤트 생성 폼 */
.event-form .form-group {
  margin-bottom: 20px;
}
.event-form .form-group-inline {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}
.event-form .form-group-inline .form-group {
  flex: 1;
  margin-bottom: 0;
}
.event-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
.event-form input,
.event-form textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1em;
  box-sizing: border-box;
}

/* 이벤트 목록 테이블 */
.event-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.event-table th,
.event-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
}

/* 상태 배지 */
.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
}
.status-ongoing { background-color: #28a745; }
.status-ended { background-color: #6c757d; }
.status-upcoming { background-color: #17a2b8; }

/* 공용 버튼 및 로딩 스타일 */
.btn {
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary { background-color: #007bff; color: white; }
.btn-danger { background-color: #dc3545; color: white; }
.btn-success { background-color: #28a745; color: white; }
.btn-sm { padding: 5px 10px; font-size: 0.85em; margin-right: 5px;}
.loading-spinner, .no-data {
  text-align: center;
  padding: 50px;
  color: #777;
}
.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #007bff;
  animation: spin 1s ease infinite;
  margin: 50px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
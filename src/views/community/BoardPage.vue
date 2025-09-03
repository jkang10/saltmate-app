<template>
  <div class="board-page">
    <header class="board-header">
      <h2><i :class="boardIcon"></i> {{ boardTitle }}</h2>
      <router-link v-if="canWritePost" to="/community/write" class="write-post-button">
        <i class="fas fa-pen"></i> 글쓰기
      </router-link>
    </header>

    <div v-if="loading" class="loading-spinner"></div>
    <div v-else-if="posts.length > 0" class="post-list-container">
      <ul class="posts">
        <li v-for="post in posts" :key="post.id" class="post-item">
          <router-link :to="`/community/post/${post.id}`" class="post-link">
            <span class="post-title">{{ post.title }}</span>
            <span class="post-meta">
              <span class="post-author">{{ post.authorName }}</span> |
              <span class="post-date">{{ formatDate(post.createdAt) }}</span> |
              <span class="post-views">조회 {{ post.views }}</span>
            </span>
          </router-link>
        </li>
      </ul>
    </div>
    <div v-else class="no-posts">
      아직 게시글이 없습니다.
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineProps } from 'vue';
import { db, auth } from '@/firebaseConfig'; // [수정] auth import 추가
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const props = defineProps({
  category: {
    type: String,
    required: true,
  },
});

const posts = ref([]);
const loading = ref(true);
const isAdmin = ref(false); // [신규 추가] 관리자 여부 상태

const boardInfo = {
  notices: { title: '공지사항', icon: 'fas fa-bullhorn' },
  payment_requests: { title: '구독/등급 입금승인요청', icon: 'fas fa-file-invoice-dollar' },
  bug_reports: { title: '버그 알리기', icon: 'fas fa-bug' },
  'nft-bids': { title: 'NFT 입찰 정보', icon: 'fas fa-gavel' },
  'equity-info': { title: '지분 공지 정보', icon: 'fas fa-chart-pie' },
  'salt-tech': { title: '소금 기술 이야기', icon: 'fas fa-flask' },
  'solein-tech': { title: '스마트 솔레인 테크', icon: 'fas fa-microchip' },
  'deep-sea-water': { title: '해양 심층수', icon: 'fas fa-water' },
  default: { title: '게시판', icon: 'fas fa-comments' },
};

// [신규 추가] 글쓰기 버튼 표시 여부를 결정하는 computed 속성
const canWritePost = computed(() => {
  // 일반 회원이 글을 쓸 수 있는 게시판 목록
  const userWritableBoards = ['payment_requests', 'bug_reports'];
  
  if (userWritableBoards.includes(props.category)) {
    return true; // 입금승인, 버그알리기 게시판은 누구나 글쓰기 가능
  }
  
  // 나머지 게시판은 관리자만 글쓰기 가능
  return isAdmin.value;
});

const boardTitle = computed(() => {
  return boardInfo[props.category]?.title || boardInfo.default.title;
});
const boardIcon = computed(() => {
  return boardInfo[props.category]?.icon || boardInfo.default.icon;
});

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return '';
  return timestamp.toDate().toLocaleDateString('ko-KR');
};

const fetchPosts = async () => {
  loading.value = true;
  try {
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('category', '==', props.category),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    posts.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("게시글 로딩 오류:", error);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  // [신규 추가] 컴포넌트 마운트 시 관리자 여부 확인
  const user = auth.currentUser;
  if (user) {
    const idTokenResult = await user.getIdTokenResult();
    isAdmin.value = idTokenResult.claims.admin === true;
  }
  await fetchPosts();
});
</script>

<style scoped>
/* (기존 스타일과 동일) */
.board-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
}
.board-header h2 {
  font-size: 1.8em;
  color: #34495e;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.write-post-button {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.3s ease;
}
.write-post-button:hover {
  background-color: #218838;
}
.posts {
  list-style: none;
  padding: 0;
}
.post-item {
  margin-bottom: 12px;
  background-color: rgba(255, 255, 255, 0.4);
  padding: 15px 20px;
  border-radius: 8px;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
}
.post-item:hover {
  background-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-3px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}
.post-link {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: #333;
}
.post-title {
  font-size: 1.1em;
  font-weight: bold;
  margin-bottom: 5px;
  color: #34495e;
}
.post-meta {
  font-size: 0.85em;
  color: #777;
}
.no-posts {
  text-align: center;
  color: #888;
  padding: 30px;
  font-style: italic;
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
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
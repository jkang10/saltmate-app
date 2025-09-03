<template>
  <div class="post-write-page">
    <div class="write-container card">
      <header class="write-header">
        <h1>새 글 작성</h1>
      </header>
      <main class="write-form">
        <div class="form-group">
          <label for="category">게시판 선택</label>
          <select id="category" v-model="post.category">
            <option disabled value="">게시판을 선택하세요</option>
            <!-- [수정] 관리자가 아닐 경우 공지사항 선택 불가 -->
            <option v-if="isAdmin" value="notices">공지사항</option>
            <option value="payment_requests">구독/등급 입금승인요청</option>
            <option value="bug_reports">버그 알리기</option>
            <option value="freeboard">자유게시판</option>
          </select>
        </div>
        <div class="form-group">
          <label for="title">제목</label>
          <input type="text" id="title" v-model="post.title" placeholder="제목을 입력하세요" />
        </div>
        <div class="form-group">
          <label for="content">내용</label>
          <textarea id="content" v-model="post.content" rows="15" placeholder="내용을 입력하세요"></textarea>
        </div>
        <div class="form-actions">
          <button @click="submitPost" class="btn btn-primary" :disabled="isSubmitting">
            <span v-if="isSubmitting">등록 중...</span>
            <span v-else>글 등록</span>
          </button>
          <router-link to="/community" class="btn btn-secondary">취소</router-link>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const router = useRouter();
const post = reactive({
  category: '',
  title: '',
  content: '',
});
const isAdmin = ref(false);
const isSubmitting = ref(false);

const submitPost = async () => {
  if (!post.category || !post.title.trim() || !post.content.trim()) {
    alert('게시판, 제목, 내용을 모두 입력해주세요.');
    return;
  }
  isSubmitting.value = true;
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'posts'), {
      authorId: user.uid,
      authorName: user.displayName || user.email,
      category: post.category,
      title: post.title,
      content: post.content,
      createdAt: serverTimestamp(),
      views: 0,
    });
    alert('게시글이 성공적으로 등록되었습니다.');
    router.push(`/community/${post.category}`);
  } catch (error) {
    console.error("게시글 등록 오류:", error);
    alert('게시글 등록에 실패했습니다.');
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(async () => {
  const user = auth.currentUser;
  if (user) {
    const idTokenResult = await user.getIdTokenResult();
    isAdmin.value = idTokenResult.claims.admin === true;
  }
});
</script>

<style scoped>
.post-write-page {
  max-width: 900px;
  margin: 40px auto;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.write-header h1 {
  font-size: 2em;
  margin: 0 0 25px;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  box-sizing: border-box;
}
.form-group textarea {
  resize: vertical;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}
.btn {
  border: none;
  border-radius: 8px;
  padding: 12px 25px;
  cursor: pointer;
  font-weight: bold;
  text-decoration: none;
  transition: background-color 0.3s;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
</style>

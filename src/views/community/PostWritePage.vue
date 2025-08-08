<template>
  <div class="write-page">
    <header class="page-header">
      <h1>게시글 작성</h1>
    </header>
    <main class="write-content card">
      <div class="form-group">
        <label>게시판</label>
        <input type="text" :value="boardTitle" disabled />
      </div>
      <div class="form-group">
        <label for="title">제목</label>
        <input
          type="text"
          id="title"
          v-model="title"
          placeholder="제목을 입력하세요"
        />
      </div>
      <div class="form-group">
        <label for="content">내용</label>
        <textarea
          id="content"
          v-model="content"
          rows="15"
          placeholder="내용을 입력하세요"
        ></textarea>
      </div>
      <div class="form-actions">
        <button @click="$router.go(-1)" class="btn-secondary">취소</button>
        <button @click="submitPost" class="btn-primary">등록하기</button>
      </div>
    </main>
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";

export default {
  name: "PostWritePage",
  data() {
    return {
      title: "",
      content: "",
      category: this.$route.query.category,
      boardInfo: {
        /* Board.vue와 동일한 boardInfo 객체 */
      },
    };
  },
  computed: {
    boardTitle() {
      return this.boardInfo[this.category]?.title || "게시판";
    },
  },
  methods: {
    async submitPost() {
      if (!this.title || !this.content) {
        alert("제목과 내용을 모두 입력해주세요.");
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));

        await addDoc(collection(db, "posts"), {
          title: this.title,
          content: this.content,
          category: this.category,
          authorId: user.uid,
          authorName: userSnap.exists() ? userSnap.data().name : "익명",
          createdAt: serverTimestamp(),
          views: 0,
        });

        alert("게시글이 등록되었습니다.");
        this.$router.push(`/community/${this.category}`);
      } catch (error) {
        console.error("게시글 등록 오류:", error);
        alert("게시글 등록에 실패했습니다.");
      }
    },
  },
};
</script>

<style scoped>
.write-page {
  max-width: 800px;
  margin: 70px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.card {
  padding: 30px;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
}
.form-group input[disabled] {
  background-color: #f8f9fa;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}
.btn-primary,
.btn-secondary {
  /* 버튼 스타일 */
}
</style>

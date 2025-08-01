<template>
  <div class="write-post-page">
    <header class="page-header">
      <h1>
        <i class="fas fa-edit"></i>
        {{ isEditMode ? "게시글 수정" : "새 게시글 작성" }}
      </h1>
      <p class="description">
        {{
          isEditMode
            ? "게시글 내용을 수정합니다."
            : "새로운 게시글을 작성해주세요."
        }}
      </p>
    </header>

    <main class="write-form-container card glassmorphism">
      <form @submit.prevent="submitPost" class="post-form">
        <div class="form-group">
          <label for="post-category">게시판 선택:</label>
          <select id="post-category" v-model="postCategory" required>
            <option value="">게시판을 선택하세요</option>
            <option value="free">자유 게시판</option>
            <option value="questions">질문 게시판</option>
            <option value="reviews">투자 후기</option>
          </select>
        </div>

        <div class="form-group">
          <label for="post-title">제목:</label>
          <input
            type="text"
            id="post-title"
            v-model="postTitle"
            placeholder="제목을 입력하세요"
            required
          />
        </div>

        <div class="form-group">
          <label for="post-content">내용:</label>
          <textarea
            id="post-content"
            v-model="postContent"
            placeholder="내용을 입력하세요..."
            required
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="cancel-button" @click="cancelEdit">
            <i class="fas fa-times"></i> 취소
          </button>
          <button type="submit" class="submit-button">
            <i class="fas fa-paper-plane"></i>
            {{ isEditMode ? "수정 완료" : "작성 완료" }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
// Firebase 관련 임포트 (필요 시 추가)
// import { auth, db } from '@/firebaseConfig';
import { Timestamp } from "firebase/firestore"; // Timestamp만 남겨둠

export default {
  name: "WritePostPage",
  setup() {
    const route = useRoute();
    const router = useRouter();

    const postId = ref(null);
    const isEditMode = ref(false);
    const postCategory = ref("");
    const postTitle = ref("");
    const postContent = ref("");

    // 임시 게시글 데이터 (수정 모드 테스트용)
    const mockPostData = {
      101: {
        category: "free",
        title: "수정할 게시글 제목입니다.",
        content: "이것은 수정될 게시글의 내용입니다.",
      },
    };

    onMounted(async () => {
      // URL 쿼리 파라미터에서 게시글 ID 확인 (수정 모드 진입 시)
      const id = route.query.id;
      if (id) {
        postId.value = id;
        isEditMode.value = true;
        await fetchPostForEdit(id);
      }
    });

    const fetchPostForEdit = async (id) => {
      // 실제 Firebase Firestore에서 해당 ID의 게시글을 가져올 경우 다음 주석을 해제하고 사용합니다.
      // import { doc, getDoc } from 'firebase/firestore';
      // const docRef = doc(db, "posts", id);
      // const docSnap = await getDoc(docRef);
      // if (docSnap.exists()) {
      //   const data = docSnap.data();
      //   postCategory.value = data.category;
      //   postTitle.value = data.title;
      //   postContent.value = data.content;
      // } else {
      //   alert("수정할 게시글을 찾을 수 없습니다.");
      //   router.push('/community/free');
      // }

      // 임시 데이터 사용
      const data = mockPostData[id];
      if (data) {
        postCategory.value = data.category;
        postTitle.value = data.title;
        postContent.value = data.content;
      } else {
        alert("수정할 게시글을 찾을 수 없습니다.");
        router.push("/community/free");
      }
    };

    const submitPost = async () => {
      const user = {
        uid: "currentUser123",
        email: "user@example.com",
        displayName: "현재 사용자",
      }; // 실제 Firebase Auth 사용자 객체로 변경
      if (!user) {
        alert("로그인 후 게시글을 작성할 수 있습니다.");
        router.push("/login");
        return;
      }

      const postData = {
        category: postCategory.value,
        title: postTitle.value,
        content: postContent.value,
        author: user.displayName || user.email || "익명",
        authorUid: user.uid,
        updatedAt: Timestamp.now(), // Firestore Timestamp
      };

      if (isEditMode.value) {
        // 게시글 수정 로직 (실제 Firebase 연동 시 updateDoc 사용)
        try {
          // import { doc, updateDoc } from 'firebase/firestore';
          // await updateDoc(doc(db, "posts", postId.value), postData);
          alert("게시글이 성공적으로 수정되었습니다!");
          router.push(`/community/post/${postId.value}`);
        } catch (error) {
          console.error("게시글 수정 오류:", error);
          alert("게시글 수정에 실패했습니다.");
        }
      } else {
        // 새 게시글 작성 로직 (실제 Firebase 연동 시 addDoc, collection 사용)
        postData.createdAt = Timestamp.now(); // Firestore Timestamp
        postData.views = 0;
        postData.likes = 0;
        postData.comments = [];

        try {
          // import { collection, addDoc } from 'firebase/firestore';
          // await addDoc(collection(db, "posts"), postData);
          alert("게시글이 성공적으로 작성되었습니다!");
          router.push(`/community/${postCategory.value}`); // 해당 게시판 목록으로 이동
        } catch (error) {
          console.error("게시글 작성 오류:", error);
          alert("게시글 작성에 실패했습니다.");
        }
      }
    };

    const cancelEdit = () => {
      if (isEditMode.value && postId.value) {
        router.push(`/community/post/${postId.value}`); // 수정 취소 시 상세 페이지로
      } else {
        router.push("/community"); // 새 글 작성 취소 시 커뮤니티 메인으로
      }
    };

    return {
      postId,
      isEditMode,
      postCategory,
      postTitle,
      postContent,
      submitPost,
      cancelEdit,
    };
  },
};
</script>

<style scoped>
.write-post-page {
  padding: 20px;
  max-width: 800px;
  margin: 30px auto;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 2.5em;
  color: #333;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.page-header .description {
  font-size: 1.1em;
  color: #666;
}

.write-form-container {
  padding: 30px;
  border-radius: 12px;
}

.post-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  text-align: left;
}

.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  color: #34495e;
  font-size: 1.1em;
}

.form-group input[type="text"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  outline: none;
  transition:
    border-color 0.3s ease,
    box-shadow 0.3s ease;
  box-sizing: border-box; /* 패딩이 너비에 포함되도록 */
}

.form-group input[type="text"]:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.form-group textarea {
  min-height: 200px;
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 20px;
}

.submit-button,
.cancel-button {
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1em;
  font-weight: bold;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-button {
  background-color: #28a745;
  color: white;
}

.submit-button:hover {
  background-color: #218838;
  transform: translateY(-2px);
}

.cancel-button {
  background-color: #6c757d;
  color: white;
}

.cancel-button:hover {
  background-color: #5a6268;
  transform: translateY(-2px);
}

/* Glassmorphism 스타일 */
.card {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>

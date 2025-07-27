<template>
  <div class="admin-section">
    <h3><i class="fas fa-comments"></i> 공지사항 및 커뮤니티 관리</h3>
    <p>여기에 공지사항 작성/수정, 게시판 관리, 댓글 관리 기능을 구현합니다.</p>
  </div>
</template>

<script>
export default {
  name: "NoticesCommunityManagement",
};
</script>

<style scoped>
.admin-section {
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #f9f9f9;
}
.admin-section h3 {
  color: #333;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-section p {
  color: #666;
}
</style>

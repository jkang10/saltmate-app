<template>
  <div class="home">
    <h1>��Ʈ����Ʈ�� ���� ���� ȯ���մϴ�!</h1>
    <p>�̰��� �α��� �� ���̴� ���� ���� ���� �������Դϴ�.</p>
    <p>
      ���⿡ ����ں� ��ú��� ���, �ֽ� �ҽ�, ���� ��Ȳ ��
      <br />��Ʈ����Ʈ ���� �ٽ� �������� �߰����ּ���.
    </p>

    <div class="placeholder-content">
      <h2>�ֿ� ��� Ž��</h2>
      <ul>
        <li><router-link to="/dashboard">��ú���</router-link></li>
        <li><router-link to="/shop">��</router-link></li>
        <li><router-link to="/my-investments">�� ����</router-link></li>
        <li><router-link to="/community">Ŀ�´�Ƽ</router-link></li>
        <li><router-link to="/profile">�� ������</router-link></li>
      </ul>
    </div>
  </div>
</template>

<script>
// �� �̻� HelloWorld ������Ʈ�� ����Ʈ�ϰų� ������� �ʽ��ϴ�.
// import HelloWorld from "@/components/HelloWorld.vue";

export default {
  name: "HomeView",
  components: {
    // HelloWorld, // �� ���� �����ϰų� �ּ� ó���մϴ�.
    // ���⿡ �α��� �� Ȩ ȭ�鿡 �ʿ��� �ٸ� ������Ʈ���� ����Ʈ�ϰ� ����� �� �ֽ��ϴ�.
    // ���� ���, DashboardSummary, RecentActivityFeed ��
  },
  data() {
    return {
      // isLoggedIn: false, // ���� �α��� ���´� Vuex �Ǵ� ���� ���� ������ ó��
    };
  },
  // Vue Router�� beforeEach ���忡�� �α��� ���¸� ó���ϹǷ�,
  // ���⿡���� Ư���� ������ �ʿ� ���� ���� �ֽ��ϴ�.
  // �ʿ信 ���� ������Ʈ ���ο��� �α��� ���¸� Ȯ���Ͽ� �ٸ� ������ ǥ���� �� �ֽ��ϴ�.
};
</script>

<style scoped>
/* �� ��Ÿ���� HomeView.vue���� ����˴ϴ�. */
.home {
  padding: 60px 20px;
  max-width: 900px;
  margin: 60px auto;
  background-color: #ffffff;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  text-align: center;
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h1 {
  color: #2c3e50;
  font-size: 2.8em;
  margin-bottom: 25px;
  font-weight: 700;
}

p {
  color: #555;
  font-size: 1.15em;
  line-height: 1.8;
  margin-bottom: 30px;
}

.placeholder-content {
  margin-top: 40px;
  padding: 30px;
  background-color: #f9f9f9;
  border-radius: 10px;
  border: 1px dashed #e0e0e0;
}

.placeholder-content h2 {
  color: #34495e;
  font-size: 1.8em;
  margin-bottom: 25px;
}

.placeholder-content ul {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
}

.placeholder-content li {
  margin-bottom: 10px;
}

.placeholder-content a {
  display: block;
  padding: 12px 25px;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 8px;
  font-weight: bold;
  transition: background-color 0.3s ease, transform 0.2s ease;
  box-shadow: 0 4px 10px rgba(0, 123, 255, 0.2);
}

.placeholder-content a:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(0, 123, 255, 0.3);
}
</style>

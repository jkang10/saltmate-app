<template>
  <v-container>
    <v-form @submit.prevent="handleSignup">
      <!-- 이름 -->
      <v-text-field v-model="form.name" label="이름" required />

      <!-- 전화번호 -->
      <v-text-field
        v-model="form.phone"
        label="전화번호 (HP)"
        hint="하이픈(-)을 포함하여 입력해주세요."
        required
      />

      <!-- 지역 (센터) -->
      <v-text-field v-model="form.region" label="지역 (센터)" required />

      <!-- 구독 등급 -->
      <v-select
        v-model="form.amount"
        :items="['30만원', '50만원', '100만원']"
        label="구독 등급"
        required
      />

      <!-- 이메일 -->
      <v-text-field v-model="form.email" label="이메일" required type="email" />

      <!-- 비밀번호 -->
      <v-text-field
        v-model="form.password"
        label="비밀번호"
        type="password"
        required
      />

      <!-- 비밀번호 확인 -->
      <v-text-field
        v-model="form.confirmPassword"
        label="비밀번호 확인"
        type="password"
        :error-messages="confirmError"
        required
      />

      <!-- 추천인 -->
      <v-text-field
        v-model="form.referrer"
        label="추천인 (선택 사항)"
        hint="이름 또는 이메일 입력"
        @blur="validateReferrer"
        :error-messages="referrerError"
      />
      <v-btn small @click="validateReferrer">검증</v-btn>
      <p v-if="referrerValidated" class="text-green">
        추천인 '{{ referrerName }}'님 확인 완료!
        <span @click="resetReferrer" class="text-blue">[변경]</span>
      </p>

      <!-- 가입 버튼 -->
      <v-btn color="primary" type="submit">가입하기</v-btn>

      <p v-if="signupError" class="text-red">
        오류가 발생했습니다: {{ signupError }}
      </p>
    </v-form>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "@/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

const router = useRouter();
const auth = getAuth();
const functions = getFunctions();

const form = ref({
  name: "",
  phone: "",
  region: "",
  amount: "",
  email: "",
  password: "",
  confirmPassword: "",
  referrer: "",
});

const confirmError = ref("");
const referrerValidated = ref(false);
const referrerError = ref("");
const referrerEmail = ref("");
const referrerName = ref("");
const signupError = ref("");

const validateReferrer = async () => {
  if (!form.value.referrer) return;
  const usersRef = collection(db, "users");
  const qByEmail = query(usersRef, where("email", "==", form.value.referrer));
  const qByName = query(usersRef, where("name", "==", form.value.referrer));
  const [res1, res2] = await Promise.all([getDocs(qByEmail), getDocs(qByName)]);

  if (!res1.empty || !res2.empty) {
    const doc = !res1.empty ? res1.docs[0] : res2.docs[0];
    referrerEmail.value = doc.data().email;
    referrerName.value = doc.data().name;
    referrerValidated.value = true;
    referrerError.value = "";
  } else {
    referrerValidated.value = false;
    referrerError.value = "추천인을 찾을 수 없습니다.";
  }
};

const resetReferrer = () => {
  referrerValidated.value = false;
  referrerEmail.value = "";
  referrerName.value = "";
  form.value.referrer = "";
};

const handleSignup = async () => {
  signupError.value = "";
  if (form.value.password !== form.value.confirmPassword) {
    confirmError.value = "비밀번호가 일치하지 않습니다.";
    return;
  }
  confirmError.value = "";

  try {
    // Firebase Authentication 계정 생성
    await createUserWithEmailAndPassword(
      auth,
      form.value.email,
      form.value.password,
    );

    // 로그인 (context.auth 확보)
    await signInWithEmailAndPassword(
      auth,
      form.value.email,
      form.value.password,
    );

    // 클라우드 함수 호출
    const createNewUser = httpsCallable(functions, "createNewUser");
    await createNewUser({
      name: form.value.name,
      phone: form.value.phone,
      region: form.value.region,
      investmentAmount: parseInt(form.value.amount.replace(/[^0-9]/g, "")),
      uplineReferrer: referrerEmail.value || null,
    });

    alert("회원가입이 완료되었습니다!");
    router.push("/");
  } catch (err) {
    console.error(err);
    signupError.value = err.message || "회원가입 중 오류가 발생했습니다.";
  }
};
</script>

<style scoped>
.text-green {
  color: green;
}
.text-red {
  color: red;
}
.text-blue {
  color: blue;
  cursor: pointer;
  text-decoration: underline;
}
</style>

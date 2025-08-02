// SignupPage.vue의 handleSignup 함수 const handleSignup = async () => {
error.value = null; if (password.value !== confirmPassword.value) { error.value
= "비밀번호가 일치하지 않습니다."; return; } isLoading.value = true; try { // 1.
계정 인증 await createUserWithEmailAndPassword(auth, email.value,
password.value); // 2. 진단용 함수 호출 const functions = getFunctions(); const
createNewUser = httpsCallable(functions, 'createNewUser'); // 3. 최소한의
데이터만 전달 const userData = { name: name.value, phone: phone.value, }; await
createNewUser(userData); alert("테스트 회원가입이 성공적으로 완료되었습니다!");
router.push("/dashboard"); } catch (err) { console.error("회원가입 중 클라이언트
오류:", err); error.value = `오류가 발생했습니다: ${err.message}`; } finally {
isLoading.value = false; } };

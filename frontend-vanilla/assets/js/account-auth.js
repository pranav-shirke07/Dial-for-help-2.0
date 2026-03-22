(function () {
  const loginTab = document.getElementById("authLoginTab");
  const registerTab = document.getElementById("authRegisterTab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const submitBtn = document.getElementById("authSubmitBtn");

  let mode = "login";

  const setMode = (nextMode) => {
    mode = nextMode;
    const loginActive = mode === "login";
    loginForm.classList.toggle("hidden", !loginActive);
    registerForm.classList.toggle("hidden", loginActive);
    loginTab.className = `btn ${loginActive ? "btn-primary" : "btn-outline"}`;
    registerTab.className = `btn ${!loginActive ? "btn-primary" : "btn-outline"}`;
    submitBtn.textContent = loginActive ? "Login" : "Create Account";
    submitBtn.setAttribute("data-testid", "user-auth-submit-button");
  };

  loginTab.addEventListener("click", () => setMode("login"));
  registerTab.addEventListener("click", () => setMode("register"));

  submitBtn.addEventListener("click", async () => {
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = "Please wait...";

      let response;
      if (mode === "login") {
        response = await window.dialApi.userLogin({
          email: document.getElementById("loginEmail").value.trim(),
          password: document.getElementById("loginPassword").value.trim(),
        });
      } else {
        response = await window.dialApi.userRegister({
          full_name: document.getElementById("registerName").value.trim(),
          phone: document.getElementById("registerPhone").value.trim(),
          email: document.getElementById("registerEmail").value.trim(),
          password: document.getElementById("registerPassword").value.trim(),
          address: document.getElementById("registerAddress").value.trim(),
          notify_email: true,
          notify_sms: true,
        });
      }

      window.dialApi.setUserToken(response.token);
      window.dialUi.toast(mode === "login" ? "Login successful" : "Account created", "success");
      window.location.href = "./account-profile.html";
    } catch (error) {
      window.dialUi.toast(error.message || "Authentication failed", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "login" ? "Login" : "Create Account";
    }
  });

  setMode("login");
})();
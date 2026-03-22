(function () {
  const btn = document.getElementById("adminLoginBtn");

  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      btn.textContent = "Logging in...";
      const response = await window.dialApi.adminLogin({
        email: document.getElementById("adminEmail").value.trim(),
        password: document.getElementById("adminPassword").value.trim(),
      });
      window.dialApi.setAdminToken(response.token);
      window.dialUi.toast("Admin login successful", "success");
      window.location.href = "./admin-dashboard.html";
    } catch (error) {
      window.dialUi.toast(error.message || "Login failed", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Open Dashboard";
    }
  });
})();
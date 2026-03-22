(function () {
  const activeMap = {
    "index.html": "home",
    "services.html": "services",
    "book.html": "book",
    "worker-signup.html": "worker",
    "contact.html": "contact",
    "track-booking.html": "track",
    "account-auth.html": "account",
    "account-profile.html": "account",
    "account-notifications.html": "notifications",
    "admin-login.html": "admin",
    "admin-dashboard.html": "admin",
  };

  const pathname = window.location.pathname.split("/").pop() || "index.html";
  const active = activeMap[pathname];

  document.querySelectorAll("[data-nav-key]").forEach((el) => {
    if (el.dataset.navKey === active) {
      el.classList.add("active");
    }
  });

  const toast = (text, kind = "info") => {
    const box = document.createElement("div");
    box.setAttribute("data-testid", "toast-message");
    box.style.position = "fixed";
    box.style.right = "20px";
    box.style.top = "20px";
    box.style.padding = "10px 14px";
    box.style.borderRadius = "12px";
    box.style.zIndex = "1000";
    box.style.fontSize = "14px";
    box.style.color = "#fff";
    box.style.background = kind === "error" ? "#b91c1c" : kind === "success" ? "#15803d" : "#374151";
    box.textContent = text;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2600);
  };

  const statusChipClass = (status) => {
    if (status === "assigned") return "status-chip status-assigned";
    if (status === "completed") return "status-chip status-completed";
    return "status-chip status-pending";
  };

  window.dialUi = {
    toast,
    statusChipClass,
  };
})();
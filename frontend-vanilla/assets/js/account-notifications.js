(function () {
  const token = window.dialApi.getUserToken();
  if (!token) {
    window.location.href = "./account-auth.html";
    return;
  }

  const list = document.getElementById("notificationsList");

  const load = async () => {
    try {
      const items = await window.dialApi.userNotifications();
      if (!items.length) {
        list.innerHTML = `<p class="muted" data-testid="user-notifications-empty">No notifications yet.</p>`;
        return;
      }

      list.innerHTML = items
        .map(
          (item) => `
            <article class="card stack" data-testid="user-notification-item-${item.id}">
              <div class="row" style="justify-content: space-between">
                <p data-testid="user-notification-title-${item.id}">${item.title}</p>
                <span class="status-chip ${item.read ? "status-completed" : "status-assigned"}" data-testid="user-notification-read-badge-${item.id}">
                  ${item.read ? "Read" : "Unread"}
                </span>
              </div>
              <p data-testid="user-notification-message-${item.id}">${item.message}</p>
              <p class="muted" data-testid="user-notification-created-at-${item.id}">${new Date(item.created_at).toLocaleString()}</p>
              ${
                item.read
                  ? ""
                  : `<button class="btn btn-outline" data-id="${item.id}" data-testid="user-notification-mark-read-${item.id}">Mark as Read</button>`
              }
            </article>
          `,
        )
        .join("");

      list.querySelectorAll("button[data-id]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await window.dialApi.userMarkNotificationRead(btn.dataset.id);
            window.dialUi.toast("Marked as read", "success");
            await load();
          } catch (error) {
            window.dialUi.toast(error.message || "Action failed", "error");
          }
        });
      });
    } catch (error) {
      window.dialUi.toast(error.message || "Could not load notifications", "error");
    }
  };

  load();
})();
(function () {
  const token = window.dialApi.getUserToken();
  if (!token) {
    window.location.href = "./account-auth.html";
    return;
  }

  const logoutBtn = document.getElementById("profileLogoutBtn");
  const saveBtn = document.getElementById("profileSaveBtn");
  const bookingsList = document.getElementById("profileBookingsList");

  const fillProfile = (profile) => {
    document.getElementById("profileName").value = profile.full_name || "";
    document.getElementById("profileEmail").value = profile.email || "";
    document.getElementById("profilePhone").value = profile.phone || "";
    document.getElementById("profileAddress").value = profile.address || "";
    document.getElementById("profileNotifyEmail").checked = Boolean(profile.notify_email);
    document.getElementById("profileNotifySms").checked = Boolean(profile.notify_sms);
  };

  const renderBookings = (items) => {
    if (!items.length) {
      bookingsList.innerHTML = `<p class="muted" data-testid="user-bookings-empty">No bookings yet.</p>`;
      return;
    }

    bookingsList.innerHTML = items
      .map(
        (item) => `
          <article class="card stack" data-testid="user-booking-item-${item.id}">
            <div class="row" style="justify-content: space-between">
              <span class="mono" data-testid="user-booking-id-${item.id}">${item.id}</span>
              <span class="${window.dialUi.statusChipClass(item.status)}" data-testid="user-booking-status-${item.id}">${item.status}</span>
            </div>
            <p data-testid="user-booking-service-${item.id}">${item.service_type}</p>
            <p class="muted" data-testid="user-booking-date-${item.id}">Preferred: ${item.preferred_date}</p>
          </article>
        `,
      )
      .join("");
  };

  const load = async () => {
    try {
      const [profile, bookings] = await Promise.all([window.dialApi.userProfile(), window.dialApi.userBookings()]);
      fillProfile(profile);
      renderBookings(bookings);
    } catch (error) {
      window.dialApi.clearUserToken();
      window.dialUi.toast(error.message || "Session expired", "error");
      window.location.href = "./account-auth.html";
    }
  };

  saveBtn.addEventListener("click", async () => {
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";
      const payload = {
        full_name: document.getElementById("profileName").value.trim(),
        phone: document.getElementById("profilePhone").value.trim(),
        address: document.getElementById("profileAddress").value.trim(),
        notify_email: document.getElementById("profileNotifyEmail").checked,
        notify_sms: document.getElementById("profileNotifySms").checked,
      };
      await window.dialApi.userUpdateProfile(payload);
      window.dialUi.toast("Profile updated", "success");
      await load();
    } catch (error) {
      window.dialUi.toast(error.message || "Update failed", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Profile";
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await window.dialApi.userLogout();
    } catch (_error) {
      // ignore
    }
    window.dialApi.clearUserToken();
    window.location.href = "./account-auth.html";
  });

  load();
})();
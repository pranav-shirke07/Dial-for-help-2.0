(function () {
  const token = window.dialApi.getAdminToken();
  if (!token) {
    window.location.href = "./admin-login.html";
    return;
  }

  const state = {
    overview: null,
    subscriptions: [],
    analytics: null,
    demoLogins: [],
    drafts: {},
  };

  const statsGrid = document.getElementById("adminStatsGrid");
  const monthlyList = document.getElementById("analyticsMonthlyList");
  const searchInput = document.getElementById("adminSearchInput");
  const statusFilter = document.getElementById("adminStatusFilter");
  const serviceFilter = document.getElementById("adminServiceFilter");

  const bookingsTable = document.getElementById("bookingsTable");
  const subscriptionsTable = document.getElementById("subscriptionsTable");
  const demoLoginsTable = document.getElementById("demoLoginsTable");
  const workersTable = document.getElementById("workersTable");
  const contactsTable = document.getElementById("contactsTable");

  const fillServiceFilter = () => {
    serviceFilter.innerHTML = ["all", ...window.ALL_SERVICES.map((s) => s.name)]
      .map((name) => `<option value="${name}">${name === "all" ? "All Services" : name}</option>`)
      .join("");
  };

  const renderStats = () => {
    const stats = state.overview?.stats || {};
    const cards = [
      ["Pending", stats.pending || 0],
      ["Assigned", stats.assigned || 0],
      ["Completed", stats.completed || 0],
      ["Workers", stats.total_workers || 0],
      ["Contacts", stats.total_contacts || 0],
    ];

    statsGrid.innerHTML = cards
      .map(
        ([label, value]) => `
          <article class="card stack" data-testid="stat-card-${label.toLowerCase()}">
            <p class="label" data-testid="stat-label-${label.toLowerCase()}">${label}</p>
            <h2 data-testid="stat-value-${label.toLowerCase()}">${value}</h2>
          </article>
        `,
      )
      .join("");
  };

  const renderAnalytics = () => {
    const analytics = state.analytics || { monthly: [] };
    document.getElementById("analyticsCompletion").textContent = `${analytics.assignment_completion_rate || 0}%`;
    document.getElementById("analyticsActiveSubs").textContent = String(analytics.active_subscriptions || 0);
    document.getElementById("analyticsRevenue").textContent = String(analytics.total_revenue_inr || 0);

    monthlyList.innerHTML = (analytics.monthly || [])
      .map(
        (item) => `
          <div class="row card" data-testid="analytics-month-row-${item.month}" style="padding: 8px 10px; justify-content: space-between;">
            <span data-testid="analytics-month-${item.month}">${item.month}</span>
            <span data-testid="analytics-month-bookings-${item.month}">B: ${item.bookings}</span>
            <span data-testid="analytics-month-revenue-${item.month}">₹${item.revenue_inr}</span>
            <span data-testid="analytics-month-renewals-${item.month}">R: ${item.renewals_due}</span>
          </div>
        `,
      )
      .join("");
  };

  const filteredBookings = () => {
    const q = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const service = serviceFilter.value;

    return (state.overview?.bookings || []).filter((item) => {
      const textMatch =
        item.id.toLowerCase().includes(q) ||
        item.full_name.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q);
      const statusMatch = status === "all" || item.status === status;
      const serviceMatch = service === "all" || item.service_type === service;
      return textMatch && statusMatch && serviceMatch;
    });
  };

  const renderBookings = () => {
    const rows = filteredBookings();
    const workers = state.overview?.workers || [];

    bookingsTable.innerHTML = `
      <thead>
        <tr>
          <th>Customer</th>
          <th>Service</th>
          <th>Status</th>
          <th>Worker</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map((booking) => {
                  if (!state.drafts[booking.id]) {
                    state.drafts[booking.id] = {
                      status: booking.status,
                      assigned_worker_id: booking.assigned_worker_id || "none",
                    };
                  }

                  const statusOptions = ["pending", "assigned", "completed"]
                    .map(
                      (status) =>
                        `<option value="${status}" ${state.drafts[booking.id].status === status ? "selected" : ""}>${status}</option>`,
                    )
                    .join("");

                  const workerOptions = [
                    `<option value="none" ${state.drafts[booking.id].assigned_worker_id === "none" ? "selected" : ""}>Unassigned</option>`,
                    ...workers.map(
                      (worker) =>
                        `<option value="${worker.id}" ${state.drafts[booking.id].assigned_worker_id === worker.id ? "selected" : ""}>${worker.full_name}</option>`,
                    ),
                  ].join("");

                  return `
                    <tr data-testid="booking-row-${booking.id}">
                      <td>
                        <div data-testid="booking-customer-${booking.id}">${booking.full_name}</div>
                        <div class="muted" data-testid="booking-contact-${booking.id}">${booking.phone} • ${booking.email}</div>
                      </td>
                      <td data-testid="booking-service-${booking.id}">${booking.service_type}</td>
                      <td>
                        <span class="${window.dialUi.statusChipClass(state.drafts[booking.id].status)}" data-testid="booking-status-badge-${booking.id}">
                          ${state.drafts[booking.id].status}
                        </span>
                        <div>
                          <select class="select" data-status-select="${booking.id}" data-testid="booking-status-select-${booking.id}">${statusOptions}</select>
                        </div>
                      </td>
                      <td>
                        <select class="select" data-worker-select="${booking.id}" data-testid="booking-worker-select-${booking.id}">${workerOptions}</select>
                      </td>
                      <td>
                        <div class="row">
                          <button class="btn btn-outline" data-suggest="${booking.id}" data-testid="booking-suggest-button-${booking.id}">Suggest</button>
                          <button class="btn btn-primary" data-save="${booking.id}" data-testid="booking-save-button-${booking.id}">Save</button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join("")
            : `<tr><td colspan="5" class="muted" data-testid="bookings-empty-message">No bookings found.</td></tr>`
        }
      </tbody>
    `;

    bookingsTable.querySelectorAll("select[data-status-select]").forEach((el) => {
      el.addEventListener("change", () => {
        state.drafts[el.dataset.statusSelect].status = el.value;
        renderBookings();
      });
    });

    bookingsTable.querySelectorAll("select[data-worker-select]").forEach((el) => {
      el.addEventListener("change", () => {
        state.drafts[el.dataset.workerSelect].assigned_worker_id = el.value;
      });
    });

    bookingsTable.querySelectorAll("button[data-suggest]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          btn.textContent = "Suggesting...";
          const bookingId = btn.dataset.suggest;
          const suggestions = await window.dialApi.adminSuggestions(bookingId);
          if (!suggestions.length) return window.dialUi.toast("No suggestion available", "error");
          state.drafts[bookingId].assigned_worker_id = suggestions[0].worker_id;
          if (state.drafts[bookingId].status === "pending") state.drafts[bookingId].status = "assigned";
          window.dialUi.toast(`Suggested ${suggestions[0].full_name}`, "success");
          renderBookings();
        } catch (error) {
          window.dialUi.toast(error.message || "Suggestion failed", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Suggest";
        }
      });
    });

    bookingsTable.querySelectorAll("button[data-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const bookingId = btn.dataset.save;
        const draft = state.drafts[bookingId];
        try {
          btn.disabled = true;
          btn.textContent = "Saving...";
          await window.dialApi.adminUpdateBooking(bookingId, {
            status: draft.status,
            assigned_worker_id: draft.assigned_worker_id === "none" ? null : draft.assigned_worker_id,
          });
          window.dialUi.toast("Booking updated", "success");
          await loadAll();
        } catch (error) {
          window.dialUi.toast(error.message || "Update failed", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Save";
        }
      });
    });
  };

  const renderSubscriptions = () => {
    subscriptionsTable.innerHTML = `
      <thead>
        <tr>
          <th>Subscriber</th>
          <th>Plan</th>
          <th>Status</th>
          <th>Expires</th>
          <th>Reminder</th>
        </tr>
      </thead>
      <tbody>
        ${
          state.subscriptions.length
            ? state.subscriptions
                .map(
                  (item) => `
                    <tr data-testid="subscription-row-${item.id}">
                      <td>
                        <div data-testid="subscription-name-${item.id}">${item.subscriber_name}</div>
                        <div class="muted" data-testid="subscription-contact-${item.id}">${item.email} • ${item.phone}</div>
                      </td>
                      <td data-testid="subscription-plan-${item.id}">${item.plan_type}</td>
                      <td data-testid="subscription-status-${item.id}">${item.status}</td>
                      <td data-testid="subscription-expiry-${item.id}">${new Date(item.expires_at).toLocaleDateString()} (${item.days_remaining} days)</td>
                      <td data-testid="subscription-reminder-${item.id}">${item.renewal_reminder_due ? "Reminder Due" : "Healthy"}</td>
                    </tr>
                  `,
                )
                .join("")
            : `<tr><td colspan="5" data-testid="subscriptions-empty-message">No subscriptions found.</td></tr>`
        }
      </tbody>
    `;
  };

  const renderDemoLogins = () => {
    demoLoginsTable.innerHTML = `
      <thead>
        <tr><th>Role</th><th>Name</th><th>Email</th><th>Phone</th><th>Password</th></tr>
      </thead>
      <tbody>
        ${
          state.demoLogins.length
            ? state.demoLogins
                .map(
                  (item, index) => `
                    <tr data-testid="demo-login-row-${index}">
                      <td data-testid="demo-login-role-${index}">${item.role}</td>
                      <td data-testid="demo-login-name-${index}">${item.full_name}</td>
                      <td data-testid="demo-login-email-${index}">${item.email}</td>
                      <td data-testid="demo-login-phone-${index}">${item.phone}</td>
                      <td data-testid="demo-login-password-${index}">${item.login_password || "N/A"}</td>
                    </tr>
                  `,
                )
                .join("")
            : `<tr><td colspan="5" data-testid="demo-logins-empty-message">No demo logins found.</td></tr>`
        }
      </tbody>
    `;
  };

  const renderWorkers = () => {
    const workers = state.overview?.workers || [];
    workersTable.innerHTML = `
      <thead><tr><th>Name</th><th>Skill</th><th>City</th><th>Availability</th></tr></thead>
      <tbody>
        ${
          workers.length
            ? workers
                .map(
                  (w) => `
                  <tr data-testid="worker-row-${w.id}">
                    <td data-testid="worker-name-${w.id}">${w.full_name}</td>
                    <td data-testid="worker-skill-${w.id}">${w.skill}</td>
                    <td data-testid="worker-city-${w.id}">${w.city}</td>
                    <td data-testid="worker-availability-${w.id}">${w.availability}</td>
                  </tr>
                `,
                )
                .join("")
            : `<tr><td colspan="4" data-testid="workers-empty-message">No workers.</td></tr>`
        }
      </tbody>
    `;
  };

  const renderContacts = () => {
    const contacts = state.overview?.contacts || [];
    contactsTable.innerHTML = `
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Message</th></tr></thead>
      <tbody>
        ${
          contacts.length
            ? contacts
                .map(
                  (c) => `
                  <tr data-testid="contact-row-${c.id}">
                    <td data-testid="contact-name-${c.id}">${c.name}</td>
                    <td data-testid="contact-email-${c.id}">${c.email}</td>
                    <td data-testid="contact-phone-${c.id}">${c.phone}</td>
                    <td data-testid="contact-message-${c.id}">${c.message}</td>
                  </tr>
                `,
                )
                .join("")
            : `<tr><td colspan="4" data-testid="contacts-empty-message">No contacts.</td></tr>`
        }
      </tbody>
    `;
  };

  const renderAll = () => {
    renderStats();
    renderAnalytics();
    renderBookings();
    renderSubscriptions();
    renderDemoLogins();
    renderWorkers();
    renderContacts();
  };

  const loadAll = async () => {
    try {
      const [overview, subscriptions, analytics, demoLogins] = await Promise.all([
        window.dialApi.adminOverview(),
        window.dialApi.adminSubscriptions(),
        window.dialApi.adminAnalytics(),
        window.dialApi.adminDemoLogins(),
      ]);
      state.overview = overview;
      state.subscriptions = subscriptions;
      state.analytics = analytics;
      state.demoLogins = demoLogins;
      renderAll();
    } catch (error) {
      window.dialApi.clearAdminToken();
      window.dialUi.toast(error.message || "Admin session expired", "error");
      window.location.href = "./admin-login.html";
    }
  };

  document.getElementById("dispatchRenewalsBtn").addEventListener("click", async () => {
    try {
      const result = await window.dialApi.adminDispatchRenewals();
      window.dialUi.toast(`Renewals sent: ${result.reminded_count}`, "success");
      await loadAll();
    } catch (error) {
      window.dialUi.toast(error.message || "Failed to send reminders", "error");
    }
  });

  document.getElementById("adminResetDemoBtn").addEventListener("click", async () => {
    try {
      const result = await window.dialApi.adminDemoReset();
      window.dialUi.toast(`Demo reset: ${result.deleted_records}`, "success");
      await loadAll();
    } catch (error) {
      window.dialUi.toast(error.message || "Reset failed", "error");
    }
  });

  document.getElementById("adminResetReseedBtn").addEventListener("click", async () => {
    try {
      const result = await window.dialApi.adminDemoResetReseed();
      window.dialUi.toast(`Reseed complete. Removed: ${result.deleted_records}`, "success");
      await loadAll();
    } catch (error) {
      window.dialUi.toast(error.message || "Reset+Reseed failed", "error");
    }
  });

  document.getElementById("adminLogoutBtn").addEventListener("click", async () => {
    try {
      await window.dialApi.adminLogout();
    } catch (_error) {
      // ignore
    }
    window.dialApi.clearAdminToken();
    window.location.href = "./admin-login.html";
  });

  [searchInput, statusFilter, serviceFilter].forEach((el) => el.addEventListener("input", renderBookings));
  [statusFilter, serviceFilter].forEach((el) => el.addEventListener("change", renderBookings));

  document.querySelectorAll("button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll("button[data-tab]").forEach((b) => {
        b.className = `btn ${b === btn ? "btn-primary" : "btn-outline"}`;
      });
      document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.add("hidden"));
      document.getElementById(`tab-${tab}`).classList.remove("hidden");
    });
  });

  fillServiceFilter();
  loadAll();
})();
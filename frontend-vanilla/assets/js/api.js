(function () {
  const { API_BASE, USER_TOKEN_KEY, ADMIN_TOKEN_KEY } = window.DIAL_CONFIG;

  const fetchJson = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = data?.detail || data?.message || `Request failed (${response.status})`;
      const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      err.status = response.status;
      err.payload = data;
      throw err;
    }
    return data;
  };

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  const api = {
    base: API_BASE,
    fetchJson,

    getUserToken: () => localStorage.getItem(USER_TOKEN_KEY),
    setUserToken: (token) => localStorage.setItem(USER_TOKEN_KEY, token),
    clearUserToken: () => localStorage.removeItem(USER_TOKEN_KEY),

    getAdminToken: () => localStorage.getItem(ADMIN_TOKEN_KEY),
    setAdminToken: (token) => localStorage.setItem(ADMIN_TOKEN_KEY, token),
    clearAdminToken: () => localStorage.removeItem(ADMIN_TOKEN_KEY),

    // Public
    createBooking: (payload) => fetchJson("/bookings", { method: "POST", body: JSON.stringify(payload) }),
    trackBooking: (id) => fetchJson(`/bookings/track/${id}`),
    createWorkerSignup: (payload) => fetchJson("/workers/signup", { method: "POST", body: JSON.stringify(payload) }),
    createContact: (payload) => fetchJson("/contacts", { method: "POST", body: JSON.stringify(payload) }),

    userSubscriptionStatus: ({ phone, email }) =>
      fetchJson(`/subscriptions/user-status?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`),
    workerSubscriptionStatus: ({ phone, email }) =>
      fetchJson(`/subscriptions/worker-status?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`),

    paymentCreateOrder: (payload) => fetchJson("/payments/create-order", { method: "POST", body: JSON.stringify(payload) }),
    paymentVerify: (payload) => fetchJson("/payments/verify", { method: "POST", body: JSON.stringify(payload) }),

    // User
    userRegister: (payload) => fetchJson("/users/register", { method: "POST", body: JSON.stringify(payload) }),
    userLogin: (payload) => fetchJson("/users/login", { method: "POST", body: JSON.stringify(payload) }),
    userLogout: () => fetchJson("/users/logout", { method: "POST", headers: authHeader(localStorage.getItem(USER_TOKEN_KEY)) }),
    userProfile: () => fetchJson("/users/profile", { headers: authHeader(localStorage.getItem(USER_TOKEN_KEY)) }),
    userUpdateProfile: (payload) =>
      fetchJson("/users/profile", {
        method: "PUT",
        headers: authHeader(localStorage.getItem(USER_TOKEN_KEY)),
        body: JSON.stringify(payload),
      }),
    userBookings: () => fetchJson("/users/bookings", { headers: authHeader(localStorage.getItem(USER_TOKEN_KEY)) }),
    userNotifications: () => fetchJson("/users/notifications", { headers: authHeader(localStorage.getItem(USER_TOKEN_KEY)) }),
    userMarkNotificationRead: (id) =>
      fetchJson(`/users/notifications/${id}/read`, {
        method: "PATCH",
        headers: authHeader(localStorage.getItem(USER_TOKEN_KEY)),
      }),

    // Admin
    adminLogin: (payload) => fetchJson("/admin/login", { method: "POST", body: JSON.stringify(payload) }),
    adminLogout: () => fetchJson("/admin/logout", { method: "POST", headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)) }),
    adminOverview: () => fetchJson("/admin/overview", { headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)) }),
    adminUpdateBooking: (bookingId, payload) =>
      fetchJson(`/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)),
        body: JSON.stringify(payload),
      }),
    adminSubscriptions: () => fetchJson("/admin/subscriptions", { headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)) }),
    adminDispatchRenewals: () =>
      fetchJson("/admin/subscriptions/dispatch-renewal-reminders", {
        method: "POST",
        headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)),
      }),
    adminSuggestions: (bookingId) =>
      fetchJson(`/admin/bookings/${bookingId}/suggest-workers`, {
        headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)),
      }),
    adminAnalytics: () => fetchJson("/admin/analytics", { headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)) }),
    adminDemoLogins: () => fetchJson("/admin/demo-logins", { headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)) }),
    adminDemoReset: () =>
      fetchJson("/admin/demo/reset", {
        method: "POST",
        headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)),
      }),
    adminDemoResetReseed: () =>
      fetchJson("/admin/demo/reset-reseed", {
        method: "POST",
        headers: authHeader(localStorage.getItem(ADMIN_TOKEN_KEY)),
      }),
  };

  window.dialApi = api;
})();
window.DIAL_CONFIG = {
  API_BASE:
    window.localStorage.getItem("dial-api-base") ||
    `${window.location.origin.replace(/\/$/, "")}/api`,
  USER_TOKEN_KEY: "dial-user-token",
  ADMIN_TOKEN_KEY: "dial-admin-token",
};
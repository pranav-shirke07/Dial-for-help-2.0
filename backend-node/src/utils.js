const crypto = require("crypto");

const nowIso = () => new Date().toISOString();

const normalizePhone = (value) => String(value || "").trim().replace(/\s+/g, "");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const identityKey = (phone, email) => `${normalizePhone(phone)}::${normalizeEmail(email)}`;

const parseIso = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const isFutureIso = (isoValue) => {
  const parsed = parseIso(isoValue);
  if (!parsed) return false;
  return parsed > new Date();
};

const safeJsonError = (res, statusCode, detail) => {
  res.status(statusCode).json({ detail });
};

const createToken = () => crypto.randomUUID();

module.exports = {
  nowIso,
  normalizePhone,
  normalizeEmail,
  identityKey,
  parseIso,
  isFutureIso,
  safeJsonError,
  createToken,
};
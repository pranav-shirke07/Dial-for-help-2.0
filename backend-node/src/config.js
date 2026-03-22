const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const config = {
  port: Number(process.env.PORT || 8001),
  mongoUrl: requireEnv("MONGO_URL"),
  dbName: requireEnv("DB_NAME"),
  corsOrigins: process.env.CORS_ORIGINS || "*",
  defaultAdminEmail: requireEnv("DEFAULT_ADMIN_EMAIL"),
  defaultAdminPassword: requireEnv("DEFAULT_ADMIN_PASSWORD"),
  prices: {
    userPlanInr: 99,
    workerPlanInr: 199,
  },
};

module.exports = { config };
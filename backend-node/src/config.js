const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const config = {
  port: Number(process.env.PORT || 8001),
  mongoUrl: process.env.MONGO_URL,
  dbName: process.env.DB_NAME,
  corsOrigins: process.env.CORS_ORIGINS || "*",
  defaultAdminEmail: "admin@dialforhelp.com",
  defaultAdminPassword: "Admin@123",
  prices: {
    userPlanInr: 99,
    workerPlanInr: 199,
  },
};

module.exports = { config };
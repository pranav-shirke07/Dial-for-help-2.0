const { MongoClient } = require("mongodb");
const { config } = require("./config");

let client;
let db;

const connectDb = async () => {
  if (db) return db;

  client = new MongoClient(config.mongoUrl);
  await client.connect();
  db = client.db(config.dbName);
  return db;
};

const getDb = () => {
  if (!db) {
    throw new Error("Database not connected yet");
  }
  return db;
};

const closeDb = async () => {
  if (client) {
    await client.close();
  }
};

module.exports = {
  connectDb,
  getDb,
  closeDb,
};
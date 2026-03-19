import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const required = [
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required env keys: ${missing.join(", ")}`);
}

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  timezone: "Z",
  waitForConnections: true,
  connectionLimit: Math.max(10, Number(process.env.MYSQL_POOL_SIZE || 20)),
  queueLimit: 0,
});

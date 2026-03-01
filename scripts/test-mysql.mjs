import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const requiredKeys = [
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
];

const missing = requiredKeys.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `Missing required .env keys: ${missing.join(", ")}`
  );
  process.exit(1);
}

const config = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  connectTimeout: 10000,
};

let connection;

try {
  connection = await mysql.createConnection(config);
  const [rows] = await connection.query("SELECT 1 AS ok");

  console.log("MySQL connection test: OK");
  console.log(
    `Connected to ${config.host}:${config.port} / ${config.database} as ${config.user}`
  );
  console.log("Query result:", rows);
} catch (error) {
  console.error("MySQL connection test: FAILED");
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  if (connection) {
    await connection.end();
  }
}

// const mysql = require("mysql2");
const mysql = require("mysql2");

const pool = mysql.createPool({
  connectionLimit: 100, //important
  host: "healthcare.c6dqpxmbn5sc.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "rohinimali1234",
  database: "hospital_marketplace",
  debug: false,
});

const conn = mysql.createConnection({
  host: "healthcare.c6dqpxmbn5sc.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "rohinimali1234",
  database: "hospital_marketplace",
});

conn.connect((error) => {
  if (error) {
    console.log("error:", error);
  }
  console.log("connected !");
});

module.exports = conn;
module.exports = pool;

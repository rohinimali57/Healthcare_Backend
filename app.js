require("dotenv").config();
const express = require("express");
const app = express();
require("./db/conn");
const mysql = require("mysql2/promise");
const cors = require("cors");
// const router = require("./routes/router")
const register = require("./routes/register");
const procedures = require("./routes/procedures");
const doctor = require("./routes/doctors");
const patient = require("./routes/patient");
const provider = require("./routes/provider");
const payment = require("./routes/payment");
const chatbot = require("./routes/Chatbot");

// const logging= require("./routes/logging")
const notification = require("./routes/notification");

const review = require("./routes/review");
//const session = require("./routes/session");
const port = 8080;

app.use(express.json());
app.use(cors());

app.use("/uploads", express.static("./uploads"));

// app.use(router);
// app.use(router);
app.use(register);
app.use(procedures);
app.use(doctor);
app.use(patient);
app.use(provider);
app.use(review);
// app.use(notification);
app.use(payment);
app.use(chatbot);

app.listen(port, () => {
  console.log("server start", port);
});

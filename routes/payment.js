const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const conn = require("../db/conn");
const pool = require("../db/conn");
const mysql = require("mysql2/promise");
const router = express.Router();
const util = require("util");
const Razorpay = require("razorpay");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

//post api to add ratings
// app.post('/create-order', (req, res) => {
//   const razorpay = new Razorpay({
//     key_id: 'rzp_test_LerHhmnSru6RuL',
//     key_secret: 'FhKgFWpozlZnLNa23p4x1VUh',
//   });

//   const amount = 1000; // Amount in paise (1000 paise = ₹10)

//   const options = {
//     amount,
//     currency: 'INR',
//     receipt: 'order_receipt',
//   };

//   razorpay.orders.create(options, (err, order) => {
//     if (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Failed to create order' });
//     }

//     return res.json({ orderId: order.id, amount });
//   });
// });

module.exports = router;

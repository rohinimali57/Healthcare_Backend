const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const conn = require("../db/conn");
const pool = require("../db/conn");
const mysql = require("mysql2/promise");
const router = express.Router();
const util = require("util");
const AWS = require('aws-sdk')
const uuid = require('uuid');
const crypto = require('crypto');
const moment = require('moment');

const app = express();


// Configure AWS SDK   // Set your AWS region
AWS.config.update({
  accessKeyId: "AKIAVT23DX5AGGINZDVD",
  secretAccessKey: "LdK0vh2lg5k8OZRMLou0z//HxpsAf/DlB9ZGJBUu",
  region: "ap-south-1",
});

const SES = new AWS.SES({ apiVersion: "2010-12-01" });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// function to generate random string , used to generate links

function generateRandomString(length=30){
  return crypto.randomBytes(length).toString('hex');
}



router.post("/aws/email", (req, res)=>{
  const { email } = req.body;
  const token = uuid.v4(); // to generate a random token
  const expiration = moment().add(1, "hour"); // expiration time 5 minutes from now 
  const randomString = generateRandomString();
  const link = `http://localhost:8080/reset/password/${randomString}?token=${token}&email=${email}`

// Define Email parameters

// sending link to mail 

const params = {
  Destination : {
      ToAddresses : [email]
  },
  Message : {
      Body : {
          Text : {
      Data : `Click on the following link to open google ${link}`
          }
      },
      Subject : {
          Data : "Click on given link to change password"
      }
  },
  Source : "care@myhealthsaver.in" 
}

try{
  pool.query('INSERT INTO tokens (token , expiration) VALUES(? , ?)',[token,  expiration.format("YYYY-MM-DD HH:mm:ss")] ,(err,results)=>{
      if(err){
          console.log('error in storing token and expiration time', err)
      }else{
          console.log("token and expiration time saved in database")
      }
  })
  // actual sending of mail

SES.sendEmail(params , (err, result)=>{
  if(err){
      console.log("error while sending the mail", err)

  }else{
      console.log("Mail send successfully !!!" , result)
  }})

res.send("Mail send successfully !!!");

}catch (error) {
  console.error("Error saving token:", error);
  res.status(500).send("Error sending email");
}
})

// when clicked on link user will be directed to reset password page


router.get("/reset/password/:randomString", async (req, res) => {
  console.log("Route triggered!")
  const { token, randomString ,email} = req.query;
  // const { randomString } = req.params;

  console.log("Received randomString:", randomString);
  console.log("Received token:", token);
  console.log("recieved email", email)

  try {
      const [rows] = await pool.promise().query('SELECT expiration FROM tokens WHERE token = ?', [token]);

      if (rows.length > 0) {
          const expirationTime = moment(rows[0].expiration);

          if (expirationTime.isAfter(moment())) {
              // Token is valid, allow navigation to google.com or any other URL
              res.redirect("http://localhost:3001/reset/password");
          } else {
              // Token has expired
              res.send("This link has expired.");
          }
      } else {
          // Token not found or invalid
          res.send("Invalid token.");
      }
  } catch (error) {
      console.error("Error verifying token:", error);
      res.status(500).send("Error verifying token");
  }
});


// api to update the password
router.put("/reset/password", (req, res)=>{
  const {email , password} = req.body;

  console.log("email",email);
  console.log("password :",password);


  pool.query("UPDATE patients SET password = ? WHERE email = ?", [password, email], (err) => {
    if (err) {
      console.error("Error while updating password:", err);
      res.status(500).json({ error: "Internal server error" });
    } else {
      console.log("Password updated successfully !!!");
      res.json({ message: "Password updated successfully !!!" });
    }
  });

})



// ----------------review part-----------------------------------------//

//post api to add ratings
router.post("/reviews/:procedureId", (req, res) => {
  console.log(req.body);
  // Extract patientId and review data from the request body
  const { patientId, rating, comment } = req.body;

  // Extract procedureId from the request parameters
  const { procedureId } = req.params;

  // Insert the new review and comment into the database
  pool.query(
    "INSERT INTO reviews (patient_id, procedure_id, rating, comment) VALUES (?, ?, ?, ?)",
    [patientId, procedureId, rating, comment],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.json({ message: "Review added successfully" });
      }
    }
  );
});

// router.post('/reviews/procedure/id', (req, res) => {
//   // Parse and validate the request body
//   const { patientId, procedureId, rating, comment } = req.body;

//   // Perform database insertion
//   const sql = 'INSERT INTO reviews (patient_id, procedure_id, rating, comment) VALUES (?, ?, ?, ?)';
//   const values = [patientId, procedureId, rating, comment];

//   pool.query(sql, values, (error, results) => {
//     if (error) {
//       console.error('Error inserting review:', error);
//       res.status(500).json({ error: 'Failed to insert review' });
//     } else {
//       console.log('Review inserted successfully');
//       res.status(200).json({ success: true });
//     }
//   });
// });

// GET reviews with patient name by procedure ID
router.get("/reviews/procedure/id", (req, res) => {
  console.log("==");
  const { procedureId } = req.query;
  console.log(procedureId);
  // Prepare the SQL query with a join
  const sql = `
  SELECT r.*, p.firstname AS patient_name
  FROM reviews r
  JOIN patients p ON r.patient_id = p.patient_id
  WHERE r.procedure_id = ?
`;

  // Execute the query with the provided procedure ID
  pool.query(sql, [procedureId], (err, results) => {
    if (err) {
      console.error("Error executing the query: " + err.stack);
      res
        .status(500)
        .json({ error: "An error occurred while fetching the reviews" });
      return;
    }

    // Return the reviews with patient name as JSON response
    res.json(results);
  });
});

// GET API to retrieve procedure table and booking history table data for a given patient ID
router.get("/patient/:patientId", (req, res) => {
  const patientId = req.params.patientId;
  pool.query(
    `SELECT p.*, bh.* FROM hospital_marketplace.procedures p INNER JOIN hospital_marketplace.booking_history bh ON bh.procedure_id = p.id WHERE bh.patient_id = ?`,
    [patientId],
    (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).send("Error fetching procedure and booking data");
      } else {
        res.status(200).json(results);
      }
    }
  );
});








module.exports = router;

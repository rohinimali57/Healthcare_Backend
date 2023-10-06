const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const conn = require("../db/conn");
const pool = require("../db/conn");
const mysql = require("mysql2/promise");
// const mysql = require("mysql2");
// const bcrypt = require('bcrypt');
const router = express.Router();
const util = require("util");
const HMlogger = require("../routes/logger");
const sendEmailNotification = require("../routes/notification");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

//login api

// const { HMlogger } = require('./logger');
const sessions = {}; // In-memory object to store session data

const storeSession = (sessionId, data) => {
  sessions[sessionId] = data;
};

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  pool.query(
    "SELECT * FROM patients WHERE email = ?",
    [email],
    (err, patientResults) => {
      if (err) {
        HMlogger.error("Error in finding password");
        throw err;
      }

      if (patientResults.length === 0) {
        pool.query(
          "SELECT * FROM providers WHERE email = ?",
          [email],
          (err, providerResults) => {
            if (err) {
              HMlogger.error("Error in finding password");
              throw err;
            }

            if (providerResults.length === 0) {
              HMlogger.error("User not found in providers table either");
              return res
                .status(401)
                .json({ message: "Invalid email or password" });
            }

            const user = providerResults[0];

            if (password !== user.password) {
              HMlogger.error("Invalid password");
              return res
                .status(401)
                .json({ message: "Invalid email or password" });
            }

            HMlogger.info("Login successful");

            //email notification function call provider
            if (user.provider_id !== null) {
              //session code
              if (user !== null) {
                const generateSessionId = () => {
                  const length = 16;
                  const characters =
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                  let sessionId = "";

                  for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(
                      Math.random() * characters.length
                    );
                    sessionId += characters.charAt(randomIndex);
                  }

                  return sessionId;
                };

                // Generate a session ID
                const sessionId = generateSessionId();
                console.log(sessionId);
                // Set the expiration time (e.g., 5 days from now)
                const expirationTime = new Date();
                expirationTime.setDate(expirationTime.getDate() + 5);

                // Store the session ID and expiration time in your session store (e.g., database, cache)
                storeSession(sessionId, {
                  expirationTime /* other session data */,
                });

                // Set the session ID in the response cookies
                res.cookie("sessionId", sessionId);

                //email notification function call HOSPITAL
                let shouldSendEmail = true;
                const recipient = email.trim(); // Replace with the recipient's email
                const subject = "Welcome back, " + user.name + " !";
                const body = "Welcome back!";
                const emailTemplate = `
            Hello ${user.name},
   
            Welcome back to our healthcare community! We're thrilled to see you again.

            By logging in to your account, you can access a range of powerful features that enable you to provide exceptional healthcare services to our valued patients. Manage your profile, update procedures and doctor information, and collaborate with our community to ensure the best possible care.
        
            Our platform is designed to streamline the process, connecting patients with the expertise available at your esteemed hospital. We greatly appreciate your dedication to delivering high-quality healthcare and thank you for being an integral part of our community.
        
            Should you require any assistance or have any questions, our dedicated support team is here to help. Simply reach out to us, and we'll ensure a smooth experience for you and our patients.
        
            Thank you for your continued partnership. Together, we can make a positive impact on the healthcare landscape.
        
            With warm regards,
            [My Health Saver]
        
            Note: This email is intended solely for the named recipient and may contain confidential or privileged information. If you have received this email in error, please notify us immediately and delete it from your system.`;

                console.log(recipient, subject, body);
                sendEmailNotification(
                  shouldSendEmail,
                  recipient,
                  subject,
                  emailTemplate
                );
              }

              return res.json({
                message: "Login successful",
                name: user.name,
                provider_id: user.provider_id,
                sessionId: sessions,
              });
            }
          }
        );
      } else {
        const user = patientResults[0];

        if (password !== user.password) {
          HMlogger.error("Invalid password");
          return res.status(401).json({ message: "Invalid email or password" });
        }

        HMlogger.info("Login successful");

        //email notification function call Patient
        if (user.patient_id !== null) {
          if (user !== null) {
            const generateSessionId = () => {
              const length = 16;
              const characters =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
              let sessionId = "";

              for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(
                  Math.random() * characters.length
                );
                sessionId += characters.charAt(randomIndex);
              }

              return sessionId;
            };

            // Generate a session ID
            const sessionId = generateSessionId();
            console.log(sessionId);
            // Set the expiration time (e.g., 5 days from now)
            const expirationTime = new Date();
            expirationTime.setDate(expirationTime.getDate() + 5);

            // Store the session ID and expiration time in your session store (e.g., database, cache)
            storeSession(sessionId, {
              expirationTime /* other session data */,
            });

            // Set the session ID in the response cookies
            res.cookie("sessionId", sessionId);
            let shouldSendEmail = true;
            const recipient = email.trim(); // Replace with the recipient's email
            const subject = "Welcome back, " + user.username + " !";
            const body = "Welcome back!";
            const emailTemplate = `
        Dear ${user.username},

    Welcome back to our caring healthcare community! We are delighted to see you return.

    As you log in to your account, you have access to a wide range of compassionate healthcare services. Whether you are looking to book a procedure, take a doctor's appointment, or simply explore available health procedures, we are here to guide and support you.

    Our dedicated team is committed to providing you with exceptional care and ensuring your well-being every step of the way. If you need any assistance, have questions, or simply want to connect, please don't hesitate to reach out to us. Your health and comfort are our top priorities.

    Thank you for continuing to entrust us with your healthcare needs. We are honored to be a part of your healthcare journey.

    With heartfelt regards,
    [My Health Saver]

    Note: This email is intended solely for the named recipient and may contain confidential or privileged information. If you have received this email in error, please notify us immediately and delete it from your system.`;

            console.log(recipient, subject, body);
            sendEmailNotification(
              shouldSendEmail,
              recipient,
              subject,
              emailTemplate
            );
          }

          return res.json({
            message: "Login successful",
            username: user.username,
            patient_id: user.patient_id,
            sessionId: sessions,
          });
        }
      }
    }
  );
});

// router.post("/registerpatient", (req, res) => {
//   // Get data from request body
//   const {
//     first_name,
//     last_name,
//     email,
//     dob,
//     address,
//     username,
//     password,
//     gender,
//     phone,
//     age,
//   } = req.body;
//   // Prepare SQL query to insert data into providers table
//   const sql = `INSERT INTO patients (firstname,lastname,email,dob,address,username,gender,age, password,phone)
//               VALUES (?,?, ?, ?, ?, ?,?,?,?,?)`;
//   const values = [
//     first_name,
//     last_name,
//     email,
//     dob,
//     address,
//     username,
//     gender,
//     age,
//     password,
//     phone,
//   ];
//   // Execute the SQL query
//   pool.query(sql, values, (err, result) => {
//     if (err) {
//       console.error(err);
//       HMlogger.error("Error Patient data inserting data into database");
//       res.status(500).send("Error inserting data into database");
//     } else {
//       const patient_id = result.insertId;

//       //email notification function call
//       if (patient_id !== null) {
//         let shouldSendEmail = true;
//         let subjectData = "Hello " + first_name;
//         let bodyData = "Registred Successfully!!";
//         sendEmailNotification(shouldSendEmail, subjectData, bodyData);
//       }

//       console.log("User signed up:", patient_id);
//       HMlogger.info("Patient data inserting data into database");
//       res.json({ patient_id });
//     }
//   });
// });

// sign up for provider

router.post("/registerpatient", (req, res) => {
  // Get data from request body
  const {
    first_name,
    last_name,
    email,
    dob,
    address,
    username,
    password,
    gender,
    phone,
    age,
    insurance_provider,
    policyNumber,
    expirationDate,
    sumAssured,
  } = req.body;

  // Prepare SQL query to insert data into patients table
  const patientSql = `INSERT INTO patients (firstname, lastname, email, dob, address, username, gender, age, password, phone)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const patientValues = [
    first_name,
    last_name,
    email,
    dob,
    address,
    username,
    gender,
    age,
    password,
    phone,
  ];
  const checkEmailSql =
    "SELECT COUNT(*) AS count FROM patients WHERE email = ?";
  const checkEmailValue = [email];

  pool.query(checkEmailSql, checkEmailValue, (emailErr, emailResult) => {
    if (emailErr) {
      console.error(emailErr);
      HMlogger.error("Error checking email existence in the database");
      return pool.rollback(() => {
        res.status(500).send("Error checking email existence in the database");
      });
    }

    if (emailResult[0].count > 0) {
      // Email already exists in the database
      const msg = "Email already exists";
      return res.status(404).send(msg);
    }

    // Prepare SQL query to insert data into insurance table
    const insuranceSql = `INSERT INTO insurance (patient_id, insurance_provider, policy_number, expiration_date, sum_assured)
                        VALUES (?, ?, ?, ?, ?)`;

    // Execute the SQL queries
    // pool.beginTransaction((err) => {
      // if (err) {
      //   console.error(err);
      //   HMlogger.error("Error starting database transaction");
      //   return res.status(500).send("Error starting database transaction");
      // }

      pool.query(patientSql, patientValues, (err, patientResult) => {
        if (err) {
          console.error(err);
          HMlogger.error("Error inserting patient data into database");
          return pool.rollback(() => {
            res.status(500).send("Error inserting patient data into database");
          });
        }

        const patientId = patientResult.insertId;

        const insuranceValues = [
          patientId,
          insurance_provider,
          policyNumber,
          expirationDate,
          sumAssured,
        ];

        pool.query(insuranceSql, insuranceValues, (err, insuranceResult) => {
          if (err) {
            console.error(err);
            HMlogger.error("Error inserting insurance data into database");
            return pool.rollback(() => {
              res
                .status(500)
                .send("Error inserting insurance data into database");
            });
          }

          // pool.commit((err) => {
            // if (err) {
            //   console.error(err);
            //   HMlogger.error("Error committing database transaction");
            //   return pool.rollback(() => {
            //     res.status(500).send("Error committing database transaction");
            //   });
            // }

            // Email notification function call
            if (patientId !== null) {
              const generateSessionId = () => {
                const length = 16;
                const characters =
                  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                let sessionId = "";

                for (let i = 0; i < length; i++) {
                  const randomIndex = Math.floor(
                    Math.random() * characters.length
                  );
                  sessionId += characters.charAt(randomIndex);
                }

                return sessionId;
              };

              // Generate a session ID
              const sessionId = generateSessionId();
              console.log(sessionId);
              // Set the expiration time (e.g., 5 days from now)
              const expirationTime = new Date();
              expirationTime.setDate(expirationTime.getDate() + 5);

              // Store the session ID and expiration time in your session store (e.g., database, cache)
              storeSession(sessionId, {
                expirationTime /* other session data */,
              });

              // Set the session ID in the response cookies
              res.cookie("sessionId", sessionId);
              let shouldSendEmail = true;
              const recipient = email.trim(); // Assuming the user's email is stored in the 'email' property
              const subject =
                "Welcome to Our Healthcare Community, " + first_name + " !"; // Update the subject accordingly
              const body = "Welcome!"; // You can update the body if needed

              const emailTemplate = `
              Hello ${first_name},
              
              Warmest greetings and a heartfelt welcome to our healthcare community! We are thrilled to have you join us.

              By registering on our website, you've taken the first step towards prioritizing your health. Our dedicated team is ready to assist you in booking health procedures and doctor's appointments, ensuring that you receive the care you need when you need it.
          
              To schedule an appointment or explore our comprehensive range of health procedures, simply log in to your account on our website. Should you require any assistance or have any questions, our caring support team is just a click or phone call away.
          
              Thank you for choosing us as your healthcare partner. We are here to provide you with exceptional care every step of the way.
          
              With warm regards,
              [ My Health Saver]
          
              Note: This email is intended solely for the named recipient and may contain confidential or privileged information. If you have received this email in error, please notify us immediately and delete it from your system. `;

              console.log(recipient, subject, body);
              sendEmailNotification(
                shouldSendEmail,
                recipient,
                subject,
                emailTemplate
              );
            }

            console.log("User signed up:", patientId);
            HMlogger.info("Patient data inserted into database");
            res.json({ patient_id: patientId, sessionId: sessions });
          // });
        });
      });
    // });
  });
});

router.post("/providersignup", (req, res) => {
  // Get data from request body
  const {
    name,
    speciality,
    website,
    phone,
    age,
    address,
    city,
    state,
    zipcode,
    email,
    country,
    password,
  } = req.body;
  // Prepare SQL query to insert data into providers table
  const sql = `INSERT INTO providers (name,
    speciality,
    website,
    phone,
    age,
    address,
    city,
    state,
    zipcode,
    email,
    country,
    password)
              VALUES (?,?, ?, ?, ?, ?,?,?,?,?,?,?)`;
  const values = [
    name,
    speciality,
    website,
    phone,
    age,
    address,
    city,
    state,
    zipcode,
    email,
    country,
    password,
  ];
  const checkEmailSql =
    "SELECT COUNT(*) AS count FROM providers WHERE email = ?";
  const checkEmailValue = [email];

  pool.query(checkEmailSql, checkEmailValue, (emailErr, emailResult) => {
    if (emailErr) {
      console.error(emailErr);
      HMlogger.error("Error checking email existence in the database");
      return pool.rollback(() => {
        res.status(500).send("Error checking email existence in the database");
      });
    }

    if (emailResult[0].count > 0) {
      // Email already exists in the database
      const msg = "Email already exists";
      return res.status(404).send(msg);
    }
    // Execute the SQL query
    pool.query(sql, values, (err, result) => {
      if (err) {
        console.error(err);
        HMlogger.error("Error Provider data inserting data into database");

        res.status(500).send("Error inserting data into database");
      } else {
        const provider_id = result.insertId;

        //email notification function call

        if (provider_id !== null) {
          const generateSessionId = () => {
            const length = 16;
            const characters =
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let sessionId = "";

            for (let i = 0; i < length; i++) {
              const randomIndex = Math.floor(Math.random() * characters.length);
              sessionId += characters.charAt(randomIndex);
            }

            return sessionId;
          };

          // Generate a session ID
          const sessionId = generateSessionId();
          console.log(sessionId);
          // Set the expiration time (e.g., 5 days from now)
          const expirationTime = new Date();
          expirationTime.setDate(expirationTime.getDate() + 5);

          // Store the session ID and expiration time in your session store (e.g., database, cache)
          storeSession(sessionId, { expirationTime /* other session data */ });

          // Set the session ID in the response cookies
          res.cookie("sessionId", sessionId);
          let shouldSendEmail = true;
          const recipient = email.trim(); // Assuming the user's email is stored in the 'email' property
          const subject = "Welcome to Our Healthcare Community, " + name + " !"; // Update the subject accordingly
          const body = "Welcome!"; // You can update the body if needed

          const emailTemplate = `
          Hello ${name},
      
          Warmest greetings and a heartfelt welcome to our healthcare community! We are delighted to have your esteemed hospital join us.

          By registering on our website, you are taking a significant step towards providing exceptional healthcare services to our patients. Your expertise, dedication, and commitment to delivering the best medical care align perfectly with our mission.
      
          Our platform offers a comprehensive solution for patients to access a wide range of health procedures and connect with the best doctors at your hospital. We are excited to collaborate with you and showcase the exceptional services you offer.
      
          Our team is available to assist you in setting up your profile, managing appointments, and ensuring a seamless experience for both you and our valued patients. Should you require any guidance or have any questions, please don't hesitate to reach out to our caring support team.
      
          Thank you for choosing to partner with us. Together, we will make a positive impact on the healthcare journey of countless individuals.
      
          With warm regards,
          [ My Health Saver]
      
          Note: This email is intended solely for the named recipient and may contain confidential or privileged information. If you have received this email in error, please notify us immediately and delete it from your system.`;

          console.log(recipient, subject, body);
          sendEmailNotification(
            shouldSendEmail,
            recipient,
            subject,
            emailTemplate
          );
        }

        console.log("User signed up:", provider_id);
        HMlogger.info("Provider data inserting data into database");
        res.json({ provider_id, sessionId: sessions });
      }
    });
  });
});

module.exports = router;

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const conn = require("../db/conn");
const pool = require("../db/conn");
const mysql = require("mysql2/promise");
const HMlogger = require("../routes/logger");
const util = require("util");
const multer = require("multer");
const router = express.Router();
const Razorpay = require("razorpay");
const { v4: uuidv4 } = require("uuid");

const fileUpload = require("express-fileupload");

const AWS = require("aws-sdk");
const fs = require("fs");
const sendEmailNotification = require("./notification");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

// // consultation payment API
router.post("/consultationpayment", (req, res) => {
  console.log(req.body);
  let { amount, patient_id } = req.body;

  console.log("Parsed amount:", amount);

  var instance = new Razorpay({
    key_id: "rzp_test_LerHhmnSru6RuL",
    key_secret: "FhKgFWpozlZnLNa23p4x1VUh",
  });

  var options = {
    amount: amount / 100, // amount in the smallest currency unit
    currency: "INR",
    receipt: "order_rcptid_11",
  };

  instance.orders.create(options, function (err, order) {
    if (err) {
      console.error("Error creating order:", err);
      return res
        .status(500)
        .json({ success: false, error: "Error creating order" });
    }
    const query =
      "INSERT INTO Transactions (amount, order_id, patient_id) VALUES (?,?,?)";
    const values = [options.amount, options.receipt, patient_id];
    console.log("values==>", values);

    pool.query(query, values, (err, results) => {
      if (err) {
        console.error("Error saving order in the database:", err);
        return res.status(500).json({
          success: false,
          error: "Error saving order in the database",
        });
      } else {
        HMlogger.info("insert in consultation record");
        res.status(201).json({ success: true, order, amount: order.amount });
        console.log("Order saved in the database!");
      }
      // email notification
      if (results) {
        console.log("======2");
        const insertedtransaction_id = results.insertId;
        const selectQuery = `
        SELECT p.email, p.firstname, p.patient_id, d.id as doctor_id, d.name as doctor_name, pr.pname, c.consult_id, c.consultation_time,
        c.consultation_date, pv.name, pv.address, pv.city, pv.state, pv.phone, t.amount, t.id as transaction_id
        FROM consultation c
        JOIN patients p ON p.patient_id = c.patient_id
        JOIN Transactions t ON t.patient_id = p.patient_id
        JOIN doctors d ON c.doctor_id = d.id
        JOIN procedures pr ON c.procedure_id = pr.id
        JOIN providers pv ON pv.provider_id = pr.provider_id
        WHERE t.patient_id = ? AND t.id = ?
        ORDER BY c.consult_id DESC
        LIMIT 1;
      `;
        pool.query(
          selectQuery,
          [patient_id, insertedtransaction_id],
          (error, results) => {
            if (error) {
              console.error(error);
              HMlogger.error("An error occurred");
              return res
                .status(500)
                .json({ success: false, error: "An error occurred" });
            }

            console.log("====6", results);

            if (results && results.length > 0) {
              const recipient = results[0].email.trim();
              const subject =
                "Appointment Confirmation for " + results[0].pname;
              const body = "Welcome!";
              const emailTemplate = `
            Dear ${results[0].firstname},

            Thank you for booking an appointment with our caring healthcare community! We are delighted to serve you.

            Appointment Details:
            Doctor: ${results[0].doctor_name}
            Procedure Name: ${results[0].pname}
            Date: ${results[0].consultation_date}
            Time: ${results[0].consultation_time}
            Hospital Name: ${results[0].name}
            Hospital Address: ${results[0].address}
            City: ${results[0].city}
            State: ${results[0].state}
            Please call on below Hospital Contact Number for more details or any queries.
            Hospital Phone: ${results[0].phone}


            We have received your payment of Rs.${results[0].amount} for the appointment. If you have any questions or need to make any changes to your appointment, please don't hesitate to reach out to us.

            Our dedicated team is committed to providing you with exceptional care and ensuring your well-being every step of the way. If you need any further assistance or have any concerns, please feel free to contact us.

            Thank you for choosing us for your healthcare needs. We look forward to seeing you at your appointment.

            With heartfelt regards,
            [My Health Saver]

            Note: This email is intended solely for the named recipient and may contain confidential or privileged information. If you have received this email in error, please notify us immediately and delete it from your system.`;

              console.log(recipient, subject, body);
              sendEmailNotification(true, recipient, subject, emailTemplate);
            }
          }
        );
      }
    });
  });
});
// // procedure booking payment API
router.post("/procedurebookingpayment", (req, res) => {
  console.log(req.body);
  let { amount, patient_id } = req.body;

  console.log("Parsed amount:", req.body);

  var instance = new Razorpay({
    key_id: "rzp_test_LerHhmnSru6RuL",
    key_secret: "FhKgFWpozlZnLNa23p4x1VUh",
  });

  var options = {
    amount: amount / 100, // amount in the smallest currency unit
    currency: "INR",
    receipt: "order_rcptid_11",
  };

  instance.orders.create(options, function (err, order) {
    if (err) {
      console.error("Error creating order:", err);
      return res
        .status(500)
        .json({ success: false, error: "Error creating order" });
    }

    const query =
      "INSERT INTO Transactions (amount, order_id, patient_id) VALUES (?,?,?)";
    const values = [options.amount, options.receipt, patient_id];
    console.log("values==>", values);

    pool.query(query, values, (err, results) => {
      if (err) {
        console.error("Error saving order in the database:", err);
        return res.status(500).json({
          success: false,
          error: "Error saving order in the database",
        });
      } else {
        HMlogger.info("insert in booking record");
        res.status(201).json({ success: true, order, amount: order.amount });
        console.log("Order saved in the database!");
      }
      // email notification code
      if (results) {
        console.log("======2");
        const insertedtransaction_id = results.insertId;
        const selectQuery = `
        SELECT p.email, p.firstname, p.patient_id, pr.pname, pr.price, pr.duration,
        pv.name, pv.provider_id, pv.address, pv.city, pv.state, pv.phone, t.amount, t.id as transaction_id, b.id
        FROM booking_history b
        JOIN patients p ON p.patient_id = b.patient_id
        JOIN Transactions t ON t.patient_id = p.patient_id
        JOIN procedures pr ON b.procedure_id = pr.id
        JOIN providers pv ON pv.provider_id = pr.provider_id
        WHERE t.patient_id = ? AND t.id = ?
        ORDER BY b.id DESC
        LIMIT 1;
      `;

        pool.query(
          selectQuery,
          [patient_id, insertedtransaction_id],
          (error, results) => {
            if (error) {
              console.error(error);
              HMlogger.error("An error occurred");
              return res
                .status(500)
                .json({ success: false, error: "An error occurred" });
            }

            console.log("====6", results);

            if (results && results.length > 0) {
              const recipient = results[0].email.trim();
              const subject = "Booking Confirmation for " + results[0].pname;
              const body = "Welcome!";
              const emailTemplate = `
            Dear ${results[0].firstname},

            Thank you for booking an appointment with our caring healthcare community! We are delighted to serve you.

            Booking Details:
            Procedure: ${results[0].pname}
            Duration: ${results[0].duration} mins
            Hospital Name: ${results[0].name}
            Hospital Address: ${results[0].address}
            City: ${results[0].city}
            State: ${results[0].state}
            Please call on below Hospital Contact Number for more details or any queries
            Hospital Phone: ${results[0].phone}

            We have received your payment of Rs.${results[0].amount} for the booking. If you have any questions or need to make any changes to your booking, please don't hesitate to reach out to us.

            Our dedicated team is committed to providing you with exceptional care and ensuring your well-being every step of the way. If you need any further assistance or have any concerns, please feel free to contact us.

            Thank you for choosing us for your healthcare needs. We look forward to serving you.

            With heartfelt regards,
            [My Health Saver]

            Note: This email is intended solely for the named recipient and may contain confidential or privileged information. If you have received this email in error, please notify us immediately and delete it from your system.`;

              console.log(recipient, subject, body);
              sendEmailNotification(true, recipient, subject, emailTemplate);
            }
          }
        );
      }
    });
  });
});

// Configure AWS SDK
AWS.config.update({
  accessKeyId: "AKIAVT23DX5AGGINZDVD",
  secretAccessKey: "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",
  region: "ap-south-1",
});

// Create a Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/patient/"); // Set the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
    const filename = Date.now() + "" + req.body.pname + "" + file.originalname;
    cb(null, filename); // Set the filename for the uploaded file
  },
});

// Create a Multer upload instance with the storage configuration
const upload = multer({ storage: storage });

app.use(upload.single("profileImage"));

router.get("/api/patients/:patientId", (req, res) => {
  const patientId = req.params.patientId;

  // Execute a database query to retrieve the patient data
  const query = `SELECT * FROM patients WHERE patient_id = ${patientId}`;
  pool.query(query, (err, rows) => {
    if (err) {
      // Handle any errors
      // console.error('Error executing query:', err);
      HMlogger.error("An error occurred"); // Logging the error
      res.status(500).json({ error: "An error occurred" });
    } else {
      // Return the patient data as JSON
      if (rows.length === 0) {
        HMlogger.error("Patient not found"); // Logging the error
        res.status(404).json({ error: "Patient not found" });
      } else {
        const patientData = rows[0];
        const imageUrl = patientData.profile_image_url;

        if (imageUrl) {
          HMlogger.info("Patient data  with image found"); // Logging the error
          // If profile image URL exists, you can send it in the response
          res.json({ ...patientData, profile_image_url: `${imageUrl}` });
        } else {
          HMlogger.info("Patient found"); // Logging the error
          res.json(patientData);
        }
      }
    }
  });
});

router.put(
  "/api/patients/:patientId",
  upload.single("profile_image_url"),
  async (req, res) => {
    try {
      const patientId = req.params.patientId;
      const {
        username,
        password,
        firstname,
        lastname,
        email,
        age,
        gender,
        address,
        dob,
        phone,
      } = req.body;
      const file = req.file; // Uploaded file
      console.log(file);

      // Check if a profile image was uploaded
      if (file) {
        // Validate file type
        if (!["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
          HMlogger.error(
            "This format is not allowed, please upload an image with '.png', '.gif', '.jpg'"
          ); // Logging the error
          return res
            .status(400)
            .send(
              "This format is not allowed, please upload an image with '.png', '.gif', '.jpg'"
            );
        }

        // Set maximum allowed file size in bytes (e.g., 2MB)
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
          HMlogger.error(
            "The uploaded image exceeds the maximum allowed file size."
          ); // Logging the error
          return res
            .status(400)
            .send("The uploaded image exceeds the maximum allowed file size.");
        }

        const uploadPath = file.path;

        // Read the image file from local disk
        const imageFile = fs.readFileSync(uploadPath);
        const s3 = new AWS.S3();
        // Set the S3 bucket name and key (file name)
        const bucketName = "healthsever/patient";
        const keyName = file.filename;
        // Set the S3 parameters
        const params = {
          Bucket: bucketName,
          Key: keyName,
          Body: imageFile,
        };

        // Upload the image to S3
        const s3UploadResult = await s3.upload(params).promise();
        const imageUrl = s3UploadResult.Location;
        const imagePath = imageUrl.toString();

        // Execute a database query to update the patient data, including the profile image URL
        const query = `UPDATE patients SET username = ?, password = ?, firstname = ? , lastname = ? ,  email = ?, age = ?, gender = ?, address = ?, dob = ? , phone = ? , profile_image_url = ? WHERE patient_id = ?`;
        pool.query(
          query,
          [
            username,
            password,
            firstname,
            lastname,
            email,
            age,
            gender,
            address,
            dob,
            phone,
            imagePath,
            patientId,
          ],
          (err, result) => {
            if (err) {
              // Handle any errors
              console.error("Error executing query:", err);
              HMlogger.error("An error occurred"); // Logging the error
              res.status(500).json({ error: "An error occurred" });
            } else {
              if (result.affectedRows === 0) {
                // No patient found with the given ID
                HMlogger.error("Patient not found"); // Logging the error
                res.status(404).json({ error: "Patient not found" });
              } else {
                HMlogger.info("Patient updated successfully"); // Logging the error
                res.json({ message: "Patient updated successfully" });
              }
            }
          }
        );
      } else {
        // If no profile image was uploaded, update patient data including the possibility of clearing the profile_image_url
        const query = `UPDATE patients SET username = ?, password = ?, firstname = ? , lastname = ? , email = ?, age = ?, gender = ?, address = ? ,dob = ? , phone = ?  WHERE patient_id = ?`;
        pool.query(
          query,
          [
            username,
            password,
            firstname,
            lastname,
            email,
            age,
            gender,
            address,
            dob,
            phone,
            patientId,
          ],
          (err, result) => {
            if (err) {
              // Handle any errors
              console.error("Error executing query:", err);
              HMlogger.error("An error occurred"); // Logging the error
              res.status(500).json({ error: "An error occurred" });
            } else {
              if (result.affectedRows === 0) {
                // No patient found with the given ID
                HMlogger.error("Patient not found"); // Logging the error
                res.status(404).json({ error: "Patient not found" });
              } else {
                HMlogger.info("Patient updated successfully"); // Logging the error
                res.json({ message: "Patient updated successfully" });
              }
            }
          }
        );
      }
    } catch (err) {
      console.error(err);
      HMlogger.error("An error occurred"); // Logging the error
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

//  practice consultation

router.post("/posts", (req, res) => {
  const { procedure, doctor, name, phone, date, description, time } = req.body;

  const post = {
    procedure,
    doctor,
    name,
    phone,
    date,
    description,
    time,
  };

  // Insert the post into the database
  db.query("INSERT INTO consultation SET ?", post, (err, result) => {
    if (err) {
      HMlogger.error("An error occurred"); // Logging the error
      console.error("Error creating post:", err);
      res.status(500).send("Error creating post");
    } else {
      HMlogger.info("Post created:"); // Logging the error
      console.log("Post created:", result);
      res.status(201).send("Post created");
    }
  });
});

router.put(
  "/api/patients/:patientId",
  upload.single("profile_image_url"),
  async (req, res) => {
    try {
      const patientId = req.params.patientId;
      const {
        username,
        password,
        firstname,
        lastname,
        email,
        age,
        gender,
        address,
        dob,
        phone,
      } = req.body;
      const file = req.file; // Uploaded file
      console.log(file);

      // Check if a profile image was uploaded
      if (file) {
        // Validate file type
        if (!["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
          HMlogger.error(
            "This format is not allowed, please upload an image with '.png', '.gif', '.jpg'"
          ); // Logging the error
          return res
            .status(400)
            .send(
              "This format is not allowed, please upload an image with '.png', '.gif', '.jpg'"
            );
        }

        // Set maximum allowed file size in bytes (e.g., 2MB)
        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
          HMlogger.error(
            "The uploaded image exceeds the maximum allowed file size."
          ); // Logging the error
          return res
            .status(400)
            .send("The uploaded image exceeds the maximum allowed file size.");
        }

        const uploadPath = file.path;

        // Read the image file from local disk
        const imageFile = fs.readFileSync(uploadPath);
        const s3 = new AWS.S3();
        // Set the S3 bucket name and key (file name)
        const bucketName = "healthsever";
        const keyName = file.filename;
        // Set the S3 parameters
        const params = {
          Bucket: bucketName,
          Key: keyName,
          Body: imageFile,
        };

        // Upload the image to S3
        const s3UploadResult = await s3.upload(params).promise();
        const imageUrl = s3UploadResult.Location;
        const imagePath = imageUrl.toString();

        // Execute a database query to update the patient data, including the profile image URL
        const query = `UPDATE patients SET username = ?, password = ?, firstname = ? , lastname = ? ,  email = ?, age = ?, gender = ?, address = ?, dob = ? , phone = ? , profile_image_url = ? WHERE patient_id = ?`;
        pool.query(
          query,
          [
            username,
            password,
            firstname,
            lastname,
            email,
            age,
            gender,
            address,
            dob,
            phone,
            imagePath,
            patientId,
          ],
          (err, result) => {
            if (err) {
              // Handle any errors
              console.error("Error executing query:", err);
              HMlogger.error("An error occurred"); // Logging the error
              res.status(500).json({ error: "An error occurred" });
            } else {
              if (result.affectedRows === 0) {
                // No patient found with the given ID
                HMlogger.error("Patient not found"); // Logging the error
                res.status(404).json({ error: "Patient not found" });
              } else {
                HMlogger.info("Patient updated successfully"); // Logging the error
                res.json({ message: "Patient updated successfully" });
              }
            }
          }
        );
      } else {
        // If no profile image was uploaded, update patient data including the possibility of clearing the profile_image_url
        const query = `UPDATE patients SET username = ?, password = ?, firstname = ? , lastname = ? , email = ?, age = ?, gender = ?, address = ? ,dob = ? , phone = ?  WHERE patient_id = ?`;
        pool.query(
          query,
          [
            username,
            password,
            firstname,
            lastname,
            email,
            age,
            gender,
            address,
            dob,
            phone,
            patientId,
          ],
          (err, result) => {
            if (err) {
              // Handle any errors
              console.error("Error executing query:", err);
              HMlogger.error("An error occurred"); // Logging the error
              res.status(500).json({ error: "An error occurred" });
            } else {
              if (result.affectedRows === 0) {
                // No patient found with the given ID
                HMlogger.error("Patient not found"); // Logging the error
                res.status(404).json({ error: "Patient not found" });
              } else {
                HMlogger.info("Patient updated successfully"); // Logging the error
                res.json({ message: "Patient updated successfully" });
              }
            }
          }
        );
      }
    } catch (err) {
      console.error(err);
      HMlogger.error("An error occurred"); // Logging the error
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

//  practice consultation

router.post("/posts", (req, res) => {
  const { procedure, doctor, name, phone, date, description, time } = req.body;

  const post = {
    procedure,
    doctor,
    name,
    phone,
    date,
    description,
    time,
  };

  // Insert the post into the database
  db.query("INSERT INTO consultation SET ?", post, (err, result) => {
    if (err) {
      HMlogger.error("An error occurred"); // Logging the error
      console.error("Error creating post:", err);
      res.status(500).send("Error creating post");
    } else {
      HMlogger.info("Post created:"); // Logging the error
      console.log("Post created:", result);
      res.status(201).send("Post created");
    }
  });
});

// api to fetch list of procedures and procedure related providers ;

router.get("/Procedure/procedures/patient", (req, res) => {
  // const { procedure } = req.body;

  try {
    // Query the database for procedures with matching name and provider city
    pool.query(
      `SELECT *
      FROM procedures p
      JOIN providers pr ON p.provider_id = pr.provider_id ;`,
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("Procedure not found"); // Logging the error
          res
            .status(400)
            .send({ success: false, error: "Procedure not found" });
          return;
        }
        HMlogger.info("fetch procedures"); // Logging the error
        res.json({ success: true, procedureName: results });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch procedures"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch procedures" });
  }
});

// Give only Doctor Name
router.get("/Procedure/doctor/patient", (req, res) => {
  try {
    // Query the database for procedures with matching name and provider city
    pool.query(`SELECT name , id FROM doctors `, (error, results) => {
      if (error) {
        // Handle any errors that occurred during the query
        console.error(error);
        HMlogger.error("An error occurred"); // Logging the error
        res.status(500).send({ success: false, error: "An error occurred" });
        return;
      }

      if (results.length === 0) {
        HMlogger.error("doctorsName not found"); // Logging the error
        res
          .status(400)
          .send({ success: false, error: "doctorsName not found" });
        return;
      }
      HMlogger.info(" fetch doctorsName"); // Logging the error
      res.json({ success: true, doctorsName: results });
    });
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch doctorsName"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch doctorsName" });
  }
});

// to get list of provideres

router.get("/providers/patient", (req, res) => {
  try {
    // Query the database for procedures with matching name and provider city
    pool.query(
      `SELECT name , provider_id FROM providers `,
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("Provider not found"); // Logging the error
          res.status(400).send({ success: false, error: "Provider not found" });
          return;
        }
        HMlogger.info(" fetch providers"); // Logging the error
        res.json({ success: true, providerName: results });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch providers"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch providers" });
  }
});

// procedure with id , providers based on procedure id
router.get("/Procedure/providers/:procedureId", (req, res) => {
  const { procedureId } = req.params;

  // Validate input
  if (!procedureId) {
    HMlogger.error("Missing required parameter: providerId"); // Logging the error
    res.status(400).json({
      success: false,
      error: "Missing required parameter: procedureId",
    });
    return;
  }

  try {
    // Query the database to fetch provider names for the specified procedure ID
    pool.query(
      `SELECT p.provider_id,p.pname, pr.name, d.name AS doctor_name, d.doctor_image , d.id
      FROM providers pr
      JOIN procedures p ON pr.provider_id = p.provider_id
      JOIN doctors d ON d.id = pr.provider_id
      WHERE p.id = ?
      
      `,
      [procedureId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("Providers not found for the specified procedure"); // Logging the error
          res.status(404).send({
            success: false,
            error: "Providers not found for the specified procedure",
          });
          return;
        }

        // Extract provider names from the result rows
        const provider = results.map((row) => ({
          providerId: row.provider_id,
          pname: row.pname,
          name: row.name,
          doctorName: row.doctor_name,
          image: row.doctor_image,
          doctor_id: row.id,
        }));
        HMlogger.info("fetch provider names"); // Logging the error
        res.json({ success: true, provider });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch provider names"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch provider names" });
  }
});

//  number of doctors based on procedure name
router.post("/api/doctors/procedures", (req, res) => {
  const { procedureName } = req.body;

  // Fetch columns from doctors and procedure tables based on procedure name
  const query = `
    SELECT doctors.*, procedures.* ,providers.*,doctors.name AS doctor_name
    FROM doctors
    JOIN procedures ON doctors.id = procedures.doctor_id
    Join providers ON doctors.id = providers.provider_id
    WHERE procedures.pname LIKE CONCAT('%', ?, '%')
  `;

  pool.query(query, [procedureName], (err, results) => {
    if (err) {
      console.error("Error fetching data from the database:", err);
      res.status(500).json({ error: "Failed to fetch data" });
      return;
    }

    res.json(results);
  });
});

//  based on provider id fetching procedure and doctors

router.get("/Procedure/doctors/:providerId", (req, res) => {
  const { providerId } = req.params;

  // Validate input
  if (!providerId) {
    HMlogger.error("Missing required parameter: providerId"); // Logging the error
    res.status(400).json({
      success: false,
      error: "Missing required parameter: providerId",
    });
    return;
  }

  try {
    // Query the database to fetch procedure data and doctors' names for the specified provider ID
    pool.query(
      `SELECT  pr.pname, d.id, d.name AS doctor_name
FROM procedures pr
JOIN providers p ON pr.provider_id = p.provider_id
JOIN doctors d ON d.id = pr.doctor_id
WHERE p.provider_id = ?

      `,
      [providerId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("Procedures not found for the specified provider"); // Logging the error
          res.status(404).send({
            success: false,
            error: "Procedures not found for the specified provider",
          });
          return;
        }

        // Extract procedure data and doctors' names from the result rows
        const procedures = results.map((row) => ({
          procedureId: row.procedure_id,
          procedureName: row.pname,
          doctorId: row.doctor_id,
          doctorName: row.doctor_name,
        }));
        HMlogger.info("fetch procedure data and doctors' names"); // Logging the error
        res.json({ success: true, procedures });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch procedure data and doctors' names"); // Logging the error
    res.status(500).json({
      success: false,
      error: "Failed to fetch procedure data and doctors' names",
    });
  }
});

//  SUBMIT APPOINTMENT

//  SUBMIT APPOINTMENT
router.post("/api/patients/consultation", (req, res) => {
  const {
    consultation_date,
    consultation_time,
    consultation_notes,
    procedure_id,
    patient_id,
    doctor_id,
  } = req.body;

  // Execute a database query to update the patient data
  const query =
    "INSERT INTO consultation ( consultation_date, consultation_notes, procedure_id, consultation_time, patient_id , doctor_id ) VALUES ( ?, ?, ?, ? , ? , ?)";
  pool.query(
    query,
    [
      consultation_date,
      consultation_notes,
      procedure_id,
      consultation_time,
      patient_id,
      doctor_id,
    ],
    (error, results) => {
      console.log("======");
      if (error) {
        console.error(error);
        HMlogger.error("An error occurred"); // Logging the error
        return res
          .status(500)
          .send({ success: false, error: "An error occurred" });
      } else {
        res.json({ success: true, record: results[0] });
      }
    }
  );
});

// consultation history get api

router.get("/consultation/booked/:docId", (req, res) => {
  const { docId } = req.params;

  try {
    // Query the database to fetch data from the consultation table
    pool.query(
      "SELECT * FROM consultation WHERE doctor_id = ?",
      [docId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("No consultations found"); // Logging the error
          res
            .status(400)
            .send({ success: false, error: "No consultations found" });
          return;
        }
        HMlogger.info("consultations: results"); // Logging the error
        res.json({ success: true, consultations: results });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch consultations"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch consultations" });
  }
});

// update api to update the status of booking procedure

router.put("/api/patients/booking/update/:booking_id", (req, res) => {
  const bookingId = req.params.booking_id;
  const { status } = req.body;

  // Execute a database query to update the booking status in the booking_history table
  const query = "UPDATE booking_history SET status = ? WHERE id = ?";
  pool.query(query, [status, bookingId], (error, results) => {
    if (error) {
      console.error(error);
      return res
        .status(500)
        .send({ success: false, error: "An error occurred" });
    }

    res.json({ success: true, record: results });
  });
});

// api to get pname to set pname and get doctors on bookdoctors page
router.get("/procedure/name/:procedureId", (req, res) => {
  const { procedureId } = req.params;

  try {
    // Query the database to fetch data from the procedure table
    pool.query(
      "SELECT pname FROM procedures WHERE id = ?",
      [procedureId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("No procedure found"); // Logging the error
          res.status(400).send({ success: false, error: "No procedure found" });
          return;
        }
        const procedureName = results[0].pname;
        HMlogger.info(`Procedure name: ${procedureName}`); // Logging the result
        res.json({ success: procedureName });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch procedure"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch procedure" });
  }
});

// get all the doctores

router.get("/doctors/:providerId", (req, res) => {
  const { providerId } = req.params;

  // Validate input
  if (!providerId) {
    HMlogger.error("Missing required parameter: procedureId"); // Logging the error
    res.status(400).json({
      success: false,
      error: "Missing required parameter: procedureId",
    });
    return;
  }

  try {
    // Query the database to fetch data from the consultation table
    pool.query(
      "SELECT * FROM doctors WHERE provider_id = ? ",
      [providerId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          HMlogger.error("An error occurred"); // Logging the error
          console.error(error);
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("No doctor found"); // Logging the error
          res.status(400).send({ success: false, error: "No doctor found" });
          return;
        }
        HMlogger.info(" doctors: results"); // Logging the error
        res.json({ success: true, doctors: results });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Error updating provider profile"); // Logging the error
    res.status(500).json({ success: false, error: "Failed to fetch doctors" });
  }
});

// delete api for consultation
router.delete("/consultation/delete/:consultationId", (req, res) => {
  const consultationId = req.params.consultationId;

  try {
    // Query the database to delete the consultation based on the consultation ID
    pool.query(
      "DELETE FROM consultation WHERE consult_id = ?",
      [consultationId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.affectedRows === 0) {
          HMlogger.error("Consultation not found"); // Logging the error
          res
            .status(404)
            .send({ success: false, error: "Consultation not found" });
          return;
        }
        HMlogger.info("Consultation deleted successfully"); // Logging the error
        res.json({
          success: true,
          message: "Consultation deleted successfully",
        });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to delete consultation"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to delete consultation" });
  }
});

router.get("/consultation/:patientId", (req, res) => {
  const patientId = req.params.patientId;

  try {
    // Query the database to fetch data from the consultation table based on patient ID
    pool.query(
      "SELECT c.*, p.*, d.* FROM consultation c INNER JOIN procedures p ON c.procedure_id = p.id INNER JOIN doctors d ON c.doctor_id = d.id WHERE c.patient_id = ? ",
      [patientId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          HMlogger.error("An error occurred"); // Logging the error
          console.error(error);
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("No consultations found"); // Logging the error
          res
            .status(400)
            .send({ success: false, error: "No consultations found" });
          return;
        }
        HMlogger.info("fetch consultations"); // Logging the error
        res.json({ success: true, consultations: results });
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Failed to fetch consultations"); // Logging the error
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch consultations" });
  }
});

// post api for booking procedure ,,, booking history
router.post("/api/patients/booking", (req, res) => {
  const { procedure_id, patient_id, status } = req.body;

  // Execute a database query to insert the booking into the booking_history table
  const query =
    "INSERT INTO booking_history (patient_id, procedure_id ,status) VALUES (?, ? ,?)";
  pool.query(query, [patient_id, procedure_id, status], (error, results) => {
    if (error) {
      console.error(error);
      return res
        .status(500)
        .send({ success: false, error: "An error occurred" });
    }

    res.json({ success: true, record: results });
  });
});

// api to delete booking history based on booking id

router.delete("/booking/:bookingId", (req, res) => {
  const bookingId = req.params.bookingId;

  try {
    // Query the database to delete the booking history based on the booking ID
    pool.query(
      "DELETE FROM booking_history WHERE id = ?",
      [bookingId],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(error);
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.affectedRows === 0) {
          res
            .status(404)
            .send({ success: false, error: "Booking history not found" });
          return;
        }

        res.json({
          success: true,
          message: "Booking history deleted successfully",
        });
      }
    );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete booking history" });
  }
});

// Route to fetch procedure data based on procedure name , used in book appointment when we select procedure from front page
router.post("/api", (req, res) => {
  const { procedureNamee } = req.body;

  // Fetch data from the procedures table based on procedure name
  const query = `
    SELECT *
    FROM procedures
    WHERE pname LIKE CONCAT('%', ?, '%')
  `;

  // Execute the query with the procedure name as a parameter
  pool.query(query, [procedureNamee], (err, results) => {
    if (err) {
      console.error("Error fetching data from the database:", err);
      res.status(500).json({ error: "Failed to fetch data" });
      return;
    }

    res.json(results);
  });
});

module.exports = router;

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const conn = require("../db/conn");
const pool = require("../db/conn");
const mysql = require("mysql2");
const multer = require("multer");
const fileUpload = require("express-fileupload");
const AWS = require("aws-sdk");
const fs = require("fs");
const router = express.Router();
const HMlogger = require("../routes/logger");

const app = express();
app.use(express.json());
app.use(fileUpload());

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configure AWS SDK
AWS.config.update({
  accessKeyId: 'AKIAVT23DX5AGGINZDVD',
  secretAccessKey: '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',
  region: 'ap-south-1'
});
// Create a Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/doctors/"); // Set the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
    const filename =
      Date.now() + "_" + req.body.pname + "_" + file.originalname;
    cb(null, filename); // Set the filename for the uploaded file
  },
});

// Create a Multer upload instance with the storage configuration
const upload = multer({ storage: storage });

// Provider doctor search
router.get("/provider/doctor/search/:selectedoctorlist", (req, res) => {
  const { selectedoctorlist } = req.params;
  console.log(selectedoctorlist);
  // Query the database for the procedure with the specified provider ID and procedure name
  pool.query(
    `SELECT *
    FROM doctors
    WHERE id = ? `,
    [selectedoctorlist],
    (error, results) => {
      if (error) {
        HMlogger.error("An error occurred"); // Logging the error
        console.error(error);
        res.status(500).send({ success: false, error: "An error occurred" });
      } else {
        HMlogger.info("Doctor search successful"); // Logging the success
        res.json({ success: true, doctor: results });
      }
    }
  );
});

// Provider doctor search
router.get("/provider/doctors/search/:providerId", (req, res) => {
  const { providerId } = req.params;
  console.log(providerId);
  // Query the database for the procedure with the specified provider ID and procedure name
  pool.query(
    `SELECT *
    FROM doctors
    WHERE provider_id = ?`,
    [providerId],
    (error, results) => {
      if (error) {
        HMlogger.error("An error occurred"); // Logging the error
        console.error(error);
        res.status(500).send({ success: false, error: "An error occurred" });
      } else {
        HMlogger.info("Doctor search successful"); // Logging the success
        res.json({ success: true, doctors: results });
      }
    }
  );
});

/////PROVIDER'S DOCTOR CREATE QUERY////////, upload.single('photo')
router.post("/Doctor/AddNew", upload.single("photo"), async (req, res) => {
  try {
    const { name, email, specialty, bio, created_at, phone, pId } = req.body;
    const file = req.file;

    if (!file) {
      HMlogger.error("No files were uploaded."); // Logging the error
      return res.status(400).send("No files were uploaded.");
    }

    if (!["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
      HMlogger.error(
        "This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension."
      ); // Logging the error
      return res
        .status(400)
        .send(
          "This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension."
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

    // Create an S3 instance
    const s3 = new AWS.S3();
    // Read the image file from local disk
    const imageFile = fs.readFileSync(uploadPath);
    // Set the S3 bucket name and key (file name)
    const bucketName = "healthsever/Doctor";
    const keyName = file.filename;
    // Set the S3 parameters
    const params = {
      Bucket: bucketName,
      Key: keyName,
      Body: imageFile,
    };

    // Upload the image to S3
    const s3UploadResult = await s3.upload(params).promise();
    const image_url = s3UploadResult.Location;
    const imagePath = image_url.toString();

    pool.query(
      "SELECT provider_id FROM providers WHERE provider_id = ?",
      [pId],
      (error, results) => {
        if (error) {
          console.error(error);
          HMlogger.error("An error occurred"); // Logging the error
          return res
            .status(500)
            .send({ success: false, error: "An error occurred" });
        }
        if (results.length === 0) {
          HMlogger.error("Invalid provider_id"); // Logging the error
          return res
            .status(400)
            .send({ success: false, error: "Invalid provider_id" });
        }

        const values = [
          name,
          email,
          phone,
          specialty,
          bio,
          pId,
          created_at,
          imagePath,
        ];

        pool.query(
          `INSERT INTO doctors(name, email, phone, specialty, bio, provider_id, created_at, doctor_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values,
          (err, result) => {
            if (err) {
              console.error(err);
              HMlogger.error("Error inserting data into the database"); // Logging the error
              res.status(500).send("Error inserting data into the database");
            } else {
              console.log("Data inserted into the database");
              HMlogger.info("Doctor Data inserted into the database"); // Logging the error
              res.json({ success: true, doctor: results });
            }
          }
        );
      }
    );
  } catch (err) {
    console.error(err);
    HMlogger.error("Internal server error"); // Logging the error
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

///////DOCTOR UPDATE QUERYY////////

router.put("/doctordetails/:id", upload.single("photo"), async (req, res) => {
  try {
    const { name, email, phone, specialty, bio, created_at, updated_at, pId } =
      req.body;
    const doctor_id = req.params.id;
    const file = req.file;

    if (!file) {
      pool.query(
        "SELECT provider_id FROM providers WHERE provider_id = ?",
        [pId],
        (error, results) => {
          if (error) {
            console.error(error);
            return res
              .status(500)
              .send({ success: false, error: "An error occurred" });
          }
          if (results.length === 0) {
            return res
              .status(400)
              .send({ success: false, error: "Invalid provider_id" });
          }

          // Update the database query
          pool.query(
            "UPDATE doctors SET name=?, email=?, phone=?, specialty=?, bio=?, created_at=?, updated_at=?, provider_id=? WHERE id=?",
            [
              name,
              email,
              phone,
              specialty,
              bio,
              created_at,
              updated_at,
              pId,
              doctor_id,
            ],
            (error, results) => {
              if (error) {
                console.error(error);
                res.status(500).json({
                  success: false,
                  error: "An error occurred during doctor update",
                });
              } else {
                res.json({ success: true, doctor: results });
              }
            }
          );
        }
      );
    } else {
      if (!["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
        return res
          .status(400)
          .send(
            "This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension."
          );
      }

      // Set maximum allowed file size in bytes (e.g., 2MB)
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        return res
          .status(400)
          .send("The uploaded image exceeds the maximum allowed file size.");
      }

      const uploadPath = file.path;

      // Create an S3 instance
      const s3 = new AWS.S3();
      // Read the image file from local disk
      const imageFile = fs.readFileSync(uploadPath);
      // Set the S3 bucket name and key (file name)
      const bucketName = "healthsever/Doctor";
      const keyName = file.filename;
      // Set the S3 parameters
      const params = {
        Bucket: bucketName,
        Key: keyName,
        Body: imageFile,
      };

      // Upload the image to S3
      const s3UploadResult = await s3.upload(params).promise();
      const image_url = s3UploadResult.Location;
      const imagePath = image_url.toString();

      pool.query(
        "SELECT provider_id FROM providers WHERE provider_id = ?",
        [pId],
        (error, results) => {
          if (error) {
            console.error(error);
            return res
              .status(500)
              .send({ success: false, error: "An error occurred" });
          }
          if (results.length === 0) {
            return res
              .status(400)
              .send({ success: false, error: "Invalid provider_id" });
          }

          // Update the database query
          pool.query(
            "UPDATE doctors SET name=?, email=?, phone=?, specialty=?, bio=?, created_at=?, updated_at=?, provider_id=?, doctor_image=? WHERE id=?",
            [
              name,
              email,
              phone,
              specialty,
              bio,
              created_at,
              updated_at,
              pId,
              imagePath,
              doctor_id,
            ],
            (error, results) => {
              if (error) {
                console.error(error);
                res.status(500).json({
                  success: false,
                  error: "An error occurred during doctor update",
                });
              } else {
                res.json({ success: true, doctor: results });
              }
            }
          );
        }
      );
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

////DOCTOR DELETE QUERY//////
router.delete("/doctor/delete/:id", (req, res) => {
  const doctorId = req.params.id;

  // Check if there are associated records in the procedures table
  const checkProceduresSql = `SELECT id FROM procedures WHERE doctor_id = ${doctorId}`;
  pool.query(
    checkProceduresSql,
    (checkProceduresError, checkProceduresResults) => {
      if (checkProceduresError) {
        console.error(checkProceduresError);
        res.status(500).send("Server error");
      } else {
        if (checkProceduresResults.length > 0) {
          const procedureIds = checkProceduresResults.map(
            (result) => result.id
          );
          // Delete associated records from the booking_history table
          const deleteBookingSql = `DELETE FROM booking_history WHERE procedure_id IN (${procedureIds.join(
            ","
          )})`;
          pool.query(
            deleteBookingSql,
            (deleteBookingError, deleteBookingResults) => {
              if (deleteBookingError) {
                console.error(deleteBookingError);
                res.status(500).send("Server error");
              } else {
                // Delete the procedures after associated records have been deleted
                const deleteProceduresSql = `DELETE FROM procedures WHERE doctor_id = ${doctorId}`;
                pool.query(
                  deleteProceduresSql,
                  (deleteProceduresError, deleteProceduresResults) => {
                    if (deleteProceduresError) {
                      console.error(deleteProceduresError);
                      res.status(500).send("Server error");
                    } else {
                      // Delete the doctor after associated procedures have been deleted
                      const deleteDoctorSql = `DELETE FROM doctors WHERE id = ${doctorId}`;
                      pool.query(
                        deleteDoctorSql,
                        (deleteDoctorError, deleteDoctorResults) => {
                          if (deleteDoctorError) {
                            console.error(deleteDoctorError);
                            res.status(500).send("Server error");
                          } else {
                            res.json({
                              success: false,
                              doctor: deleteDoctorResults,
                            });
                          }
                        }
                      );
                    }
                  }
                );
              }
            }
          );
        } else {
          // No associated procedures found, directly delete the doctor
          const deleteDoctorSql = `DELETE FROM doctors WHERE id = ${doctorId}`;
          pool.query(
            deleteDoctorSql,
            (deleteDoctorError, deleteDoctorResults) => {
              if (deleteDoctorError) {
                console.error(deleteDoctorError);
                res.status(500).send("Server error");
              } else {
                res.json({ success: true, doctor: deleteDoctorResults });
              }
            }
          );
        }
      }
    }
  );
});

module.exports = router;

// const express = require("express");
// const bodyParser = require("body-parser");
// const cors = require("cors");
// const pool = require("../db/pool");
// const mysql = require('mysql2');
// const multer = require('multer');
// const fileUpload = require("express-fileupload");
// const AWS = require('aws-sdk');
// const fs = require('fs');
// const router = express.Router();
// const HMlogger= require('../routes/logger')

// const app = express();
// app.use(express.json());
// app.use(fileUpload());

// // Middleware
// app.use(cors());
// app.use(bodyParser.json());

// // Configure AWS SDK
// AWS.config.update({
//     accessKeyId: 'AKIAVT23DX5AGGINZDVD',
//     secretAccessKey: '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',
//     region: 'ap-south-1'
// });

// // Create a Multer storage configuration
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'uploads/doctors/'); // Set the destination folder for uploaded files
//     },
//     filename: function (req, file, cb) {
//         const filename = Date.now() + "_" + req.body.pname + "_" + file.originalname;
//         cb(null, filename); // Set the filename for the uploaded file
//     },
// });

// // Create a Multer upload instance with the storage configuration
// const upload = multer({ storage: storage });
// //Add new procedure
// // Use Multer middleware to handle the file upload

// // Provider doctor search
// router.get("/provider/doctor/search/:selectedoctorlist", (req, res) => {
//     const { selectedoctorlist } = req.params;
//     console.log(selectedoctorlist);
//     // Query the database for the procedure with the specified provider ID and procedure name
//     pool.query(
//         `SELECT *
//         FROM doctors
//         WHERE id = ? `,
//         [selectedoctorlist],
//         (error, results) => {
//             console.log(results);
//             if (error) {
//                 // Handle any errors that occurred during the query
//                 console.error(error);
//                 res.status(500).send({ success: false, error: "An error occurred" });
//             } else {

//                 res.json({ success: true, doctor: results });
//             }
//         }
//     );
// });

// // Provider doctor search
// router.get("/provider/doctors/search/:providerId", (req, res) => {
//     const { providerId } = req.params;
//     console.log(providerId);
//     // Query the database for the procedure with the specified provider ID and procedure name
//     pool.query(
//         `SELECT *
//       FROM doctors
//       WHERE provider_id = ?`,
//         [providerId],
//         (error, results) => {
//             console.log(results);
//             if (error) {
//                 // Handle any errors that occurred during the query
//                 console.error(error);
//                 res.status(500).send({ success: false, error: "An error occurred" });
//             } else {

//                 res.json({ success: true, doctors: results });
//             }
//         }
//     );
// });

// ////////provider update query////////
// router.put('/providerprofile/:provider_id', upload.single('photo'), async (req, res) => {
//   const provider_id = req.params.provider_id;
//   console.log(provider_id);

//   // Extract the updated data from the request body
//   const {
//     name,
//     speciality,
//     website,
//     phone,
//     age,
//     address,
//     city,
//     state,
//     zipcode,
//     email,
//     country,
//     password
//   } = req.body;
//   const file = req.file;

//   if (!file) {
//     return res.status(400).send('No files were uploaded.');
//   }

//   if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) {
//     return res.status(400).send("This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension.");
//   }

//   // Set maximum allowed file size in bytes (e.g., 2MB)
//   const maxSize = 2 * 1024 * 1024;
//   if (file.size > maxSize) {
//     return res.status(400).send('The uploaded image exceeds the maximum allowed file size.');
//   }

//   const uploadPath = file.path;

//   // Create an S3 instance
//   const s3 = new AWS.S3();
//   // Read the image file from local disk
//   const imageFile = fs.readFileSync(uploadPath);
//   // Set the S3 bucket name and key (file name)
//   const bucketName = 'healthsever/Provider';
//   const keyName = file.filename;
//   // Set the S3 parameters
//   const params = {
//     Bucket: bucketName,
//     Key: keyName,
//     Body: imageFile,
//   };

//   try {
//     // Upload the image to S3 and wait for the result
//     const s3UploadResult = await s3.upload(params).promise();
//     const imagePath = s3UploadResult.Location.toString();
//     console.log("imagePath", imagePath);

//     // Query the database to update the provider record
//     pool.query(
//       `UPDATE providers SET name = ?, speciality = ?, website = ?, phone = ?, age = ?, address = ?, city = ?, state = ?, zipcode = ?, email = ?, country = ?, provider_image = ? WHERE provider_id = ?`,
//       [
//         name,
//         speciality,
//         website,
//         phone,
//         age,
//         address,
//         city,
//         state,
//         zipcode,
//         email,
//         country,
//         imagePath,
//         provider_id
//       ],
//       (error, results) => {
//         if (error) {
//           // Handle any errors that occurred during the query
//           console.error(error);
//           res.status(500).send({ success: false, error: "An error occurred" });
//         } else {
//           res.json({ success: true, message: "Provider updated successfully" });
//         }
//       }
//     );
//   } catch (uploadError) {
//     console.error(uploadError);
//     res.status(500).json({ success: false, error: "An error occurred during image upload" });
//   }
// });

// //////////PROVIDER GET QUERY THROUGH SINGLE ID///////return empty array provider
// router.get('/providerprofile/:provider_id', (req, res) => {
//     const provider_id = req.params.provider_id;
//     console.log(provider_id);

//     // Query the database for the provider with the specified provider_id
//     pool.query(
//       `SELECT * FROM providers WHERE provider_id = ?`,
//       [provider_id],
//       (error, results) => {
//         if (error) {
//           // Handle any errors that occurred during the query
//           console.error(error);
//           res.status(500).send({ success: false, error: "An error occurred" });
//         } else {
//           res.json({ success: true, provider: results });
//         }
//       }
//     );
//   });

//   router.get('/providerprofiles/:procedure_id', (req, res) => {
//     const id = req.params.procedure_id;
//     console.log(id);

//     // Query the database for the provider with the specified provider_id
//     pool.query(
//       `SELECT *
//       FROM doctors
//       JOIN procedures ON doctors.id = procedures.doctor_id
//       WHERE procedures.id = ?;
//       `,
//       [id],
//       (error, results) => {
//         if (error) {
//           // Handle any errors that occurred during the query
//           console.error(error);
//           res.status(500).send({ success: false, error: "An error occurred" });
//         } else {
//           res.json({ success: true, doctor: results });
//         }
//       }
//     );
//   });

// /////PROVIDER'S DOCTOR CREATE QUERY////////, upload.single('photo')
// router.post("/Doctor/AddNew", upload.single('photo'), async (req, res) => {
//   try {
//     const {
//       name,
//       email,
//       specialty,
//       bio,
//       created_at,
//       phone,
//       pId
//     } = req.body;
//     const file = req.file;

//     if (!file) {
//       return res.status(400).send('No files were uploaded.');
//     }

//     if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) {
//       return res.status(400).send("This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension.");
//     }

//     // Set maximum allowed file size in bytes (e.g., 2MB)
//     const maxSize = 2 * 1024 * 1024;
//     if (file.size > maxSize) {
//       return res.status(400).send('The uploaded image exceeds the maximum allowed file size.');
//     }

//     const uploadPath = file.path;

//     // Create an S3 instance
//     const s3 = new AWS.S3();
//     // Read the image file from local disk
//     const imageFile = fs.readFileSync(uploadPath);
//     // Set the S3 bucket name and key (file name)
//     const bucketName = 'healthsever/Doctor';
//     const keyName = file.filename;
//     // Set the S3 parameters
//     const params = {
//       Bucket: bucketName,
//       Key: keyName,
//       Body: imageFile,
//     };

//     // Upload the image to S3
//     const s3UploadResult = await s3.upload(params).promise();
//     const image_url = s3UploadResult.Location;
//     const imagePath = image_url.toString();

//     pool.query("SELECT provider_id FROM providers WHERE provider_id = ?", [pId], (error, results) => {
//       if (error) {
//         console.error(error);
//         return res.status(500).send({ success: false, error: "An error occurred" });
//       }
//       if (results.length === 0) {
//         return res.status(400).send({ success: false, error: "Invalid provider_id" });
//       }

//       const values = [name, email, phone, specialty, bio, pId, created_at, imagePath];

//       pool.query(`INSERT INTO doctors(name, email, phone, specialty, bio, provider_id, created_at, doctor_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, values, (err, result) => {
//         if (err) {
//           console.error(err);
//           res.status(500).send('Error inserting data into the database');
//         } else {
//           console.log('Data inserted into the database');
//           res.json({ success: true, doctor: results });
//         }
//       });
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: "Internal server error" });
//   }
// });

// ///////DOCTOR UPDATE QUERYY////////

// router.put("/doctordetails/:id", upload.single('photo'), async (req, res) => {
//   try {
//     const { name, email, phone, specialty, bio, created_at, updated_at, pId } = req.body;
//     const doctor_id = req.params.id;
//     const file = req.file;

//     if (!file) {
//       return res.status(400).send('No files were uploaded.');
//     }

//     if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) {
//       return res.status(400).send("This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension.");
//     }

//     // Set maximum allowed file size in bytes (e.g., 2MB)
//     const maxSize = 2 * 1024 * 1024;
//     if (file.size > maxSize) {
//       return res.status(400).send('The uploaded image exceeds the maximum allowed file size.');
//     }

//     const uploadPath = file.path;

//     // Create an S3 instance
//     const s3 = new AWS.S3();
//     // Read the image file from local disk
//     const imageFile = fs.readFileSync(uploadPath);
//     // Set the S3 bucket name and key (file name)
//     const bucketName = 'healthsever/Doctor';
//     const keyName = file.filename;
//     // Set the S3 parameters
//     const params = {
//       Bucket: bucketName,
//       Key: keyName,
//       Body: imageFile,
//     };

//     // Upload the image to S3
//     const s3UploadResult = await s3.upload(params).promise();
//     const image_url = s3UploadResult.Location;
//     const imagePath = image_url.toString();

//     pool.query("SELECT provider_id FROM providers WHERE provider_id = ?", [pId], (error, results) => {
//       if (error) {
//         console.error(error);
//         return res.status(500).send({ success: false, error: "An error occurred" });
//       }
//       if (results.length === 0) {
//         return res.status(400).send({ success: false, error: "Invalid provider_id" });
//       }

//       // Update the database query
//       pool.query(
//         "UPDATE doctors SET name=?, email=?, phone=?, specialty=?, bio=?, created_at=?, updated_at=?, provider_id=?, doctor_image=? WHERE id=?",
//         [name, email, phone, specialty, bio, created_at, updated_at, pId, imagePath, doctor_id],
//         (error, results) => {
//           if (error) {
//             console.error(error);
//             res.status(500).json({ success: false, error: "An error occurred during doctor update" });
//           } else {
//             res.json({ success: true, doctor: results });
//           }
//         }
//       );
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: "Internal server error" });
//   }
// });

// ////DOCTOR DELETE QUERY//////
// router.delete('/doctor/delete/:id', (req, res) => {
//   const doctorId = req.params.id;

//   // Check if there are associated records in the procedures table
//   const checkProceduresSql = `SELECT id FROM procedures WHERE doctor_id = ${doctorId}`;
//   pool.query(checkProceduresSql, (checkProceduresError, checkProceduresResults) => {
//       if (checkProceduresError) {
//           console.error(checkProceduresError);
//           res.status(500).send('Server error');
//       } else {
//           if (checkProceduresResults.length > 0) {
//               const procedureIds = checkProceduresResults.map((result) => result.id);
//               // Delete associated records from the booking_history table
//               const deleteBookingSql = `DELETE FROM booking_history WHERE procedure_id IN (${procedureIds.join(',')})`;
//               pool.query(deleteBookingSql, (deleteBookingError, deleteBookingResults) => {
//                   if (deleteBookingError) {
//                       console.error(deleteBookingError);
//                       res.status(500).send('Server error');
//                   } else {
//                       // Delete the procedures after associated records have been deleted
//                       const deleteProceduresSql = `DELETE FROM procedures WHERE doctor_id = ${doctorId}`;
//                       pool.query(deleteProceduresSql, (deleteProceduresError, deleteProceduresResults) => {
//                           if (deleteProceduresError) {
//                               console.error(deleteProceduresError);
//                               res.status(500).send('Server error');
//                           } else {
//                               // Delete the doctor after associated procedures have been deleted
//                               const deleteDoctorSql = `DELETE FROM doctors WHERE id = ${doctorId}`;
//                               pool.query(deleteDoctorSql, (deleteDoctorError, deleteDoctorResults) => {
//                                   if (deleteDoctorError) {
//                                       console.error(deleteDoctorError);
//                                       res.status(500).send('Server error');
//                                   } else {
//                                     res.json({ success: false, doctor: deleteDoctorResults });
//                                   }
//                               });
//                           }
//                       });
//                   }
//               });
//           } else {
//               // No associated procedures found, directly delete the doctor
//               const deleteDoctorSql = `DELETE FROM doctors WHERE id = ${doctorId}`;
//               pool.query(deleteDoctorSql, (deleteDoctorError, deleteDoctorResults) => {
//                   if (deleteDoctorError) {
//                       console.error(deleteDoctorError);
//                       res.status(500).send('Server error');
//                   } else {
//                     res.json({ success: true, doctor: deleteDoctorResults });
//                   }
//               });
//           }
//       }
//   });
// });

// ////UPDATE/CHANGE PROVIDER PASSWORD///////
// router.put("/providerchangepass/:id", (req, res) => {
//     const provider_id = req.params.id;
//     const { oldpassword, newpassword } = req.body;

//     pool.query('SELECT password FROM providers WHERE provider_id = ?', [provider_id], (error, result) => {
//         if (error) {
//             console.error(error);
//             return res.status(500).send('Server error');
//         }

//         if (result.length === 0) {
//             return res.status(404).send('Provider not found');
//         }

//         const storedPassword = result[0].password;

//         if (oldpassword === storedPassword) {
//             pool.query('UPDATE providers SET password = ? WHERE provider_id = ?', [newpassword, provider_id], (error) => {
//                 if (error) {
//                     console.error(error);
//                     return res.status(500).send('Server error');
//                 }

//                 res.send('Password updated successfully');
//             });
//         } else {
//             return res.status(400).send('Old password does not match');
//         }
//     });
// });

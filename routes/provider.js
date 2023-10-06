const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const conn = require("../db/conn");
const pool = require("../db/conn");
const mysql = require("mysql2");
const multer = require("multer");
const router = express.Router();
const HMlogger = require("../routes/logger");
const fileUpload = require("express-fileupload");
const AWS = require("aws-sdk");
const fs = require("fs");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configure AWS SDK
AWS.config.update({
  accessKeyId: "AKIAVT23DX5AGGINZDVD",
  secretAccessKey: "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",
  region: "ap-south-1",
});

// Create a Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/procerdure/"); // Set the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
    const filename = file.originalname;
    cb(null, filename); // Set the filename for the uploaded file
  },
});

// Create a Multer upload instance with the storage configuration
const upload = multer({ storage: storage });

router.post(
  "/Procedure/adddataImages",
  upload.single("photo"),
  async (req, res) => {
    try {
      const {
        pname,
        description,
        price,
        doctor_id,
        duration,
        durationtext,
        provider_id,
        discount,
        speciality,
        section,
        options,
      } = req.body;

      const file = req.file;
      // const combinedDuration = duration + " " + durationtext;
      if (!file) {
        HMlogger.error("No files were uploaded.");
        return res.status(400).send("No files were uploaded.");
      }

      if (!["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
        HMlogger.error(
          "This format is not allowed, please upload file with '.png', '.gif', '.jpg'"
        );
        return res
          .status(400)
          .send(
            "This format is not allowed, please upload file with '.png', '.gif', '.jpg'"
          );
      }

      // Set maximum allowed file size in bytes (e.g., 2MB)
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        HMlogger.error(
          "The uploaded image exceeds the maximum allowed file size."
        );
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
      const bucketName = "healthsever/Procedure";
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
      // Check if the doctor_id exists in the doctors table
      pool.query(
        "SELECT id FROM doctors WHERE id = ?",
        [doctor_id],
        (error, results) => {
          if (error) {
            console.error(error);
            return res
              .status(500)
              .json({ success: false, error: "An error occurred" });
          }
          if (results.length === 0) {
            return res
              .status(400)
              .json({ success: false, error: "Invalid doctor_id" });
          }

          // Insert the data into the procedures table
          pool.query(
            "INSERT INTO procedures (pname, description, doctor_id, price, discount, duration, durationtext, provider_id, speciality, section,procedure_image) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            [
              pname,
              description,
              doctor_id,
              price,
              discount,
              duration,
              durationtext,
              provider_id,
              speciality,
              section,
              imagePath,
            ],
            (error, procedureInsertResult) => {
              if (error) {
                console.error(error);
                return res
                  .status(500)
                  .json({ success: false, error: "Internal server error" });
              }

              const procedure_id = procedureInsertResult.insertId;

              // Insert the options into the options table
              const optionsData = options.map((option) => [
                option.option_text,
                option.option_price,
                provider_id,
                procedure_id,
              ]);

              conn.query(
                "INSERT INTO options (option_name, price, provider_id, procedure_id) VALUES ?",
                [optionsData],
                (error) => {
                  if (error) {
                    console.error(error);
                    return res
                      .status(500)
                      .json({ success: false, error: "Internal server error" });
                  }

                  return res.json({
                    success: true,
                    procedure: procedureInsertResult,
                  });
                }
              );
            }
          );
        }
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

// Provider procedure search

router.get("/provider/procedure/search/:providerId", (req, res) => {
  const { providerId } = req.params;
  console.log(providerId);

  // Query the database for the procedures with the specified provider ID
  pool.query(
    `SELECT *
      FROM procedures
      WHERE provider_id = ?`,
    [providerId],
    (error, results) => {
      console.log(results);

      if (error) {
        // Handle any errors that occurred during the query
        console.error(error);
        HMlogger.error("An error occurred");
        res.status(500).send({ success: false, error: "An error occurred" });
        // pool.destroy();
      } else {
        HMlogger.info("Sucess procedures");
        res.json({ success: true, procedures: results });
      }
      // pool.close();
    }
  );
});

router.get("/provider/procedures/search/:selectedProcedurelist", (req, res) => {
  const { selectedProcedurelist } = req.params;
  console.log(selectedProcedurelist);
  // Query the database for the procedure with the specified provider ID and procedure name
  pool.query(
    `SELECT *
        FROM procedures
        WHERE id = ? `,
    [selectedProcedurelist],
    (error, results) => {
      console.log(results);
      if (error) {
        // Handle any errors that occurred during the query
        console.error(error);
        HMlogger.error("An error occurred");

        res.status(500).send({ success: false, error: "An error occurred" });
      } else {
        HMlogger.info("Procedure image uploaded successfully");
        res.json({ success: true, procedure: results });
      }
    }
  );
});

// Update an existing procedure in the database  , upload.single('photo'),

router.put('/Procedure/update/:id', upload.single('photo'), async (req, res) => {
  try {
    const {
      pname,
      description,
      price,
      doctor_id,
      duration,
      durationtext,
      provider_id,
      discount,
      speciality,
      section,
      options,
    } = req.body;

    const procedureId = req.params.id;
    const file = req.file;

    // Validation and input checks here ...
    // Validate doctor_id
    const isValidDoctorId = await validateDoctorId(doctor_id);

    if (!isValidDoctorId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid doctor_id provided',
      });
    }

    if (file) {
      // Handle image upload to S3
      const s3 = new AWS.S3();
      const uploadPath = file.path;

      const imageFile = fs.readFileSync(uploadPath);
      const bucketName = "healthsever/Procedure";
      const keyName = file.filename;

      const params = {
        Bucket: bucketName,
        Key: keyName,
        Body: imageFile,
      };

      try {
        const s3UploadResult = await s3.upload(params).promise();
        const imagePath = s3UploadResult.Location;

        // Update procedure record with image path (including imagePath in SQL query)
        const updateImageQuery = `
          UPDATE procedures SET
          pname=?, description=?, price=?, doctor_id=?, duration=?, durationtext=?,
          provider_id=?, discount=?, speciality=?, section=?, procedure_image=?
          WHERE id=?
        `;
        const updateImageValues = [
          pname, description, price, doctor_id, duration, durationtext,
          provider_id, discount, speciality, section, imagePath, procedureId
        ];
        pool.query(updateImageQuery, updateImageValues);

        // Update procedure options if needed
        if (options && options.length > 0) {
          console.log('Options array:', options);
          const deleteOptionsQuery = 'DELETE FROM options WHERE procedure_id = ?';
          pool.query(deleteOptionsQuery, [procedureId]);

          const insertOptionsQuery =`INSERT INTO options (option_name,price, provider_id, procedure_id) VALUES (?, ?, ?, ?)`;

          for (const option of options) {
            const optionValues = [
              option.option_text,
              option.option_price,
              provider_id,
              procedureId,
            ];

            // Execute the insert query with the optionValues array
            pool.query(insertOptionsQuery, optionValues, (error, results) => {
              if (error) {
                console.error(error);
                return res.status(500).json({
                  success: false,
                  error: 'Internal server error',
                });
              }
              // Continue the loop or handle completion as needed
            });
          }
        }

        return res.json({
          success: true,
          message: 'Procedure and options updated successfully',
        });
      } catch (uploadError) {
        console.error(uploadError);
        res.status(500).json({
          success: false,
          error: 'An error occurred during image upload',
        });
      }
    } else {
      // Update procedure record without image
      const updateQuery = `
        UPDATE procedures SET
        pname=?, description=?, price=?, doctor_id=?, duration=?, durationtext=?,
        provider_id=?, discount=?, speciality=?, section=?
        WHERE id=?
      `;
      const updateValues = [
        pname, description, price, doctor_id, duration, durationtext,
        provider_id, discount, speciality, section, procedureId
      ];

      pool.query(updateQuery, updateValues);

      // Update procedure options if needed
      if (options && options.length > 0) {
        console.log('Options array:', options);
        const deleteOptionsQuery = 'DELETE FROM options WHERE procedure_id = ?';
        pool.query(deleteOptionsQuery, [procedureId]);

        const insertOptionsQuery =`INSERT INTO hospital_marketplace.options (option_name,price, provider_id, procedure_id) VALUES (?, ?, ?, ?)`;

        for (const option of options) {
          const optionValues = [
            option.option_text,
            option.option_price,
            provider_id,
            procedureId,
          ];

          // Execute the insert query with the optionValues array
          pool.query(insertOptionsQuery, optionValues, (error, results) => {
            if (error) {
              console.error(error);
              return res.status(500).json({
                success: false,
                error: 'Internal server error',
              });
            }
            // Continue the loop or handle completion as needed
          });
        }
      }

      return res.json({
        success: true,
        message: 'Procedure updated successfully',
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

async function validateDoctorId(doctorId) {
  const query = 'SELECT COUNT(*) AS count FROM doctors WHERE id = ?';

  return new Promise((resolve, reject) => {
    pool.query(query, [doctorId], (error, results) => {
      if (error) {
        reject(error);
      } else {
        // Check if a doctor with the provided ID exists
        const count = results[0].count;
        resolve(count === 1); // Resolve true if the count is 1 (exists), false otherwise
      }
    });
  });
}
// module.exports = router;



// router.put("/Procedure/update/:id", upload.single("photo"), async (req, res) => {
//   try {
//     const {
//       pname,
//       description,
//       price,
//       doctor_id,
//       duration,
//       durationtext,
//       provider_id,
//       discount,
//       speciality,
//       section,
//       options,
//     } = req.body;
//     const procedureId = req.params.id;
//     const file = req.file;

//     if (!file) {
//       // Check if the doctor_id exists in the doctors table
//       conn.query(
//         "SELECT * FROM doctors WHERE id = ?",
//         [doctor_id],
//         (doctorError, doctorResults) => {
//           if (doctorError || doctorResults.length === 0) {
//             HMlogger.error("Invalid doctor_id");
//             return res
//               .status(400)
//               .json({ success: false, error: "Invalid doctor_id" });
//           }

//           // Check if the provider_id exists in the providers table
//           conn.query(
//             "SELECT * FROM providers WHERE provider_id = ?",
//             [provider_id],
//             (providerError, providerResults) => {
//               if (providerError || providerResults.length === 0) {
//                 HMlogger.error("Invalid provider_id");
//                 return res
//                   .status(400)
//                   .json({ success: false, error: "Invalid provider_id" });
//               }

//               // Update the procedure record with the validated foreign key values
//               conn.query(
//                 "UPDATE procedures SET pname=?, description=?, price=?, doctor_id=?, duration=?,durationtext=?, provider_id=?, discount=?, speciality=?, section=? WHERE id=?",
//                 [
//                   pname,
//                   description,
//                   price,
//                   doctor_id,
//                   duration,
//                   durationtext,
//                   provider_id,
//                   discount,
//                   speciality,
//                   section,
//                   procedureId,
//                 ],
//                 (updateError, updateResults) => {
//                   if (updateError) {
//                     console.error(updateError);
//                     HMlogger.error(
//                       "An error occurred during procedure update"
//                     );
//                     // Update options if needed
//                     if (options && options.length > 0) {
//                       const optionsData = options.map((option) => [
//                         option.option_text,
//                         option.option_price,
//                         provider_id,
//                         procedureId,
//                       ]);

//                       // Delete existing options
//                       conn.query(
//                         "DELETE FROM options WHERE procedure_id = ?",
//                         [procedureId],
//                         (error, deleteResult) => {
//                           if (error) {
//                             console.error(error);
//                             return res
//                               .status(500)
//                               .json({ success: false, error: "Internal server error" });
//                           }

//                           // Insert updated options
//                           conn.query(
//                             "INSERT INTO options (option_name, price, provider_id, procedure_id) VALUES ?",
//                             [optionsData],
//                             (error, insertResult) => {
//                               if (error) {
//                                 console.error(error);
//                                 return res
//                                   .status(500)
//                                   .json({ success: false, error: "Internal server error" });
//                               }

//                               return res.json({
//                                 success: true,
//                                 message: "Procedure and options updated successfully",
//                               });
//                             }
//                           );
//                         }
//                       );
//                     }
//                     HMlogger.info("procedure: updateResults without image");
//                     res.json({ success: true, procedure: updateResults });
//                   }
//               });
//             }
//           );
//         }
//       );
//     } else {
//       if (!["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
//         HMlogger.error(
//           "This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension"
//         );
//         return res
//           .status(400)
//           .send(
//             "This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension"
//           );
//       }

//       // Set the maximum allowed file size in bytes (e.g., 2MB)
//       const maxSize = 2 * 1024 * 1024;
//       if (file.size > maxSize) {
//         HMlogger.error(
//           "The uploaded image exceeds the maximum allowed file size."
//         );
//         return res
//           .status(400)
//           .send("The uploaded image exceeds the maximum allowed file size.");
//       }

//       const uploadPath = file.path;
//       // Create an S3 instance
//       const s3 = new AWS.S3();
//       // Read the image file from the local disk
//       const imageFile = fs.readFileSync(uploadPath);
//       // Set the S3 bucket name and key (file name)
//       const bucketName = "healthsever/Procedure";
//       const keyName = file.filename;
//       // Set the S3 parameters
//       const params = {
//         Bucket: bucketName,
//         Key: keyName,
//         Body: imageFile,
//       };

//       try {
//         // Upload the image to S3
//         const s3UploadResult = await s3.upload(params).promise();
//         const imagePath = s3UploadResult.Location.toString();
//         console.log("imagePath", imagePath);

//       if (!file) {
//         // Check if the doctor_id exists in the doctors table
//         conn.query(
//           "SELECT * FROM doctors WHERE id = ?",
//           [doctor_id],
//           (doctorError, doctorResults) => {
//             if (doctorError || doctorResults.length === 0) {
//               HMlogger.error("Invalid doctor_id");
//               return res
//                 .status(400)
//                 .json({ success: false, error: "Invalid doctor_id" });
//             }

//             // Check if the provider_id exists in the providers table
//             conn.query(
//               "SELECT * FROM providers WHERE provider_id = ?",
//               [provider_id],
//               (providerError, providerResults) => {
//                 if (providerError || providerResults.length === 0) {
//                   HMlogger.error("Invalid provider_id");
//                   return res
//                     .status(400)
//                     .json({ success: false, error: "Invalid provider_id" });
//                 }

//                 // Update the procedure record with the validated foreign key values
//                 conn.query(
//                   "UPDATE procedures SET pname=?, description=?, price=?, doctor_id=?, duration=?,durationtext=?, provider_id=?, discount=?, speciality=?, section=? WHERE id=?",
//                   [
//                     pname,
//                     description,
//                     price,
//                     doctor_id,
//                     duration,
//                     durationtext,
//                     provider_id,
//                     discount,
//                     speciality,
//                     section,
//                     procedureId,
//                   ],
//                   (updateError, updateResults) => {
//                     if (updateError) {
//                       console.error(updateError);
//                       HMlogger.error(
//                         "An error occurred during procedure update"
//                       );
//                       // Update options if needed
//                       if (options && options.length > 0) {
//                         const optionsData = options.map((option) => [
//                           option.option_text,
//                           option.option_price,
//                           provider_id,
//                           procedureId,
//                         ]);

//                         // Delete existing options
//                         conn.query(
//                           "DELETE FROM options WHERE procedure_id = ?",
//                           [procedureId],
//                           (error, deleteResult) => {
//                             if (error) {
//                               console.error(error);
//                               return res.status(500).json({
//                                 success: false,
//                                 error: "Internal server error",
//                               });
//                             }

//                             // Insert updated options
//                             conn.query(
//                               "INSERT INTO options (option_name, price, provider_id, procedure_id) VALUES ?",
//                               [optionsData],
//                               (error, insertResult) => {
//                                 if (error) {
//                                   console.error(error);
//                                   return res.status(500).json({
//                                     success: false,
//                                     error: "Internal server error",
//                                   });
//                                 }

//                                 return res.json({
//                                   success: true,
//                                   message:
//                                     "Procedure and options updated successfully",
//                                 });
//                               }
//                             );
//                           }
//                         );
//                       }
//                       HMlogger.info("procedure: updateResults without image");
//                       res.json({ success: true, procedure: updateResults });
//                     }
//                   }
//                 );
//               }
//             );
//           }
//         );
//       } else {
//         if (!["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
//           HMlogger.error(
//             "This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension"
//           );
//           return res
//             .status(400)
//             .send(
//               "This format is not allowed, please upload a file with '.png', '.gif', or '.jpg' extension"
//             );
//         }

//         // Set the maximum allowed file size in bytes (e.g., 2MB)
//         const maxSize = 2 * 1024 * 1024;
//         if (file.size > maxSize) {
//           HMlogger.error(
//             "The uploaded image exceeds the maximum allowed file size."
//           );
//           return res
//             .status(400)
//             .send("The uploaded image exceeds the maximum allowed file size.");
//         }

//         const uploadPath = file.path;

//         // Create an S3 instance
//         const s3 = new AWS.S3();
//         // Read the image file from the local disk
//         const imageFile = fs.readFileSync(uploadPath);
//         // Set the S3 bucket name and key (file name)
//         const bucketName = "healthsever/Procedure";
//         const keyName = file.filename;
//         // Set the S3 parameters
//         const params = {
//           Bucket: bucketName,
//           Key: keyName,
//           Body: imageFile,
//         };

//         try {
//           // Upload the image to S3
//           const s3UploadResult = await s3.upload(params).promise();
//           const imagePath = s3UploadResult.Location.toString();
//           console.log("imagePath", imagePath);

//           // Check if the doctor_id exists in the doctors table
//           pool.query(
//             "SELECT * FROM doctors WHERE id = ?",
//             [doctor_id],
//             (doctorError, doctorResults) => {
//               if (doctorError || doctorResults.length === 0) {
//                 HMlogger.error("Invalid doctor_id");
//                 return res
//                   .status(400)
//                   .json({ success: false, error: "Invalid doctor_id" });
//               }

//               // Check if the provider_id exists in the providers table
//               pool.query(
//                 "SELECT * FROM providers WHERE provider_id = ?",
//                 [provider_id],
//                 (providerError, providerResults) => {
//                   if (providerError || providerResults.length === 0) {
//                     HMlogger.error("Invalid provider_id");
//                     return res
//                       .status(400)
//                       .json({ success: false, error: "Invalid provider_id" });
//                   }

//                   // Update the procedure record with the validated foreign key values
//                   conn.query(
//                     "UPDATE procedures SET pname=?, description=?, price=?, doctor_id=?, duration=?,durationtext=?, provider_id=?, discount=?, speciality=?, section=?, procedure_image=? WHERE id=?",
//                     [
//                       pname,
//                       description,
//                       price,
//                       doctor_id,
//                       duration,
//                       provider_id,
//                       discount,
//                       durationtext,
//                       speciality,
//                       section,
//                       imagePath,
//                       procedureId,
//                     ],
//                     (updateError, updateResults) => {
//                       if (updateError) {
//                         console.error(updateError);
//                         HMlogger.error(
//                           "An error occurred during procedure update"
//                         );
//                         // Update options if needed
//                         if (options && options.length > 0) {
//                           const optionsData = options.map((option) => [
//                             option.option_text,
//                             option.option_price,
//                             provider_id,
//                             procedureId,
//                           ]);

//                           // Delete existing options
//                           conn.query(
//                             "DELETE FROM options WHERE procedure_id = ?",
//                             [procedureId],
//                             (error, deleteResult) => {
//                               if (error) {
//                                 console.error(error);
//                                 return res.status(500).json({
//                                   success: false,
//                                   error: "Internal server error",
//                                 });
//                               }

//                               // Insert updated options
//                               conn.query(
//                                 "INSERT INTO options (option_name, price, provider_id, procedure_id) VALUES ?",
//                                 [optionsData],
//                                 (error, insertResult) => {
//                                   if (error) {
//                                     console.error(error);
//                                     return res.status(500).json({
//                                       success: false,
//                                       error: "Internal server error",
//                                     });
//                                   }

//                                   return res.json({
//                                     success: true,
//                                     message:
//                                       "Procedure and options updated successfully",
//                                   });
//                                 }
//                               );
//                             }
//                           );
//                         }
//                         HMlogger.info("procedure: updateResults without image");
//                         res.json({ success: true, procedure: updateResults });
//                       }
//                     }
//                   );
//                 }
//               );
//             }
//           );
//         } catch (uploadError) {
//           console.error(uploadError);
//           HMlogger.error("An error occurred during procedure update");
//           res.status(500).json({
//             success: false,
//             error: "An error occurred during image upload",
//           });
//         }
//       }
//     } catch (uploadError) {
//       console.error(uploadError);
//       HMlogger.error("Internal server error");
//       res.status(500).json({ success: false, error: "Internal server error" });
//     }
//   }
// }catch (uploadError) {
//   console.error(uploadError);
//   HMlogger.error("Internal server error");
//   res.status(500).json({ success: false, error: "Internal server error" });
// }
// });

// Delete the procedure
router.delete("/procedures/delete/:id", (req, res) => {
  const id = req.params.id;

  // Delete the related options
  pool.query(
    "DELETE FROM options WHERE procedure_id = ?",
    [id],
    (error) => {
      if (error) {
        console.error(error);
        HMlogger.error("Internal server error");
        return res
          .status(500)
          .json({ success: false, error: "Internal server error" });
      }

      // Delete the related reviews
      pool.query(
        "DELETE FROM reviews WHERE procedure_id = ?",
        [id],
        (error) => {
          if (error) {
            console.error(error);
            HMlogger.error("Internal server error");
            return res
              .status(500)
              .json({ success: false, error: "Internal server error" });
          }

          // Delete the related records from the booking_history table
          pool.query(
            "DELETE FROM booking_history WHERE procedure_id = ?",
            [id],
            (error) => {
              if (error) {
                console.error(error);
                HMlogger.error("Internal server error");
                return res
                  .status(500)
                  .json({ success: false, error: "Internal server error" });
              }

              // Delete the related records from the consultation table
              pool.query(
                "DELETE FROM consultation WHERE procedure_id = ?",
                [id],
                (error) => {
                  if (error) {
                    console.error(error);
                    HMlogger.error("Internal server error");
                    return res
                      .status(500)
                      .json({ success: false, error: "Internal server error" });
                  }

                  // Delete the procedure from the procedures table
                  pool.query(
                    "DELETE FROM procedures WHERE id = ?",
                    [id],
                    (error) => {
                      if (error) {
                        console.error(error);
                        HMlogger.error("Internal server error");
                        return res
                          .status(500)
                          .json({ success: false, error: "Internal server error" });
                      }
                      HMlogger.info("Procedure deleted");
                      console.log("Procedure deleted");
                      res.status(200).json({ success: true });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});


router.delete("/provider-insurance/:id", (req, res) => {
  const insuranceId = req.params.id;

  // Delete the insurance company from the database
  pool.query(
    "DELETE FROM providerInsurance WHERE insuranceId = ?",
    [insuranceId],
    (error, result) => {
      if (error) {
        console.error(error);
        res.status(500).json({ message: "Error deleting insurance company" });
      } else {
        res.json({ message: "Insurance company deleted successfully" });
      }
    }
  );
});

// router.post('/provider-insurance', (req, res) => {
//   const { pId, Insurance, Coverage } = req.body;

//   const query = `INSERT INTO providerInsurance (providerId, InsuranceCompanyNames, CoverageDetails) VALUES ?`;
//   const values = Insurance.map((insuranceCompany) => [pId, insuranceCompany, Coverage]);

//   pool.query(query, [values], (error, result) => {
//     if (error) {
//       console.error('Error inserting data: ', error);
//       res.status(500).json({ success: false, error: 'An error occurred while inserting data' });
//     } else {
//       const insertedId = result.insertId; // Retrieve the inserted ID
//       res.json({ success: true, insertedId });
//     }
//   });
// });

router.post("/provider-insurance", (req, res) => {
  const { pId, Insurance, Coverage } = req.body;

  const query = `INSERT INTO providerInsurance (providerId, InsuranceCompanyNames, CoverageDetails) VALUES ?`;
  const values = Insurance.map((insuranceCompany) => [
    pId,
    insuranceCompany,
    Coverage,
  ]);

  pool.query(query, [values], (error, result) => {
    if (error) {
      console.error("Error inserting data: ", error);
      res.status(500).json({
        success: false,
        error: "An error occurred while inserting data",
      });
    } else {
      const insertedIds = result.insertId; // Retrieve the inserted IDs

      const selectQuery = `SELECT * FROM providerInsurance WHERE CoverageDetails IN (?)`;
      pool.query(selectQuery, [Coverage], (selectError, selectResult) => {
        if (selectError) {
          console.error("Error selecting data: ", selectError);
          res.status(500).json({
            success: false,
            error: "An error occurred while selecting data",
          });
        } else {
          const insertedRecords = selectResult;
          res.json({ success: true, insertedRecords });
        }
      });
    }
  });
});

// Assuming you have the 'pool' variable defined for database poolection

router.delete("/accommodation/:id", (req, res) => {
  const Idaccomodation = req.params.id;

  // Query to delete the accommodation based on the provider ID
  const query = "DELETE FROM accommodation WHERE accommodation_id = ?";
  const values = [Idaccomodation];

  pool.query(query, values, (error, result) => {
    if (error) {
      console.error("Error deleting data: ", error);
      res.status(500).json({
        success: false,
        error: "An error occurred while deleting data",
      });
    } else {
      const affectedRows = result.affectedRows;
      if (affectedRows > 0) {
        res.json({
          success: true,
          message: `Accommodation with deleted successfully`,
        });
      } else {
        res.status(404).json({ success: false, error: `No accommodation ` });
      }
    }
  });
});

//Insert the Accomodation
router.post("/accommodation", (req, res) => {
  const { rates, providerId, accommodationType } = req.body;

  const query =
    "INSERT INTO  accommodation (accommodation_type, rate, provider_id) VALUES (?, ?, ?)";
  const values = [accommodationType, rates, providerId];

  pool.query(query, values, (error, result) => {
    if (error) {
      console.error("Error inserting data: ", error);
      res.status(500).json({
        success: false,
        error: "An error occurred while inserting data",
      });
    } else {
      const insertedId = result.insertId; // Retrieve the inserted ID
      const selectQuery = `SELECT * FROM accommodation WHERE accommodation_id = (?)`;
      pool.query(selectQuery, [insertedId], (selectError, selectResult) => {
        if (selectError) {
          console.error("Error selecting data: ", selectError);
          res.status(500).json({
            success: false,
            error: "An error occurred while selecting data",
          });
        } else {
          const insertedRecords = selectResult;
          res.json({ success: true, insertedRecords });
        }
      });
    }
  });
});
// Define the select route
router.get("/accommodation/:id", (req, res) => {
  const providerId = req.params.id;

  const query = "SELECT * FROM accommodation WHERE provider_id = ?";
  pool.query(query, [providerId], (error, result) => {
    if (error) {
      console.error("Error selecting data: ", error);
      res.status(500).json({
        success: false,
        error: "An error occurred while selecting data",
      });
    } else {
      res.json({ success: true, data: result });
    }
  });
});

//to display the data on page
router.get("/provider-insurance/:id", (req, res) => {
  const providerId = req.params.id;
  console.log(providerId);

  const query = `Select * from providerInsurance where providerId = ?`;
  // const values = [ Policy, Insurance, Coverage,];

  pool.query(query, [providerId], (error, result) => {
    if (error) {
      console.error("Error inserting data: ", error);
      res.status(500).json({ error: "An error occurred while inserting data" });
    } else {
      // const parsedData = JSON.parse(result);
      // const dataArray = parsedData.data;
      res.json({ data: result });
    }
  });
});

// show provider vise images
router.get("/procedure-images/:provider_id", (req, res) => {
  const providerId = req.params.provider_id;

  pool.query(
    `SELECT pr.pname AS name, pr.procedure_image AS image
      FROM procedures pr
      WHERE pr.provider_id = ?`,
    [providerId],
    (error, procedureResults) => {
      if (error) throw error;
      HMlogger.info(" images: procedureResults ");
      res.json({ success: true, images: procedureResults });
    }
  );
});

router.get("/doctor-images/:provider_id", (req, res) => {
  const providerId = req.params.provider_id;

  pool.query(
    `SELECT dr.name ,dr.doctor_image AS image
      FROM doctors dr
      WHERE dr.provider_id = ?`,
    [providerId],
    (error, doctorResults) => {
      if (error) throw error;
      HMlogger.info(" images: procedureResults ");
      res.json({ success: true, images: doctorResults });
    }
  );
});

// router.get('/provider-image/:provider_id', (req, res) => {
//   const providerId = req.params.provider_id;

//   pool.query(
//     `SELECT p.name , p.provider_image AS image
//       FROM providers p
//       WHERE p.provider_id = ?`,
//     [providerId],
//     (error, providerResults) => {
//       if (error) throw error;
//       HMlogger.info(" images: procedureResults ");
//       res.json({ success: true, images: providerResults });
//     }
//   );
// });

///UPDATE/CHANGE PROVIDER PASSWORD///////
router.put("/providerchangepass/:id", (req, res) => {
  const provider_id = req.params.id;
  const { oldpassword, newpassword } = req.body;

  pool.query(
    "SELECT password FROM providers WHERE provider_id = ?",
    [provider_id],
    (error, result) => {
      if (error) {
        console.error(error);
        HMlogger.error("Server error");
        return res.status(500).send("Server error");
      }

      if (result.length === 0) {
        HMlogger.error("Provider not found");
        return res.status(404).send("Provider not found");
      }

      const storedPassword = result[0].password;

      if (oldpassword === storedPassword) {
        pool.query(
          "UPDATE providers SET password = ? WHERE provider_id = ?",
          [newpassword, provider_id],
          (error) => {
            if (error) {
              HMlogger.error("Server error");
              console.error(error);
              return res.status(500).send("Server error");
            }
            HMlogger.info("Password updated successfully");
            res.send("Password updated successfully");
          }
        );
      } else {
        HMlogger.error("Old password does not match");
        return res.status(400).send("Old password does not match");
      }
    }
  );
});

//////////PROVIDER GET QUERY THROUGH SINGLE ID///////return empty array provider
router.get("/providerprofile/:provider_id", (req, res) => {
  const provider_id = req.params.provider_id;
  console.log(provider_id);

  // Query the database for the provider with the specified provider_id
  pool.query(
    `SELECT * FROM providers WHERE provider_id = ?`,
    [provider_id],
    (error, results) => {
      if (error) {
        // Handle any errors that occurred during the query
        console.error(error);
        HMlogger.error("An error occurred");
        res.status(500).send({ success: false, error: "An error occurred" });
      } else {
        HMlogger.info("provider found");
        res.json({ success: true, provider: results });
      }
    }
  );
});

//Provider profile by procedure number

router.get("/providerprofiles/:procedure_id", (req, res) => {
  const id = req.params.procedure_id;
  console.log(id);

  // Query the database for the provider with the specified provider_id
  pool.query(
    `SELECT *
      FROM doctors
      JOIN procedures ON doctors.id = procedures.doctor_id
      WHERE procedures.id = ?;
      `,
    [id],
    (error, results) => {
      if (error) {
        // Handle any errors that occurred during the query
        console.error(error);
        res.status(500).send({ success: false, error: "An error occurred" });
      } else {
        res.json({ success: true, doctor: results });
      }
    }
  );
});

router.put(
  "/providerprofile/:provider_id",
  upload.single("photo"),
  async (req, res) => {
    const provider_id = req.params.provider_id;
    console.log(provider_id);

    // Extract the updated data from the request body
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
    } = req.body;
    const file = req.file;

    if (!file) {
      // Update the provider data without the profile photo
      pool.query(
        `UPDATE providers
          SET name=?, speciality=?, website=?, phone=?, age=?, address=?, city=?, state=?, zipcode=?, email=?, country=?
          WHERE provider_id=?`,
        [
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
          provider_id,
        ],
        (err, results) => {
          if (err) {
            HMlogger.error("Error updating provider profile"); // Logging the error
            console.error(err);
            res.status(500).send("Error updating provider profile");
          } else {
            HMlogger.info(
              "Provider profile updated successfully  witghout image"
            ); // Logging the success
            res.json({
              success: true,
              message: "Provider profile updated successfully witghout image",
            });
          }
        }
      );
    } else {
      // Upload the profile photo to AWS S3 bucket
      const uploadPath = file.path;

      // Create an S3 instance
      const s3 = new AWS.S3();
      // Read the image file from local disk
      const imageFile = fs.readFileSync(uploadPath);
      // Set the S3 bucket name and key (file name)
      const bucketName = "healthsever/Procedure";
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

      // Update the provider data with the profile photo URL
      pool.query(
        `UPDATE providers
              SET name=?, speciality=?, website=?, phone=?, age=?, address=?, city=?, state=?, zipcode=?, email=?, country=?, provider_image=?
              WHERE provider_id=?`,
        [
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
          imagePath,
          provider_id,
        ],
        (err, results) => {
          if (err) {
            HMlogger.error("Error updating provider profile"); // Logging the error
            console.error(err);
            res.status(500).send("Error updating provider profile");
          } else {
            HMlogger.info("Provider profile updated successfully"); // Logging the success
            res.json({
              success: true,
              message: "Provider profile updated successfully",
            });
          }
        }
      );
    }
  }
);
// API for procedure options (jagruti)

router.get("/procedure/option/:id", (req, res) => {
  console.log("=option=");
  const procedure_id = req.params.id;
  console.log(procedure_id);
  // Prepare the SQL query with a join
  const sql = `Select o.option_id, o.option_name, o.price, p.provider_id, p.name as provider_name , pr.pname 
  FROM hospital_marketplace.options o
  INNER JOIN hospital_marketplace.procedures pr ON o.procedure_id = pr.id
  INNER JOIN hospital_marketplace.providers p ON o.provider_id = p.provider_id
  WHERE pr.id = ? `;

  // Execute the query with the provided procedure ID
  pool.query(sql, [procedure_id], (err, results) => {
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

//API for procedure accomodations (jagruti)

router.get("/procedure/accomodation/:id", (req, res) => {
  console.log("accomodation");
  const procedure_id = req.params.id;
  console.log("to show accommodation:", procedure_id);

  // Prepare the SQL query with a join
  const sql = `
    SELECT 
      p.provider_id,
      p.name AS provider_name,
      ac.accommodation_id,
      ac.accommodation_type,
      ac.rate
    FROM
      hospital_marketplace.accommodation ac
    INNER JOIN
      hospital_marketplace.providers p ON ac.provider_id = p.provider_id
    INNER JOIN
      hospital_marketplace.procedures pr ON p.provider_id = pr.provider_id
    WHERE
      ac.provider_id = (SELECT provider_id FROM hospital_marketplace.procedures WHERE id = ? )
    GROUP BY
      ac.accommodation_id; 
  `;

  // Execute the query with the provided procedure ID
  pool.query(sql, [procedure_id], (err, results) => {
    if (err) {
      console.error("Error executing the query: " + err.stack);
      res
        .status(500)
        .json({ error: "An error occurred while fetching the reviews" });
      return;
    }

    // Return the accommodation options as JSON response
    res.status(200).json({ results });
  });
});


module.exports = router;

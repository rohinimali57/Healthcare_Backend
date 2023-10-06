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
    const filename = Date.now() + "_" + "_" + file.originalname;
    cb(null, filename); // Set the filename for the uploaded file
  },
});

// Create a Multer upload instance with the storage configuration
const upload = multer({ storage: storage });

// 1) API Gives only speciality Name(jagruti)
router.get("/Procedure/speciality", (req, res) => {
  console.log("this API provides all the specialty names in dropdown menu");
  try {
    // Query the database for procedures with matching name and provider city
    pool.query(
      `SELECT speciality
      FROM hospital_marketplace.procedures
      GROUP BY speciality;`,
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error("Error occured when specialties not found ", error);
          HMlogger.error("An error occurred");
          res.status(500).send({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("SpeialityName not found");
          res
            .status(400)
            .send({ success: false, error: "SpeialityName not found" });
          return;
        }
        HMlogger.info("Fetched specialityname successfully");

        res.json({ success: true, SpeialityName: results });
      }
    );
  } catch (err) {
    HMlogger.error("Failed to fetch procedures");

    console.error("Failed to fetch specilties because:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch procedures" });
    console.log("Exiting from API which gives specilty names in dropdown menu");
  }
});

// 2) API Gives only procedure Name (jagruti)

router.get("/Procedure/procedure/:speciality", (req, res) => {
  console.log("this API provides all the procedure names in dropdown menu");
  const speciality = req.params.speciality; // Extract the speciality from the request parameters

  try {
    // Query the database for procedures with matching name and provider city
    pool.query(
      `SELECT  p.pname
      FROM hospital_marketplace.procedures p
      JOIN hospital_marketplace.providers pr ON p.provider_id = pr.provider_id
      WHERE p.speciality = ?`,
      [speciality],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error("Error occured when procedures not found", error);
          HMlogger.error("An error occurred");

          res.status(500).json({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("Speciality not found");
          res
            .status(400)
            .json({ success: false, error: "Speciality not found" });

          return;
        }
        HMlogger.info("Fetched procedures successfully");

        res.json({ success: true, proceduresName: results });
      }
    );
  } catch (err) {
    console.error("Failed to fetch procedures because:", err);
    HMlogger.error("Failed to fetch procedures");
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch procedures" });
    console.log(
      "Exiting from API which gives procedure names in dropdown menu"
    );
  }
});

// 3) Give only city Name (jagruti)
router.get("/Procedure/city/:procedure", (req, res) => {
  console.log("this API provides all the hospital addresses in dropdown menu");
  const procedure = req.params.procedure; // Extract the speciality from the request parameters

  try {
    // Query the database for procedures with matching name and provider city
    pool.query(
      `SELECT pr.name, pr.city
      FROM procedures p
      JOIN providers pr ON p.provider_id = pr.provider_id
      WHERE p.pname = ?`,
      [procedure],
      (error, results) => {
        if (error) {
          // Handle any errors that occurred during the query
          console.error(
            "Error occured when hospital addresses not found",
            error
          );
          HMlogger.error("An error occurred");

          res.status(500).json({ success: false, error: "An error occurred" });
          return;
        }

        if (results.length === 0) {
          HMlogger.error("Failed to fetch City");

          res.status(400).json({ success: false, error: "City not found" });
          return;
        }
        // HMlogger.log(" fetch City");
        HMlogger.info("Fetched City successfully");

        res.json({ success: true, cityName: results });
      }
    );
  } catch (err) {
    console.error("Failed to fetch hospital addresses because:", err);
    HMlogger.error("Failed to fetch City");

    res.status(500).json({ success: false, error: "Failed to fetch City" });
    console.log(
      "Exiting from API which gives hospital addresses in dropdown menu"
    );
  }
});

//4) API for Searchbar with dropdown menu --hits when we click on Search Procedure button
router.post("/Procedure/speciality/searchProcedurehome", (req, res) => {
  console.log(
    "this API takes options selected by user from dropdown menu and redirect user to the shop page"
  );
  const { procedure, selectedCity, selectedName, speciality } = req.body;

  // Validate input
  if (!procedure || !speciality) {
    HMlogger.error("Missing required parameters");
    res
      .status(400)
      .json({ success: false, error: "Missing required parameters" });
    return;
  }

  try {
    let query = `SELECT
    p.id,
    p.pname,
    p.price,
    p.description,
    p.duration,
    p.speciality,
    p.doctor_id,
    p.procedure_image,
    pr.provider_id AS provider_id,
    pr.name AS provider_name,
    pr.address,
    pr.city,
    pr.state,
    pr.zipcode,
    pr.phone,
    pr.website,
    r.id AS review_id,
    r.rating,
    r.comment,
    pi.insuranceId AS insurance_id,
    pi.InsuranceCompanyNames AS insurance_company_names,
    pi.CoverageDetails AS coverage_details
FROM hospital_marketplace.procedures p
LEFT JOIN hospital_marketplace.providers pr ON p.provider_id = pr.provider_id
LEFT JOIN hospital_marketplace.doctors dr ON p.doctor_id = dr.id
LEFT JOIN (
    SELECT r1.id, r1.rating, r1.comment, r1.procedure_id
    FROM hospital_marketplace.reviews r1
    INNER JOIN (
        SELECT MIN(id) AS id
        FROM hospital_marketplace.reviews
        GROUP BY procedure_id
    ) r2 ON r1.id = r2.id
) r ON p.id = r.procedure_id
LEFT JOIN hospital_marketplace.providerInsurance pi ON pr.provider_id = pi.provider_id
WHERE p.pname LIKE ?
    AND p.speciality LIKE ? `;

    let params = [`%${procedure}%`, `%${speciality}%`];

    if (selectedCity) {
      query += " AND pr.city LIKE ?";
      params.push(`%${selectedCity}%`);
    }

    if (selectedName) {
      query += " AND pr.name LIKE ?";
      params.push(`%${selectedName}%`);
    }

    // Query the database
    pool.query(query, params, (error, results) => {
      if (error) {
        // Handle any errors that occurred during the query
        console.error(
          "Error occured when Search Procedure button clicked and no data found",
          error
        );
        HMlogger.error("An error occurred");
        res.status(500).send({ success: false, error: "An error occurred" });
        return;
      }

      if (results.length === 0) {
        HMlogger.error("Procedure not found");
        res.status(400).send({ success: false, error: "Procedure not found" });
        return;
      }
      HMlogger.info("Fetched procedure successfully");

      res.json({ success: true, procedure: results });
    });
  } catch (err) {
    console.error(
      "Failed to fetch data when clicked on Search Procedure button because:",
      err
    );
    HMlogger.error("Failed to fetch procedures");
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch procedures" });
    console.log("Exiting from API which gives all the procedure related data");
  }
});

//  5) Free text procedure searchbar
router.post("/Procedure/freeSearchProcedurehome", (req, res) => {
  console.log(
    "this API provides all the procedures related to free text input by user"
  );
  const { procedure } = req.body;
  console.log("searching procedures with Free text", procedure);
  // Query the database for procedures with matching name and provider city
  pool.query(
    `SELECT
    pr.id,
    pr.pname,
    pr.price,
    pr.discount,
    pr.description,
    pr.speciality,
    pr.procedure_image,
    pi.insuranceId AS insurance_id,
    pi.InsuranceCompanyNames AS insurance_company_names,
    pv.provider_id,
    pv.name AS provider_name,
    pv.address,
    pv.city,
    pv.state,
    pv.country,
    pv.phone,
    d.id AS doctor_id,
    d.name AS doctor_name
FROM hospital_marketplace.procedures pr
JOIN hospital_marketplace.providers pv ON pr.provider_id = pv.provider_id
JOIN hospital_marketplace.providerInsurance pi ON pv.provider_id = pi.provider_id
JOIN hospital_marketplace.doctors d ON pr.doctor_id = d.id
WHERE pr.pname LIKE ? `,
    [`%${procedure}%`],
    (error, results) => {
      console.log(
        "Showing all the procedures related to the user input free text",
        results
      );
      if (error) {
        console.error("Error occured when procedure not found", error);
        HMlogger.error("An error occurred");

        res.status(500).send({ success: false, error: "An error occurred" });
      } else {
        HMlogger.info(" fetch procedures");

        res.json({ success: true, procedure: results });
        console.log(
          "Exiting from API which gives all procedures related to free text input by user"
        );
      }
    }
  );
});

module.exports = router;

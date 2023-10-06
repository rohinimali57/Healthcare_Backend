const express = require("express");
const AWS = require("aws-sdk");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Configure AWS SDK   // Set your AWS region
AWS.config.update({
  accessKeyId: "AKIAVT23DX5AGGINZDVD",
  secretAccessKey: "LdK0vh2lg5k8OZRMLou0z//HxpsAf/DlB9ZGJBUu",
  region: "ap-south-1",
});

const SES = new AWS.SES({ apiVersion: "2010-12-01" });

const sendEmailNotification = async (
  shouldSendEmail,
  recipient,
  subject,
  emailTemplate
) => {
  if (shouldSendEmail === true) {
    if (recipient !== undefined && recipient !== null) {
      // Replaced "||" with "&&"  care@myhealthsaver.in
      try {
        const params = {
          Source: "care@myhealthsaver.in",
          Destination: {
            ToAddresses: [recipient.toString()],
          },
          Message: {
            Subject: {
              Data: subject.toString(),
            },
            Body: {
              Text: {
                Data: emailTemplate,
              },
            },
          },
        };

        SES.sendEmail(params, (error, data) => {
          if (error) {
            console.error("Error sending email:", error);
          } else {
            console.log("Email sent successfully:", data);
          }
        });
      } catch (error) {
        console.log("Reason for failure of email sending to the user:", error);
      }
    }
  }
};

module.exports = sendEmailNotification;

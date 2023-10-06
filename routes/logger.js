// const { createLogger, transports, format } = require('winston');
// const S3StreamLogger = require('winston-s3');

// const HMlogger = createLogger({
//   level: 'info',
//   format: format.combine(format.timestamp(), format.json()),
//   transports: [
//     new transports.File({ filename: 'loggererror.log', level: 'error' }),
//     new transports.File({ filename: 'loggerHM.log' }),
//     new S3StreamLogger({
//       bucketName: 'your-s3-bucket-name',
//       folder: 'logs', // Optional: Specify a folder in the bucket to store logs
//       access_key_id: 'your-access-key-id',
//       secret_access_key: 'your-secret-access-key',
//     }),
//   ],
// });

// // Clear the loggerHM.log file every 2 days (in milliseconds)
// const clearIntervalMs = 2 * 24 * 60 * 60 * 1000;

// function clearLogs() {
//   HMlogger.clear();
// }

// function setupClearLogsInterval() {
//   setupClearLogsInterval = setInterval(clearLogs, clearIntervalMs);
// }

// // Call the function to set up the interval when the application starts
// setupClearLogsInterval();

// module.exports = HMlogger;



const {createLogger,transports,format} = require('winston');

const HMlogger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(),format.json()),
//   defaultMeta: { service: 'user-service' },
  transports: [
       new transports.File({ filename: 'loggererror.log', level: 'error' }),
    new transports.File({ filename: 'loggerHM.log' }),
  ],
});

// Clear the loggerHM.log file every 2 days (in milliseconds)
const clearIntervalMs = 2 * 24 * 60 * 60 * 1000;
// Clear the loggerHM.log file every 10 minutes (in milliseconds)
// const clearIntervalMs = 10 * 60 * 1000;
// let clearLogsInterval;

function clearLogs() {
  HMlogger.clear();
}

function setupClearLogsInterval() {
  clearLogsInterval = setInterval(clearLogs, clearIntervalMs);
}

// Call the function to set up the interval when the application starts
setupClearLogsInterval();

module.exports=(HMlogger);
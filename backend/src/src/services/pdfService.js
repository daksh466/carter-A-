const { generatePDF } = require('../utils/pdf');

async function createInvoicePDF(data) {
  return new Promise((resolve, reject) => {
    generatePDF(data, (err, filePath) => {
      if (err) return reject(err);
      resolve(filePath);
    });
  });
}

module.exports = { createInvoicePDF };

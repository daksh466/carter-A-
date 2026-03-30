const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { pdfStoragePath } = require('../config');

function generatePDF(data, callback) {
  const doc = new PDFDocument();
  const filename = `${uuidv4()}.pdf`;
  const filePath = path.join(pdfStoragePath, filename);
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  // Add PDF content here
  doc.text(data);
  doc.end();
  stream.on('finish', () => callback(null, filePath));
  stream.on('error', callback);
}

module.exports = { generatePDF };

const { logger } = require('../utils/logger');
const Joi = require('joi');
const mongoose = require('mongoose');

// Custom AppError class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    statusCode: err.statusCode || err.status || 500
  });

  let error = { ...err };
  error.message = err.message;

  // Joi validation errors
  if (err.isJoi) {
    const joiError = new AppError('Invalid request data', 400);
    joiError.validationErrors = err.details.map(detail => detail.message).join(', ');
    error = joiError;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(`Invalid input data: ${message}`, 400);
  }

  // Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists`;
    error = new AppError(message, 409);
  }

  // Mongoose cast errors
  if (err.name === 'CastError') {
    error = new AppError('Invalid resource ID', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  // MongoServerError general
  if (err.name === 'MongoServerError') {
    error = new AppError('Database operation failed', 500);
  }

  // Default
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack, error: error.name })
  });
};

module.exports = errorHandler;
module.exports.AppError = AppError;


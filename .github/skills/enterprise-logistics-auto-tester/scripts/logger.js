/**
 * Logger - Simple logging utility with file and console support
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.logFile = config.logging.file;
    this.logLevel = config.logging.level;
    this.console = config.logging.console;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    this.currentLevel = this.levels[this.logLevel] || 2;
    this.ensureLogDir();
  }

  ensureLogDir() {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  formatTime() {
    const now = new Date();
    return now.toISOString();
  }

  log(level, message) {
    if (this.levels[level] > this.currentLevel) {
      return; // Skip logging below threshold
    }

    const timestamp = this.formatTime();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    // Console output
    if (this.console) {
      if (level === 'error') {
        console.error(logMessage);
      } else if (level === 'warn') {
        console.warn(logMessage);
      } else {
        console.log(logMessage);
      }
    }

    // File output
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, logMessage + '\n', 'utf8');
      } catch (err) {
        console.error(`Failed to write to log file: ${err.message}`);
      }
    }
  }

  error(message) {
    this.log('error', message);
  }

  warn(message) {
    this.log('warn', message);
  }

  info(message) {
    this.log('info', message);
  }

  debug(message) {
    this.log('debug', message);
  }
}

module.exports = new Logger();

/**
 * Report Generator - Creates JSON and markdown test reports
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');

class ReportGenerator {
  constructor() {
    this.outputDir = config.reports.outputDir;
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.report = {
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      test_duration_ms: 0,
      metrics: {
        stores_created: 0,
        machines_created: 0,
        spare_parts_created: 0,
        total_assignments: 0,
        initial_inventory_records: 0,
        shipments_created: 0,
        shipments_received: 0,
        edge_cases_tested: 0,
        stress_iterations: 0,
      },
      steps: {},
      passed_steps: [],
      failed_steps: [],
      errors: [],
      warnings: [],
      summary: '',
    };
    this.startTime = Date.now();
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.info(`✓ Created report directory: ${this.outputDir}`);
    }
  }

  /**
   * Record step execution
   */
  recordStep(stepName, stepNumber, status, details = '') {
    this.report.steps[stepName] = {
      number: stepNumber,
      status, // 'PASS', 'FAIL', 'SKIP'
      details,
      timestamp: new Date().toISOString(),
    };

    if (status === 'PASS') {
      this.report.passed_steps.push(`${stepNumber}_${stepName}`);
    } else if (status === 'FAIL') {
      this.report.failed_steps.push(`${stepNumber}_${stepName}`);
    }

    logger.debug(
      `Step ${stepNumber} (${stepName}): ${status}${details ? ` - ${details}` : ''}`
    );
  }

  /**
   * Record error
   */
  recordError(message, context = {}) {
    this.report.errors.push({
      message,
      context,
      timestamp: new Date().toISOString(),
    });
    logger.error(message);
  }

  /**
   * Record warning
   */
  recordWarning(message, context = {}) {
    this.report.warnings.push({
      message,
      context,
      timestamp: new Date().toISOString(),
    });
    logger.warn(message);
  }

  /**
   * Update metrics
   */
  updateMetrics(key, value) {
    if (key in this.report.metrics) {
      this.report.metrics[key] = value;
    }
  }

  incrementMetric(key) {
    if (key in this.report.metrics) {
      this.report.metrics[key]++;
    }
  }

  /**
   * Set final status, duration, and summary
   */
  finalizeReport(status, summary = '') {
    this.report.status = status;
    this.report.test_duration_ms = Date.now() - this.startTime;
    this.report.summary = summary || this.generateDefaultSummary();
  }

  /**
   * Generate default summary from report data
   */
  generateDefaultSummary() {
    const total = Object.keys(this.report.steps).length;
    const passed = this.report.passed_steps.length;
    const failed = this.report.failed_steps.length;

    let summary = `Test Execution Summary:\n`;
    summary += `- Total Steps: ${total}\n`;
    summary += `- Passed: ${passed}\n`;
    summary += `- Failed: ${failed}\n`;

    if (failed > 0) {
      summary += `\nFailed Steps:\n`;
      this.report.failed_steps.forEach((step) => {
        summary += `- ${step}\n`;
      });

      summary += `\nErrors:\n`;
      this.report.errors.forEach((err) => {
        summary += `- ${err.message}\n`;
      });
    }

    if (this.report.warnings.length > 0) {
      summary += `\nWarnings:\n`;
      this.report.warnings.forEach((warn) => {
        summary += `- ${warn.message}\n`;
      });
    }

    return summary;
  }

  /**
   * Generate JSON report
   */
  generateJSONReport() {
    return JSON.stringify(this.report, null, 2);
  }

  /**
   * Generate Markdown report
   */
  generateMarkdownReport() {
    let md = '# Enterprise Logistics Auto Tester - Test Report\n\n';

    // Header
    md += `## Execution Summary\n`;
    md += `- **Status**: ${this.report.status}\n`;
    md += `- **Timestamp**: ${this.report.timestamp}\n`;
    md += `- **Duration**: ${this.report.test_duration_ms}ms\n\n`;

    // Metrics
    md += `## Metrics\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    for (const [key, value] of Object.entries(this.report.metrics)) {
      const humanKey = key.replace(/_/g, ' ').toUpperCase();
      md += `| ${humanKey} | ${value} |\n`;
    }
    md += `\n`;

    // Steps
    md += `## Test Steps\n`;
    md += `- **Total**: ${Object.keys(this.report.steps).length}\n`;
    md += `- **Passed**: ${this.report.passed_steps.length}\n`;
    md += `- **Failed**: ${this.report.failed_steps.length}\n\n`;

    if (this.report.failed_steps.length > 0) {
      md += `### Failed Steps\n`;
      this.report.failed_steps.forEach((step) => {
        md += `- ❌ ${step}\n`;
      });
      md += `\n`;
    }

    // Errors
    if (this.report.errors.length > 0) {
      md += `## Errors\n`;
      this.report.errors.forEach((err, i) => {
        md += `\n### Error ${i + 1}\n`;
        md += `**Message**: ${err.message}\n`;
        md += `**Time**: ${err.timestamp}\n`;
        if (Object.keys(err.context).length > 0) {
          md += `**Context**:\n\`\`\`json\n${JSON.stringify(err.context, null, 2)}\n\`\`\`\n`;
        }
      });
    }

    // Warnings
    if (this.report.warnings.length > 0) {
      md += `## Warnings\n`;
      this.report.warnings.forEach((warn, i) => {
        md += `\n### Warning ${i + 1}\n`;
        md += `**Message**: ${warn.message}\n`;
        md += `**Time**: ${warn.timestamp}\n`;
      });
      md += `\n`;
    }

    // Summary
    md += `## Summary\n`;
    md += `\`\`\`\n${this.report.summary}\n\`\`\`\n`;

    return md;
  }

  /**
   * Save reports to disk
   */
  saveReports() {
    try {
      // JSON Report
      if (config.reports.includeJson) {
        const jsonFile = path.join(
          this.outputDir,
          `test-report-${this.timestamp}.json`
        );
        const jsonContent = this.generateJSONReport();
        fs.writeFileSync(jsonFile, jsonContent, 'utf8');
        logger.info(`✓ JSON report saved: ${jsonFile}`);
      }

      // Markdown Report
      if (config.reports.includeMarkdown) {
        const mdFile = path.join(
          this.outputDir,
          `test-report-${this.timestamp}.md`
        );
        const mdContent = this.generateMarkdownReport();
        fs.writeFileSync(mdFile, mdContent, 'utf8');
        logger.info(`✓ Markdown report saved: ${mdFile}`);
      }

      // Also write latest.json for easy reference
      const latestJsonFile = path.join(this.outputDir, 'test-report-latest.json');
      const jsonContent = this.generateJSONReport();
      fs.writeFileSync(latestJsonFile, jsonContent, 'utf8');
      logger.info(`✓ Latest report saved: ${latestJsonFile}`);

      return {
        json: config.reports.includeJson ? `test-report-${this.timestamp}.json` : null,
        markdown: config.reports.includeMarkdown ? `test-report-${this.timestamp}.md` : null,
        latest: 'test-report-latest.json',
      };
    } catch (error) {
      logger.error(`✗ Failed to save reports: ${error.message}`);
      throw error;
    }
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Status: ${this.report.status}`);
    console.log(`Duration: ${this.report.test_duration_ms}ms`);
    console.log(`Steps Passed: ${this.report.passed_steps.length}`);
    console.log(`Steps Failed: ${this.report.failed_steps.length}`);
    console.log(`Errors: ${this.report.errors.length}`);
    console.log(`Warnings: ${this.report.warnings.length}`);
    console.log('');
    console.log('Metrics:');
    for (const [key, value] of Object.entries(this.report.metrics)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log('='.repeat(80) + '\n');
  }
}

module.exports = ReportGenerator;

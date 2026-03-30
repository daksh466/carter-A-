/**
 * Test Report Generator
 * Generates JSON and markdown reports from test execution results
 */

const fs = require('fs');
const path = require('path');

const REPORT_DIR = process.env.REPORT_DIR || './reports/test-results';

/**
 * Initialize report directory
 */
function ensureReportDirectory() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    console.log(`✓ Created report directory: ${REPORT_DIR}`);
  }
}

/**
 * Test Result Container
 * Accumulates test metrics, errors, warnings throughout execution
 */
class TestReport {
  constructor() {
    this.startTime = new Date();
    this.status = 'IN_PROGRESS'; // Will be PASS or FAIL
    this.metrics = {
      stores_created: 0,
      machines_created: 0,
      spare_parts_created: 0,
      total_assignments: 0,
      initial_inventory_records: 0,
      shipments_tested: 0,
      edge_cases_validated: 0,
      stress_iterations: 0,
    };
    this.passed_steps = [];
    this.failed_steps = [];
    this.errors = [];
    this.warnings = [];
    this.details = {}; // Rich context per step
  }

  /**
   * Log step completion
   */
  recordStepCompletion(stepNumber, stepName, success = true, metadata = {}) {
    const stepKey = `step_${stepNumber}_${stepName}`;
    if (success) {
      this.passed_steps.push(stepKey);
      console.log(`✓ Step ${stepNumber} (${stepName}) passed`);
    } else {
      this.failed_steps.push(stepKey);
      console.error(`✗ Step ${stepNumber} (${stepName}) failed`);
    }
    this.details[stepKey] = metadata;
  }

  /**
   * Log error
   */
  addError(step, message, context = {}) {
    this.errors.push({
      step,
      message,
      timestamp: new Date().toISOString(),
      context,
    });
    console.error(`  ✗ Error in ${step}: ${message}`);
  }

  /**
   * Log warning
   */
  addWarning(step, message, context = {}) {
    this.warnings.push({
      step,
      message,
      timestamp: new Date().toISOString(),
      context,
    });
    console.warn(`  ⚠ Warning in ${step}: ${message}`);
  }

  /**
   * Update metric
   */
  updateMetric(metricName, value) {
    if (metricName in this.metrics) {
      this.metrics[metricName] = value;
    }
  }

  /**
   * Increment metric (counter)
   */
  incrementMetric(metricName, amount = 1) {
    if (metricName in this.metrics) {
      this.metrics[metricName] += amount;
    }
  }

  /**
   * Mark test completion
   */
  finalize(overallStatus = null) {
    if (overallStatus) {
      this.status = overallStatus;
    } else {
      this.status = this.failed_steps.length === 0 && this.errors.length === 0 ? 'PASS' : 'FAIL';
    }
  }

  /**
   * Generate JSON report
   */
  toJSON() {
    const endTime = new Date();
    const duration = endTime - this.startTime;

    return {
      status: this.status,
      timestamp: this.startTime.toISOString(),
      end_timestamp: endTime.toISOString(),
      duration_ms: duration,
      metrics: this.metrics,
      passed_steps_count: this.passed_steps.length,
      passed_steps: this.passed_steps,
      failed_steps_count: this.failed_steps.length,
      failed_steps: this.failed_steps,
      errors_count: this.errors.length,
      errors: this.errors,
      warnings_count: this.warnings.length,
      warnings: this.warnings,
      summary: this._generateSummary(),
    };
  }

  /**
   * Generate markdown report
   */
  toMarkdown() {
    const endTime = new Date();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);

    let md = `# Enterprise Logistics Auto Tester Report\n\n`;
    md += `**Status**: ${this.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n`;
    md += `**Run Time**: ${new Date(this.startTime).toLocaleString()}\n`;
    md += `**Duration**: ${duration}s\n\n`;

    md += `## Metrics Summary\n\n`;
    md += `| Metric | Count |\n`;
    md += `|--------|-------|\n`;
    for (const [key, value] of Object.entries(this.metrics)) {
      md += `| ${key.replace(/_/g, ' ')} | ${value} |\n`;
    }

    md += `\n## Step Results\n\n`;
    md += `### Passed Steps (${this.passed_steps.length})\n`;
    if (this.passed_steps.length === 0) {
      md += `None\n\n`;
    } else {
      this.passed_steps.forEach(step => {
        md += `- ✅ ${step.replace(/_/g, ' ')}\n`;
      });
      md += `\n`;
    }

    md += `### Failed Steps (${this.failed_steps.length})\n`;
    if (this.failed_steps.length === 0) {
      md += `None\n\n`;
    } else {
      this.failed_steps.forEach(step => {
        md += `- ❌ ${step.replace(/_/g, ' ')}\n`;
      });
      md += `\n`;
    }

    if (this.errors.length > 0) {
      md += `## Errors (${this.errors.length})\n\n`;
      this.errors.forEach((error, idx) => {
        md += `### Error ${idx + 1}: ${error.step}\n`;
        md += `**Message**: ${error.message}\n`;
        md += `**Time**: ${error.timestamp}\n`;
        if (Object.keys(error.context).length > 0) {
          md += `**Context**:\n\`\`\`json\n${JSON.stringify(error.context, null, 2)}\n\`\`\`\n`;
        }
        md += `\n`;
      });
    }

    if (this.warnings.length > 0) {
      md += `## Warnings (${this.warnings.length})\n\n`;
      this.warnings.forEach((warning, idx) => {
        md += `### Warning ${idx + 1}: ${warning.step}\n`;
        md += `**Message**: ${warning.message}\n`;
        md += `**Time**: ${warning.timestamp}\n\n`;
      });
    }

    md += `## Summary\n\n`;
    md += this._generateSummary();

    return md;
  }

  /**
   * Generate human-readable summary
   */
  _generateSummary() {
    const total = this.passed_steps.length + this.failed_steps.length;
    const passRate = total > 0 ? ((this.passed_steps.length / total) * 100).toFixed(1) : '0';

    let summary = ``;
    summary += `**Pass Rate**: ${passRate}% (${this.passed_steps.length}/${total} steps)\n`;
    summary += `**Total Errors**: ${this.errors.length}\n`;
    summary += `**Total Warnings**: ${this.warnings.length}\n`;

    if (this.status === 'PASS') {
      summary += `\n✅ All critical steps passed. System validation successful.`;
    } else {
      summary += `\n❌ Test suite encountered failures. Review errors above for details.`;
    }

    return summary;
  }
}

/**
 * Save JSON report to file
 */
function saveJSONReport(report, filename = null) {
  ensureReportDirectory();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const jsonFilename = filename || `test-run-${timestamp}.json`;
  const jsonPath = path.join(REPORT_DIR, jsonFilename);

  fs.writeFileSync(jsonPath, JSON.stringify(report.toJSON(), null, 2));
  console.log(`✓ JSON report saved: ${jsonPath}`);
  return jsonPath;
}

/**
 * Save markdown report to file
 */
function saveMarkdownReport(report, filename = null) {
  ensureReportDirectory();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const mdFilename = filename || `test-run-${timestamp}.md`;
  const mdPath = path.join(REPORT_DIR, mdFilename);

  fs.writeFileSync(mdPath, report.toMarkdown());
  console.log(`✓ Markdown report saved: ${mdPath}`);
  return mdPath;
}

/**
 * Save both report formats
 */
function saveAllReports(report, baseFilename = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const base = baseFilename || `test-run-${timestamp}`;

  const jsonPath = saveJSONReport(report, `${base}.json`);
  const mdPath = saveMarkdownReport(report, `${base}.md`);

  console.log(`\n📊 Reports saved to: ${REPORT_DIR}`);
  return { jsonPath, mdPath };
}

/**
 * CLI: Generate example report
 */
if (require.main === module) {
  const report = new TestReport();
  report.updateMetric('stores_created', 5);
  report.updateMetric('machines_created', 18);
  report.updateMetric('spare_parts_created', 10);
  report.recordStepCompletion(1, 'create_stores', true);
  report.recordStepCompletion(2, 'create_machines', true);
  report.addWarning('Step 2', 'Machine creation slow');
  report.finalize('PASS');

  const paths = saveAllReports(report);
  console.log(paths);
}

module.exports = {
  TestReport,
  ensureReportDirectory,
  saveJSONReport,
  saveMarkdownReport,
  saveAllReports,
  REPORT_DIR,
};

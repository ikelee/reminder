/**
 * Metrics helper - emits metrics for tracking user behavior
 * Currently logs to console, but can be replaced with any metrics platform
 */

function emit_metric(metricName, data) {
    // For now, just console log
    // Later can be replaced with: analytics.track(), mixpanel.track(), etc.
    console.log(`[METRIC] ${metricName}:`, JSON.stringify(data, null, 2));
}

module.exports = { emit_metric };




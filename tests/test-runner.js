#!/usr/bin/env node

/**
 * Test runner for system prompt iteration
 * Compares actual LLM output with expected output
 */

const fs = require('fs');
const path = require('path');
const AIParser = require('../src/business/aiParser');

// Allow specifying test file as command line argument
const testFileName = process.argv[2] || 'test-cases.json';
const testFile = path.join(__dirname, testFileName);
const tests = JSON.parse(fs.readFileSync(testFile, 'utf8'));

async function runTests() {
    // Set up parser
    const parser = new AIParser();
    
    // Override parser's now timestamp if provided in metadata
    if (tests.metadata && tests.metadata.timestamp) {
        parser.now = new Date(tests.metadata.timestamp);
        console.log(`Using test timestamp: ${parser.now.toISOString()}`);
        console.log(`Test timezone: ${tests.metadata.timezone || 'system default'}`);
        if (tests.metadata.timezone) {
            console.log(`Local time: ${parser.now.toLocaleString('en-US', { timeZone: tests.metadata.timezone })}`);
        }
        console.log();
    } else {
        console.log(`Using current time: ${new Date().toISOString()}\n`);
    }
    
    console.log('Running test cases...\n');
    
    let passed = 0;
    let failed = 0;
    
    for (let i = 0; i < tests.testCases.length; i++) {
        const test = tests.testCases[i];
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Test ${i + 1}/${tests.testCases.length}`);
        console.log(`Input: "${test.input}"`);
        if (test.notes) {
            console.log(`Notes: ${test.notes}`);
        }
        console.log('-'.repeat(60));
        
        try {
            const result = await parser.parse(test.input);
            
            // Compare results
            const issues = [];
            const warnings = [];
            
            if (result.title.toLowerCase() !== test.expected.title.toLowerCase()) {
                issues.push(`Title: expected "${test.expected.title}", got "${result.title}"`);
            }
            
            // Check date_window (from resolved date)
            // Parse date/time directly from ISO string to preserve local timezone
            if (result.due_at) {
                // Extract date from ISO string (YYYY-MM-DD portion before T)
                const resultDate = result.due_at.split('T')[0];
                if (test.expected.date_window && resultDate !== test.expected.date_window) {
                    issues.push(`Date: expected "${test.expected.date_window}", got "${resultDate}"`);
                }
            } else if (test.expected.date_window) {
                issues.push(`Date: expected "${test.expected.date_window}", got null`);
            }
            
            // Check time (from resolved date)
            if (result.due_at && test.expected.due_time) {
                // Extract time from ISO string (HH:mm portion after T)
                const timePart = result.due_at.split('T')[1];
                const resultTimeStr = timePart ? timePart.substring(0, 5) : null;
                if (resultTimeStr !== test.expected.due_time) {
                    issues.push(`Time: expected "${test.expected.due_time}", got "${resultTimeStr}"`);
                }
            }
            
            if (result.estimated_duration !== test.expected.estimated_duration) {
                warnings.push(`Duration: expected ${test.expected.estimated_duration}, got ${result.estimated_duration}`);
            }
            
            if (result.confidence !== test.expected.confidence) {
                issues.push(`Confidence: expected "${test.expected.confidence}", got "${result.confidence}"`);
            }
            
            if (result.urgency !== test.expected.urgency) {
                issues.push(`Urgency: expected "${test.expected.urgency}", got "${result.urgency || 'null'}"`);
            }
            
            if (issues.length === 0) {
                console.log('✅ PASSED');
                passed++;
            } else {
                console.log('❌ FAILED');
                console.log('Issues:');
                issues.forEach(issue => console.log(`  - ${issue}`));
                failed++;
            }
            
            if (warnings.length > 0) {
                console.log('Warnings:');
                warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
            }
            
            console.log('\nActual result:');
            console.log(JSON.stringify({
                title: result.title,
                due_at: result.due_at,
                estimated_duration: result.estimated_duration,
                urgency: result.urgency,
                confidence: result.confidence
            }, null, 2));
            
        } catch (error) {
            console.log('❌ ERROR');
            console.error(error);
            failed++;
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Results: ${passed} passed, ${failed} failed out of ${tests.testCases.length} tests`);
    console.log('='.repeat(60));
}

// Wait a bit for system prompt to load
setTimeout(() => {
    runTests().catch(console.error);
}, 1000);


/**
 * Tests for date utility functions
 * Focuses on edge cases, especially around end of year
 * 
 * Run with Jest: npx jest tests/dateUtils.test.js
 * Or with Node: node tests/dateUtils.test.js
 */

const DateUtils = require('../src/helpers/dateUtils');

// Simple test runner for Node (without Jest)
function runTests() {
    const tests = [];
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        tests.push({ name, fn });
    }

    function expect(actual) {
        return {
            toBe(expected) {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected}, got ${actual}`);
                }
            },
            toHaveProperty(prop) {
                if (!(prop in actual)) {
                    throw new Error(`Expected object to have property ${prop}`);
                }
            }
        };
    }

    function describe(name, fn) {
        console.log(`\n${name}`);
        fn();
    }

    // Test suite
    describe('DateUtils.getNextWeekdayDates', () => {
        test('should handle mid-year dates correctly', () => {
            const date = new Date(2025, 5, 15); // June 15, 2025 (Sunday)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            expect(nextDates.sunday).toBe('2025-06-22'); // Next Sunday (7 days)
            expect(nextDates.monday).toBe('2025-06-16'); // Next Monday (1 day)
            expect(nextDates.tuesday).toBe('2025-06-17'); // Next Tuesday (2 days)
        });

        test('should handle end of year correctly - December 30', () => {
            const date = new Date(2025, 11, 30); // December 30, 2025 (Tuesday)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            expect(nextDates.tuesday).toBe('2026-01-06'); // Next Tuesday crosses year boundary
            expect(nextDates.wednesday).toBe('2025-12-31'); // Next Wednesday (1 day)
            expect(nextDates.thursday).toBe('2026-01-01'); // Next Thursday crosses year boundary
            expect(nextDates.friday).toBe('2026-01-02'); // Next Friday crosses year boundary
        });

        test('should handle end of year correctly - December 31', () => {
            const date = new Date(2025, 11, 31); // December 31, 2025 (Wednesday)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            expect(nextDates.wednesday).toBe('2026-01-07'); // Next Wednesday (7 days, crosses year)
            expect(nextDates.thursday).toBe('2026-01-01'); // Next Thursday (1 day, crosses year)
            expect(nextDates.friday).toBe('2026-01-02'); // Next Friday (2 days, crosses year)
            expect(nextDates.saturday).toBe('2026-01-03'); // Next Saturday (3 days, crosses year)
        });

        test('should handle New Year correctly - January 1', () => {
            const date = new Date(2026, 0, 1); // January 1, 2026 (Thursday)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            expect(nextDates.thursday).toBe('2026-01-08'); // Next Thursday (7 days)
            expect(nextDates.friday).toBe('2026-01-02'); // Next Friday (1 day)
            expect(nextDates.saturday).toBe('2026-01-03'); // Next Saturday (2 days)
            expect(nextDates.sunday).toBe('2026-01-04'); // Next Sunday (3 days)
        });

        test('should handle leap year correctly - February 28', () => {
            const date = new Date(2024, 1, 28); // February 28, 2024 (Wednesday, leap year)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            expect(nextDates.wednesday).toBe('2024-03-06'); // Next Wednesday (7 days, crosses month)
            expect(nextDates.thursday).toBe('2024-02-29'); // Next Thursday (1 day, leap day)
            expect(nextDates.friday).toBe('2024-03-01'); // Next Friday (2 days, crosses month)
        });

        test('should handle month boundaries correctly', () => {
            const date = new Date(2025, 0, 31); // January 31, 2025 (Friday)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            expect(nextDates.friday).toBe('2025-02-07'); // Next Friday (7 days, crosses month)
            expect(nextDates.saturday).toBe('2025-02-01'); // Next Saturday (1 day, crosses month)
            expect(nextDates.sunday).toBe('2025-02-02'); // Next Sunday (2 days, crosses month)
        });

        test('should return 7 days when today is the target weekday', () => {
            const date = new Date(2025, 5, 15); // June 15, 2025 (Sunday)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            // When today is Sunday, next Sunday should be 7 days away
            expect(nextDates.sunday).toBe('2025-06-22');
        });

        test('should handle all weekdays from Monday', () => {
            const date = new Date(2025, 5, 16); // June 16, 2025 (Monday)
            const nextDates = DateUtils.getNextWeekdayDates(date);
            
            expect(nextDates.monday).toBe('2025-06-23'); // Next Monday (7 days)
            expect(nextDates.tuesday).toBe('2025-06-17'); // Next Tuesday (1 day)
            expect(nextDates.wednesday).toBe('2025-06-18'); // Next Wednesday (2 days)
            expect(nextDates.thursday).toBe('2025-06-19'); // Next Thursday (3 days)
            expect(nextDates.friday).toBe('2025-06-20'); // Next Friday (4 days)
            expect(nextDates.saturday).toBe('2025-06-21'); // Next Saturday (5 days)
            expect(nextDates.sunday).toBe('2025-06-22'); // Next Sunday (6 days)
        });
    });

    describe('DateUtils.formatLocalDate', () => {
        test('should format date correctly', () => {
            const date = new Date(2025, 11, 31); // December 31, 2025
            const formatted = DateUtils.formatLocalDate(date);
            expect(formatted).toBe('2025-12-31');
        });

        test('should handle single digit months and days', () => {
            const date = new Date(2025, 0, 5); // January 5, 2025
            const formatted = DateUtils.formatLocalDate(date);
            expect(formatted).toBe('2025-01-05');
        });

        test('should handle year boundaries', () => {
            const date = new Date(2026, 0, 1); // January 1, 2026
            const formatted = DateUtils.formatLocalDate(date);
            expect(formatted).toBe('2026-01-01');
        });
    });

    describe('DateUtils.parseLocalDate', () => {
        test('should parse date string correctly', () => {
            const date = DateUtils.parseLocalDate('2025-12-31');
            expect(date.getFullYear()).toBe(2025);
            expect(date.getMonth()).toBe(11); // 0-indexed
            expect(date.getDate()).toBe(31);
        });

        test('should create date in local timezone', () => {
            const date = DateUtils.parseLocalDate('2025-12-31');
            // Should not be affected by UTC conversion
            expect(date.getFullYear()).toBe(2025);
            expect(date.getMonth()).toBe(11);
            expect(date.getDate()).toBe(31);
        });
    });

    describe('DateUtils.getTimezoneInfo', () => {
        test('should return timezone information', () => {
            const date = new Date(2025, 11, 23, 10, 0, 0);
            const info = DateUtils.getTimezoneInfo(date);
            
            expect(info).toHaveProperty('timezone');
            expect(info).toHaveProperty('timezoneOffset');
            expect(info).toHaveProperty('currentDate');
            expect(info).toHaveProperty('currentTime');
            expect(info).toHaveProperty('dayOfWeek');
            expect(info.currentDate).toBe('2025-12-23');
        });
    });

    // Run all tests
    console.log('Running date utility tests...\n');
    tests.forEach(({ name, fn }) => {
        try {
            fn();
            console.log(`  ✓ ${name}`);
            passed++;
        } catch (error) {
            console.log(`  ✗ ${name}`);
            console.log(`    ${error.message}`);
            failed++;
        }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
    console.log('='.repeat(60));

    process.exit(failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
    runTests();
}

// Export for Jest if available
if (typeof describe !== 'undefined' && typeof test !== 'undefined') {
    // Jest is available, use Jest syntax
    module.exports = {
        DateUtils,
        // Jest will handle the rest
    };
} else {
    // No Jest, export test runner
    module.exports = { runTests };
}

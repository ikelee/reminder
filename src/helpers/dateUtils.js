/**
 * Date utility functions for parsing and formatting dates
 * Handles timezone-aware date operations and weekday calculations
 */

class DateUtils {
    /**
     * Get the next occurrence of each weekday from a given date
     * @param {Date} fromDate - The reference date
     * @returns {Object} Object with weekday names as keys and YYYY-MM-DD dates as values
     */
    static getNextWeekdayDates(fromDate) {
        // Parse date in local timezone to avoid UTC interpretation
        const year = fromDate.getFullYear();
        const month = fromDate.getMonth();
        const day = fromDate.getDate();
        const today = new Date(year, month, day); // Create in local timezone
        
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const nextDates = {};

        weekdays.forEach((dayName, targetDay) => {
            // Calculate days until next occurrence of this weekday
            // If today is the target day, return 7 (next week), otherwise return days until next occurrence
            const daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
            const nextDate = new Date(today);
            nextDate.setDate(today.getDate() + daysUntil);
            
            // Format date in local timezone, not UTC
            const nextYear = nextDate.getFullYear();
            const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
            const nextDay = String(nextDate.getDate()).padStart(2, '0');
            nextDates[dayName.toLowerCase()] = `${nextYear}-${nextMonth}-${nextDay}`;
        });

        return nextDates;
    }

    /**
     * Format a date as YYYY-MM-DD in local timezone
     * @param {Date} date - The date to format
     * @returns {string} Formatted date string
     */
    static formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Parse a YYYY-MM-DD string into a Date object in local timezone
     * @param {string} dateString - Date string in YYYY-MM-DD format
     * @returns {Date} Date object in local timezone
     */
    static parseLocalDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
    }

    /**
     * Get timezone information for a given date
     * @param {Date} date - The date to get timezone info for
     * @returns {Object} Object with timezone, offset, and formatted strings
     */
    static getTimezoneInfo(date) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const timezoneOffset = -date.getTimezoneOffset() / 60; // Offset in hours
        const currentDate = this.formatLocalDate(date);
        const currentTime = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            timeZoneName: 'short' 
        });
        const dayOfWeek = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            timeZone: timezone 
        });

        return {
            timezone,
            timezoneOffset,
            currentDate,
            currentTime,
            dayOfWeek
        };
    }
}

module.exports = DateUtils;


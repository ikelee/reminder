/**
 * AI-powered obligation parser (Server-side)
 * Uses LLM for intelligent extraction
 */

const DateUtils = require('../helpers/dateUtils');

class AIParser {
    constructor() {
        this.now = new Date();
        // Using hardcoded API key for now (will be replaced with payment feature later)
    }

    async parse(input) {
        if (!input || typeof input !== 'string') {
            return { 
                title: input || '', 
                due_at: null,
                estimated_duration: null,
                urgency: null,
                confidence: 'low',
                needs_clarification: true
            };
        }

        const text = input.trim();
        
        // Always use AI parsing
        if (!this.apiKey) {
            return {
                title: text,
                due_at: null,
                estimated_duration: null,
                urgency: null,
                confidence: 'low',
                needs_clarification: true
            };
        }

        try {
            const aiResult = await this.aiParse(text);
            return aiResult;
        } catch (error) {
            console.error('AI parsing failed:', error);
            return {
                title: text,
                due_at: null,
                estimated_duration: null,
                urgency: null,
                confidence: 'low',
                needs_clarification: true
            };
        }
    }

    async aiParse(text) {
        // Get timezone information using DateUtils
        const tzInfo = DateUtils.getTimezoneInfo(this.now);
        const { currentDate, currentTime, timezone, timezoneOffset, dayOfWeek } = tzInfo;
        
        // Get next weekday dates
        const nextDates = DateUtils.getNextWeekdayDates(this.now);
        
        // Compute "now" timestamp for urgent tasks
        const hours = String(this.now.getHours()).padStart(2, '0');
        const minutes = String(this.now.getMinutes()).padStart(2, '0');
        const offsetSign = timezoneOffset >= 0 ? '+' : '-';
        const offsetHours = String(Math.abs(timezoneOffset)).padStart(2, '0');
        const nowTimestamp = `${currentDate}T${hours}:${minutes}:00${offsetSign}${offsetHours}:00`;
        
        const prompt = `You are a task parser. Extract structured data from user input.

Input: "${text}"
Current date/time: ${currentDate} ${currentTime}
Timezone: ${timezone} (UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset})
Day of week: ${dayOfWeek}
Next occurrence of each weekday from today:
- Monday: ${nextDates.monday}
- Tuesday: ${nextDates.tuesday}
- Wednesday: ${nextDates.wednesday}
- Thursday: ${nextDates.thursday}
- Friday: ${nextDates.friday}
- Saturday: ${nextDates.saturday}
- Sunday: ${nextDates.sunday}

Rules:
1. Title:
   - Short, imperative phrase
   - Remove filler words
   - Preserve urgency markers (ASAP, urgent) and appointment times in title

2. Urgency detection:
   - Explicit urgency: "ASAP", "urgent", "immediately", "right now", "as soon as possible"
   - Time-sensitive scheduling: "call/email X to schedule/book/make appointment for [soon]"
     * "soon" = today, tomorrow, this week, or within 3 days
     * "call dentist for appointment tomorrow" → immediate (need to call now)
     * "call dentist for cleaning next month" → normal (just a reminder)
   - If urgent/immediate: due_at = "${nowTimestamp}" (this exact value, copy it exactly)
   - If normal: use the appointment/event date as due_at

3. Date resolution (non-urgent tasks):
   CRITICAL: All dates must be in the FUTURE.
   
   Weekdays:
   - Bare or "next [weekday]" (e.g., "Friday", "next Friday") → next occurrence (this week if not passed, else next week)
   - "this [weekday]" → this week only, null if already passed
   - If today is that weekday → next week
   - Aliases: mon,tue,wed,thu,fri,sat,sun
   
   Months:
   - "next [MONTH]" → that month in next calendar year (e.g., "next Dec" in Dec 2025 → Dec 2026)
   - "mid [MONTH]" → 15th, "end of [MONTH]" → last day, "by [MONTH]"/bare → 1st
   - If calculated date is past → use next year
   
   Examples from March 12, 2025 (Wednesday):
   - "Friday" → March 14, 2025 | "Wednesday" → March 19, 2025 | "Monday" → March 17, 2025 | "mid Feb" → Feb 15, 2026 | "mid May" → May 15, 2025 | "next March" → March 1, 2026

4. Time defaults (if no explicit time):
   - business (calls, emails, meetings, admin) → 09:00
   - personal (gym, practice, solo work) → 19:00
   - social (meals, hangouts) → 18:00 (dinner) or 12:00 (lunch)
   - Apply defaults strictly; do not invent other times
   - Calls to people (family, friends) → personal
   - Calls to companies or services → business

5. Duration:
   - Estimate minutes for short tasks (calls, emails, admin)
   - Otherwise set to null
   - Do not invent large durations

Output JSON:
{
  "title": "string",
  "due_at": "ISO 8601 timestamp or null",
  "task_type": "business" | "personal" | "social",
  "estimated_duration": number or null,
  "confidence": "high" | "medium" | "low",
  "urgency": "immediate" | "normal"
}

Additional:
- Use full ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ
- Generate time in local timezone, and return in local timezone
- Set due_at to null if date is unclear
- Urgency "immediate" = action needed now, due_at set to current time
- Urgency "normal" = due_at set to the event/appointment date
- Confidence:
  - high: explicit or well-defined relative date
  - medium: fuzzy but bounded date
  - low: unclear or missing date`;

        const startTime = Date.now();
        console.log('[LLM Call] Starting AI parse:', {
            timestamp: new Date().toISOString(),
            input: text,
            promptLength: prompt.length
        });

        console.log(`currentDate: ${currentDate}, currentTime: ${currentTime}`);
        console.log(`timezone: ${timezone}, timezoneOffset: ${timezoneOffset}, dayOfWeek: ${dayOfWeek}`);
        console.log(`nextDates: ${JSON.stringify(nextDates)}`);

        try {
            const requestBody = {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a precise obligation parser. Extract only what is explicitly stated. Never guess dates or times.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0,
                response_format: { type: 'json_object' }
            };

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LLM Call] API Error:', {
                    timestamp: new Date().toISOString(),
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                    duration: `${duration}ms`
                });
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const content = JSON.parse(data.choices[0].message.content);
            
            // Log successful response
            console.log('[LLM Call] Success:', {
                timestamp: new Date().toISOString(),
                input: text,
                model: data.model,
                tokens: {
                    prompt: data.usage?.prompt_tokens || 'N/A',
                    completion: data.usage?.completion_tokens || 'N/A',
                    total: data.usage?.total_tokens || 'N/A'
                },
                duration: `${duration}ms`,
                response: content,
                confidence: content.confidence || 'medium'
            });
            
            const result = {
                title: content.title || text,
                due_at: content.due_at || null,
                estimated_duration: content.estimated_duration,
                urgency: content.urgency || null,
                confidence: content.confidence || 'medium',
                needs_clarification: content.confidence === 'low'
            };

            console.log('[LLM Call] Final result:', {
                timestamp: new Date().toISOString(),
                input: text,
                result: result
            });

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error('[LLM Call] Error:', {
                timestamp: new Date().toISOString(),
                input: text,
                error: error.message,
                stack: error.stack,
                duration: `${duration}ms`
            });
            return {
                title: text,
                due_at: null,
                estimated_duration: null,
                urgency: null,
                confidence: 'low',
                needs_clarification: true
            };
        }
    }

}

module.exports = AIParser;

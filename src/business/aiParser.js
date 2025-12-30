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
   - Capitalize, remove filler
   - Remove relative dates ("next week", "in 3 days") BUT keep explicit times and "quick"/"with person"
   - Keep "due" for deadlines
   - Examples: "gym next week"→"Gym session", "call dentist tomorrow at 2pm"→"call dentist tomorrow at 2pm", "quick call with John in 3 days"→"Quick call with John", "tax return due in a month"→"tax return due", "call dentist for tomorrow at 2pm"→"Call dentist for appointment tomorrow at 2pm"

2. Urgency AND Date:
   - If "for tomorrow" or "for today" (keyword "for" before date): urgency="immediate", due_at="${nowTimestamp}" (COPY THIS EXACT VALUE, ignore any time in input)
   - "tomorrow" WITHOUT "for" = normal
   - Otherwise: urgency="normal"
   - For normal tasks, calculate due_at from date phrases

3. Date calculations (normal tasks, MUST be FUTURE):
   - "tomorrow"=${currentDate}+1 day (Dec 23→Dec 24)
   - "in X days"=${currentDate}+X days (Dec 23 + 3=Dec 26)
   - "in a month"=${currentDate} +1 month same day (Dec 23→Jan 23 2026 NOT Jan 23 2025)
   - "next week"=${nextDates.monday}
   - "this weekend"=Saturday from list
   - "Friday"/"Monday" etc=use next occurrence from list
   - "mid [month]"=15th, if past use next year
   - "Jan 10"=2026-01-10 (we're in Dec 2025)
   - "end of month"=Dec 31

4. Time (use explicit time if given, otherwise defaults):
   - If "at 2pm" or "at 11am" given in input, USE THAT TIME
   - business (cancel membership, submit, calls to dentist/doctor)=09:00
   - personal weekday (gym, practice)=19:00
   - personal weekend=09:00
   - brunch=11:00, lunch=12:00, dinner=18:00
   - "due"/"by end"=17:00
   - calls with people (John, mom, Sarah)=personal
   - calls to services=business

5. Duration: "quick"=10min, regular call=15min, meeting/lunch=60min, else null

6. Confidence: clear dates=high, "by end of"=medium, no date=low

Return valid json:
{
  "title": "string",
  "due_at": "YYYY-MM-DDTHH:mm:ss±HH:mm or null",
  "task_type": "business"|"personal"|"social",
  "estimated_duration": number or null,
  "confidence": "high"|"medium"|"low",
  "urgency": "immediate"|"normal"
}`;

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
                    { role: 'system', content: 'You are a precise obligation parser. Extract only what is explicitly stated. Never guess dates or times. Return valid json.' },
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

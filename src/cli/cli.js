#!/usr/bin/env node

/**
 * CLI interface for obligation management
 */

const readline = require('readline');
const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:3000';

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
                    }
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                reject(new Error(`Cannot connect to server at ${API_BASE}. Is the server running?`));
            } else {
                reject(new Error(`Request failed: ${err.message}`));
            }
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function listObligations() {
    try {
        const obligations = await makeRequest('GET', '/api/obligations');
        
        if (obligations.length === 0) {
            console.log('No obligations found.');
            return;
        }

        const now = new Date();
        const groups = {
            missed: [],
            now: [],
            today: [],
            thisWeek: [],
            later: []
        };

        obligations.forEach(obligation => {
            if (obligation.status === 'missed') {
                groups.missed.push(obligation);
            } else if (obligation.status === 'done') {
                return;
            } else if (obligation.due_at) {
                const dueAt = new Date(obligation.due_at);
                const hoursUntil = (dueAt - now) / (1000 * 60 * 60);
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const weekFromNow = new Date(now);
                weekFromNow.setDate(weekFromNow.getDate() + 7);

                if (hoursUntil < 0) {
                    groups.missed.push(obligation);
                } else if (hoursUntil < 2) {
                    groups.now.push(obligation);
                } else if (dueAt < tomorrow) {
                    groups.today.push(obligation);
                } else if (dueAt < weekFromNow) {
                    groups.thisWeek.push(obligation);
                } else {
                    groups.later.push(obligation);
                }
            } else {
                groups.later.push(obligation);
            }
        });

        const printGroup = (title, items) => {
            if (items.length === 0) return;
            console.log(`\n${title}:`);
            items.forEach((item, idx) => {
                const dueStr = item.due_at 
                    ? new Date(item.due_at).toLocaleString() 
                    : 'No date';
                const status = item.status === 'missed' ? ' [MISSED]' : '';
                console.log(`  ${idx + 1}. ${item.title} - ${dueStr}${status}`);
            });
        };

        printGroup('Missed', groups.missed);
        printGroup('Now', groups.now);
        printGroup('Today', groups.today);
        printGroup('This Week', groups.thisWeek);
        printGroup('Later', groups.later);
    } catch (error) {
        console.error('Error listing obligations:', error.message);
    }
}

async function addObligation(text) {
    try {
        const result = await makeRequest('POST', '/api/obligations', { text });
        
        if (result.needs_clarification) {
            console.log('Need clarification for date/time.');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            return new Promise((resolve) => {
                rl.question('When is this due? ', async (followup) => {
                    rl.close();
                    try {
                        await makeRequest('POST', '/api/obligations', { 
                            text, 
                            followup 
                        });
                        console.log('Obligation added!');
                    } catch (error) {
                        console.error('Error adding obligation:', error.message || error);
                    }
                    resolve();
                });
            });
        } else {
            console.log('Obligation added!');
            console.log('  Title:', result.title);
            if (result.due_at) {
                console.log('  Due:', new Date(result.due_at).toLocaleString());
            }
        }
    } catch (error) {
        console.error('Error adding obligation:', error.message || error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

async function toggleDone(id) {
    try {
        await makeRequest('PATCH', `/api/obligations/${id}/toggle`);
        console.log('Obligation status updated!');
    } catch (error) {
        console.error('Error updating obligation:', error.message);
    }
}

async function deleteObligation(id) {
    try {
        await makeRequest('DELETE', `/api/obligations/${id}`);
        console.log('Obligation deleted!');
    } catch (error) {
        console.error('Error deleting obligation:', error.message);
    }
}

async function clearAll() {
    try {
        const result = await makeRequest('DELETE', '/api/obligations/all');
        console.log(`All obligations cleared. (${result.count} removed)`);
    } catch (error) {
        console.error('Error clearing obligations:', error.message);
    }
}

async function loadSamples() {
    try {
        const result = await makeRequest('POST', '/api/obligations/samples');
        console.log(`Loaded ${result.count} sample obligations`);
    } catch (error) {
        console.error('Error loading samples:', error.message);
    }
}

// CLI interface
const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
    switch (command) {
        case 'add':
        case 'a':
            if (args.length === 0) {
                console.error('Usage: node cli.js add "obligation text"');
                process.exit(1);
            }
            await addObligation(args.join(' '));
            break;

        case 'list':
        case 'ls':
        case 'l':
            await listObligations();
            break;

        case 'toggle':
        case 't':
            if (args.length === 0) {
                console.error('Usage: node cli.js toggle <id>');
                process.exit(1);
            }
            await toggleDone(args[0]);
            break;

        case 'delete':
        case 'del':
        case 'd':
            if (args.length === 0) {
                console.error('Usage: node cli.js delete <id>');
                process.exit(1);
            }
            await deleteObligation(args[0]);
            break;

        case 'clear':
        case 'c':
            await clearAll();
            break;

        case 'samples':
        case 'sample':
        case 's':
            await loadSamples();
            break;

        default:
            console.log(`
Usage: node cli.js <command> [args]

Commands:
  add, a <text>     Add a new obligation
  list, ls, l       List all obligations
  toggle, t <id>    Toggle obligation done status
  delete, d <id>    Delete an obligation
  clear, c          Clear all obligations
  samples, s        Load sample obligations

Examples:
  node cli.js add "Call dentist tomorrow"
  node cli.js list
  node cli.js toggle 1234567890
  node cli.js clear
  node cli.js samples
            `);
            process.exit(1);
    }
}

main().catch(console.error);


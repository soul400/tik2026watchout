const fs = require('fs');

const logPath = 'C:\\Users\\soulm\\.gemini\\antigravity\\brain\\5d8e809c-4fe9-490c-9532-d16250fca4db\\.system_generated\\tasks\\task-4335.log';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

const samples = [];
const seenTypes = new Set();

for (const line of lines) {
  if (line.includes('[TACTICAL_RAW]')) {
    const jsonStart = line.indexOf('summary=');
    if (jsonStart !== -1) {
      try {
        const rawJson = line.slice(jsonStart + 8).trim();
        const obj = JSON.parse(rawJson);
        const key = `${obj.msgType}_${obj.awardCardNotice ? 'award' : 'no_award'}_${obj.cardObtainGuide ? 'guide' : 'no_guide'}`;
        if (!seenTypes.has(key)) {
          seenTypes.add(key);
          samples.push(obj);
        }
      } catch (err) {}
    }
  }
}

console.log('Unique sample variations found:', samples.length);
console.log(JSON.stringify(samples, null, 2));

import { WebcastEvent } from 'tiktok-live-connector';

console.log('WebcastEvents:', Object.entries(WebcastEvent).filter(([k]) => k.toLowerCase().includes('battle') || k.toLowerCase().includes('card') || k.toLowerCase().includes('item') || k.toLowerCase().includes('task')));

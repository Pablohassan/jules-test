
import 'dotenv/config';
import { generatePresentation } from './services/gamma/client.js';

console.log('--- Diagnostic Start ---');
const key = process.env.GAMMA_API_KEY;
if (!key) {
  console.error('ERROR: GAMMA_API_KEY is undefined or empty!');
} else {
  console.log(`GAMMA_API_KEY found: ${key.substring(0, 10)}... (Length: ${key.length})`);
}

const base = process.env.GAMMA_API_BASE;
console.log(`GAMMA_API_BASE: ${base}`);

// Test a real call if key exists (using a dummy prompt)
if (key) {
    console.log('Attempting real API call with loaded key...');
    try {
        // We won't actually create a full presentation to save credits/time, 
        // but we can try to hit the endpoint and see if we get 401 or 200 (or 400 for bad payload)
        // Actually, let's try a very simple generation to be sure.
        // Note: This might cost credits if it works.
        // But the user wants it fixed.
        
        // Let's just check if we can make a request that gets past auth.
        const url = 'https://public-api.gamma.app/v1.0/users/me'; // Try a "me" endpoint if it exists, or just fail on generation
        // Gamma doesn't document a /me endpoint publicly easily.
        // Let's stick to the generation endpoint but with invalid payload to trigger 400 (which means Auth passed)
        
        const res = await fetch('https://public-api.gamma.app/v1.0/generations', {
            method: 'POST',
            headers: {
                'X-API-KEY': key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Empty body should trigger 400 Bad Request, NOT 401
        });
        
        console.log(`Response Status: ${res.status}`);
        if (res.status === 401 || res.status === 403) {
            console.error('Auth Failed! Key is invalid or not accepted.');
        } else if (res.status === 400) {
            console.log('Success! Auth passed (got 400 Bad Request as expected for empty body).');
        } else {
            console.log('Response:', await res.text());
        }
        
    } catch (e) {
        console.error('Request failed:', e);
    }
}
console.log('--- Diagnostic End ---');

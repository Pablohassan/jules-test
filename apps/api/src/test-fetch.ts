
import 'dotenv/config';

const GAMMA_API_KEY = process.env.GAMMA_API_KEY || '';
const GAMMA_API_BASE = (process.env.GAMMA_API_BASE || 'https://public-api.gamma.app').replace(/\/$/, '');
const GAMMA_API_VERSION = (process.env.GAMMA_API_VERSION || 'v1.0').replace(/^\//, '').replace(/\/$/, '');
const GAMMA_API_AUTH_STYLE = (process.env.GAMMA_API_AUTH_STYLE || 'x-api-key').toLowerCase();
const RAW_GENERATE_PATH = process.env.GAMMA_API_GENERATE_PATH || '/generations';
const GAMMA_API_GENERATE_PATH = RAW_GENERATE_PATH.startsWith('/') ? RAW_GENERATE_PATH : `/${RAW_GENERATE_PATH}`;

const HOST_CANDIDATES = Array.from(new Set([
  'https://public-api.gamma.app',
  GAMMA_API_BASE,
  'https://api.gamma.app',
]));

const VERSION_CANDIDATES = Array.from(new Set([
  GAMMA_API_VERSION,
  'v1.0',
  'v1',
].filter(Boolean)));

function gammaHeaders(extra?: Record<string, string>, authStyle?: 'bearer' | 'x-api-key') {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const style = (authStyle || GAMMA_API_AUTH_STYLE);
  if (style === 'bearer') {
    if (GAMMA_API_KEY) h['Authorization'] = `Bearer ${GAMMA_API_KEY}`;
  } else {
    if (GAMMA_API_KEY) h['X-API-KEY'] = `${GAMMA_API_KEY}`;
  }
  if (extra) Object.assign(h, extra);
  return h;
}

async function testFullLogic() {
  console.log('Env check:');
  console.log('GAMMA_API_BASE:', GAMMA_API_BASE);
  console.log('GAMMA_API_KEY length:', GAMMA_API_KEY.length);
  console.log('GAMMA_API_AUTH_STYLE:', GAMMA_API_AUTH_STYLE);

  const tryPaths = Array.from(new Set([
    ...HOST_CANDIDATES.flatMap(h => VERSION_CANDIDATES.map(v => `${h}/${v}${GAMMA_API_GENERATE_PATH}`)),
    ...HOST_CANDIDATES.flatMap(h => VERSION_CANDIDATES.map(v => `${h}/${v}/generations`)),
    ...HOST_CANDIDATES.map(h => `${h}${GAMMA_API_GENERATE_PATH}`),
    ...HOST_CANDIDATES.map(h => `${h}/generations`),
  ]));

  const authStyles: Array<'bearer' | 'x-api-key'> = GAMMA_API_AUTH_STYLE === 'bearer'
    ? ['bearer', 'x-api-key']
    : ['x-api-key', 'bearer'];

  const payload = {
    inputText: "Test presentation",
    textMode: 'preserve',
    format: 'presentation',
  };

  console.log('Trying paths:', tryPaths);

  for (const style of authStyles) {
    for (const url of tryPaths) {
      try {
        console.log(`Trying ${url} with style ${style}...`);
        const response = await fetch(url, { 
            method: 'POST', 
            headers: gammaHeaders(undefined, style), 
            body: JSON.stringify(payload) 
        });
        
        console.log(`Response: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            const text = await response.text();
            console.log('Error text:', text);
        }
      } catch (e) {
        console.error(`Failed @ ${url}:`, (e as Error).message);
      }
    }
  }
}

testFullLogic();

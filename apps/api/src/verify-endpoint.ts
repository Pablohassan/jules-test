
async function verifyEndpoint() {
  const url = 'https://public-api.gamma.app/v1.0/generations';
  console.log(`Testing endpoint: ${url}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': 'invalid-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ textMode: 'generate' })
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Body: ${text}`);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

verifyEndpoint();

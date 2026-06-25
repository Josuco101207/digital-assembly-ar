export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientId = process.env.ASPOSE_CLIENT_ID;
  const clientSecret = process.env.ASPOSE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Aspose credentials not configured in environment' });
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });

  try {
    const fetchRes = await fetch('https://api.aspose.cloud/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    
    const data = await fetchRes.json();
    
    if (!data.access_token) {
      throw new Error(data.error_description || 'Failed to obtain access token');
    }
    
    res.status(200).json({ access_token: data.access_token });
  } catch (error) {
    console.error('Aspose Auth Error:', error);
    res.status(500).json({ error: error.message });
  }
}

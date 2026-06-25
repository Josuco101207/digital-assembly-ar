async function test() {
  const clientId = '7ea12a7a-0378-4fcd-8230-a35e544c3456';
  const clientSecret = 'abb93388de522610d04032be19315fba';
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });

  try {
    const res = await fetch('https://api.aspose.cloud/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });
    const data = await res.json();
    console.log(data.access_token ? "AUTH SUCCESS" : data);
  } catch(e) {
    console.error(e);
  }
}
test();

async function test() {
  const clientId = '7ea12a7a-0378-4fcd-8230-a35e544c3456';
  const clientSecret = 'abb93388de522610d04032be19315fba';
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });

  const res = await fetch('https://api.aspose.cloud/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const { access_token } = await res.json();
  
  const downloadRes = await fetch('https://api.aspose.cloud/v3.0/3d/storage/file/test.txt', {
       method: 'GET',
       headers: { 
         'Authorization': `Bearer ${access_token}`
       }
  });
  
  console.log("Download text:", await downloadRes.text());
}
test();

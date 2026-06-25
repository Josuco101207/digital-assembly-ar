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
  
  // Try to upload the raw binary of a tiny zip file masquerading as SKP to see if raw works
  const uploadRes = await fetch('https://api.aspose.cloud/v3.0/3d/storage/file/test.skp', {
       method: 'PUT',
       headers: { 
         'Authorization': `Bearer ${access_token}`
       },
       body: Buffer.from("Not a real SKP file")
  });
  console.log("Upload Status:", uploadRes.status);
  
  // Try to convert
  const convertRes = await fetch(`https://api.aspose.cloud/v3.0/3d/saveas/newformat?name=test.skp&newformat=glb&newfilename=out.glb`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
  console.log("Convert Status:", convertRes.status);
  console.log("Convert error:", await convertRes.text());
}
test();

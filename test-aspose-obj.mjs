import FormData from 'form-data';

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
  
  // Make a small OBJ file
  const objContent = `v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.0 1.0 0.0
f 1 2 3
`;
  
  const formData = new FormData();
  formData.append('File', Buffer.from(objContent), 'test.obj');

  const uploadRes = await fetch('https://api.aspose.cloud/v3.0/3d/storage/file/test.obj', {
       method: 'PUT',
       headers: { 
         'Authorization': `Bearer ${access_token}`
       },
       body: formData
  });
  console.log("Upload Status:", uploadRes.status);
  
  // Try to convert to PDF or something simple
  const convertRes = await fetch(`https://api.aspose.cloud/v3.0/3d/saveas/newformat?name=test.obj&newformat=pdf&newfilename=out.pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
  console.log("Convert Status:", convertRes.status);
  console.log("Convert text:", await convertRes.text());
}
test();

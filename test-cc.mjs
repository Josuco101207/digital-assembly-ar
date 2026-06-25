import CloudConvert from 'cloudconvert';

async function test() {
  try {
    const fetchRes = await fetch('https://api.cloudconvert.com/v2/convert/formats', {
        headers: { 'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiNGMwMmMxNjM4NTliNmU4NWJhMDllYjg0ZjYxMmRkZTQwMDUzZTZmNzg5OWVhMjM0OGI2ZDdhMzU5OTRhZGZlMThkZDgyNjUzMGFhMGVlNTIiLCJpYXQiOjE3ODI0MTE5OTkuNDg0NzU4LCJuYmYiOjE3ODI0MTE5OTkuNDg0NzU5LCJleHAiOjQ5MzgwODU1OTkuNDc5MzUzLCJzdWIiOiI3NjEwNjIyMiIsInNjb3BlcyI6WyJ1c2VyLnJlYWQiLCJ0YXNrLndyaXRlIiwidGFzay5yZWFkIl19.Jzwh2Si9tr7qvM9grV8-x53V_jWWXyoQot20dV7j-dl9w5dabt49ng-iBnmE1Y7GWTZbUfJDRcRbmhSrsUHNRRNLQLWnaguQjCKKD1jDRYXTP8XL70fR4srZB9Cp8HSJ_810eXJnzix8N-9BSWyHamWgke5CX21ghC3vsdR88W_Js-ufwG4L27BDSciS_BWZAOQRarr3lCwBHMxTeArjrWqdsQr8gvywiLLiCdK9jeFDWijOweV_WbUm9afRhSCYxSTiMfuHjPTgLH9adIasrS27T90PoVOnyHhoSjCOL9dKJNb8wSSvpuFJjZOq6Mii4turZTariqpngtRQBe96rXZVpYkYkJ1EjcTGh0dv3nVkx0F1fdxOoD4Vmy77q5PSNub2KqQcPl7ruSTxEYt1qMLBRt5cvjumTUxJTQDa1Ud_i90dH1GlIgbJD95K4UscEa7bSu_E56tIkfNJcXHq9GOr8U_q8IQYNwK-23Qk7eLZB0BDqRtSYkvDZlKIIZNSgxxBbvDqKeCyO0zDz7WtLrfiRfjx3QfBwHpRujFMVGobWFK5RGSQi2x0rSq2xZvD7m9OrrCp02rZz_MpBoUTXBAVQYgKWkR057MJM4xit187H7HAMQyuy4Ep-5EbaWiVmAVwjcl7TsR4KB2PB_znSw_ni_3tMTz9Uqa3S3JxKi8' }
    });
    const { data } = await fetchRes.json();
    const skpFormats = data.filter(d => d.input_format === 'skp');
    console.log('SKP Formats:', skpFormats);
  } catch (error) {
    console.error('ERROR:', error);
  }
}
test();

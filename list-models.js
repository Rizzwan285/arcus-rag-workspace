const https = require('https');
const key = require('fs').readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('GOOGLE_GENERATIVE_AI_API_KEY')).split('"')[1];
https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const models = JSON.parse(data).models;
    if(models) {
        models.forEach(m => console.log(m.name, m.supportedGenerationMethods));
    } else {
        console.log(data);
    }
  });
});

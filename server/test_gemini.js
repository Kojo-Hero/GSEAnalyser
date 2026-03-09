require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('Key present:', !!process.env.GEMINI_API_KEY);
console.log('Key preview:', process.env.GEMINI_API_KEY?.substring(0, 12) + '...');

// First test raw network connectivity
const https = require('https');
https.get('https://generativelanguage.googleapis.com', (res) => {
  console.log('✅ Network connectivity OK - HTTP status:', res.statusCode);
}).on('error', (e) => {
  console.error('❌ Network connectivity FAILED:', e.code, e.message);
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModels() {
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash'];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const r = await model.generateContent('Say: WORKING');
      console.log(`✅ ${m}: ${r.response.text().trim().substring(0, 60)}`);
    } catch (e) {
      console.log(`❌ ${m}:`);
      console.log('   message:', e.message);
      console.log('   status:', e.status);
      console.log('   cause:', e.cause?.code, e.cause?.message);
    }
  }
}

testModels().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

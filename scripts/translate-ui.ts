import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const TARGET_LANGUAGES = [
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'mr', name: 'Marathi' }
];

async function run() {
  const enFilePath = path.join(process.cwd(), 'src', 'locales', 'en.json');
  const enData = await fs.readFile(enFilePath, 'utf-8');

  for (const lang of TARGET_LANGUAGES) {
    console.log(`Translating to ${lang.name}...`);
    
    const prompt = `
      You are a professional medical UI translator. 
      Translate the following JSON values into ${lang.name}. 
      CRITICAL: Do NOT translate or change the JSON keys. Only translate the values.
      Return ONLY valid JSON, with no markdown formatting or backticks.
      
      JSON to translate:
      ${enData}
    `;

    try {
      const result = await model.generateContent(prompt);
      let responseText = result.response.text().trim();
      
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/^```json\n|\n```$/g, '');
      }

      const outPath = path.join(process.cwd(), 'src', 'locales', `${lang.code}.json`);
      await fs.writeFile(outPath, responseText, 'utf-8');
      console.log(`✅ Saved ${lang.code}.json`);
    } catch (error) {
      console.error(`❌ Failed translating ${lang.name}:`, error);
    }
  }
}

run();
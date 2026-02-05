// Test Gemini API Key
// Checks if the API key is configured and working

import { config } from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
config();

const API_KEY = process.env.VITE_GEMINI_API_KEY || '';

async function testGemini() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     🧪 Gemini API Key Test                            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Step 1: Check if key exists
  if (!API_KEY) {
    console.log('❌ API Key Status: NOT FOUND');
    console.log('\n📝 To fix:');
    console.log('   1. Create a .env file in the project root');
    console.log('   2. Add: VITE_GEMINI_API_KEY=your_key_here');
    console.log('   3. Get your key from: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  console.log('✅ API Key Status: FOUND');
  console.log(`   Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);

  // Step 2: Test API call
  console.log('\n🔍 Testing API connection...');

  try {
    const genAI = new GoogleGenAI({ apiKey: API_KEY });
    
    // Make a simple test request using the same method as the app
    const prompt = 'Say "API test successful" if you can read this.';
    
    console.log('   Sending test request...');
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    const text = response.text || 'No response';

    console.log('\n✅ API Test: SUCCESS');
    console.log(`   Response: ${text.trim()}`);
    console.log('\n🎉 Your Gemini API key is working correctly!');
    console.log('   The app can now use AI-powered agent intelligence.\n');

  } catch (error: any) {
    console.log('\n❌ API Test: FAILED');
    console.log(`   Error: ${error.message}`);
    
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
      console.log('\n💡 The API key appears to be invalid.');
      console.log('   - Check if the key is correct');
      console.log('   - Make sure there are no extra spaces');
      console.log('   - Verify the key is active at: https://aistudio.google.com/apikey');
    } else if (error.message?.includes('429') || error.message?.includes('quota')) {
      console.log('\n💡 API quota exceeded.');
      console.log('   - You may have hit the rate limit');
      console.log('   - Check your quota at: https://aistudio.google.com/apikey');
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      console.log('\n💡 Network error.');
      console.log('   - Check your internet connection');
      console.log('   - The API might be temporarily unavailable');
    } else {
      console.log('\n💡 Unknown error. Check the error message above.');
    }
    
    process.exit(1);
  }
}

// Run the test
testGemini().catch(console.error);

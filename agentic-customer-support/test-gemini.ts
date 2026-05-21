import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('Testing Gemini...');
  try {
    const { text } = await generateText({
      model: google('gemini-1.5-flash-latest'),
      prompt: 'Hello, how are you?',
    });
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error);
  }
}

test();

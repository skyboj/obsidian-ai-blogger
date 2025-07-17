import 'dotenv/config';
import { createAIManager } from './src/ai/index.js';
import { loadConfig } from './src/utils/config.js';

async function testAI() {
    try {
        console.log('🤖 Testing AI...');
        
        const config = await loadConfig();
        console.log('✅ Config loaded');
        
        const aiManager = createAIManager(config.ai);
        console.log('✅ AI Manager created');
        
        const result = await aiManager.generateContent('test', 'Напиши одно предложение о котиках');
        console.log('✅ AI Response:', result);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }
}

testAI(); 
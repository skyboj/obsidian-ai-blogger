import 'dotenv/config';
import { AIManager } from './src/ai/aiManager.js';
import { loadConfig } from './src/utils/config.js';

async function testAIDirect() {
    try {
        console.log('🤖 Testing AI Direct...');
        
        const config = await loadConfig();
        console.log('✅ Config loaded');
        
        const aiManager = new AIManager(config.ai);
        console.log('✅ AI Manager created');
        
        const result = await aiManager.generate('Напиши одно предложение о котиках');
        console.log('✅ AI Response:', result);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }
}

testAIDirect(); 
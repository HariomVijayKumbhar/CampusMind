// Automated integration test for CampusMind backend
const env = require('./config/env');
const rag = require('./services/ragService');
const supabase = require('./config/supabaseClient');

async function runTests() {
  console.log('==============================================');
  console.log('🚀 CampusMind End-to-End Verification Suite');
  console.log('==============================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Config & Environment
  try {
    console.log('1. Testing Environment Configuration...');
    if (!env.supabase.url || !env.supabase.serviceRoleKey) {
      throw new Error('Supabase credentials missing in env');
    }
    console.log(`   - AI Provider: ${env.aiProvider}`);
    console.log(`   - Supabase URL: ${env.supabase.url.substring(0, 25)}...`);
    console.log('   ✅ Environment config OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 1 Failed:', err.message, '\n');
    failed++;
  }

  // Test 2: Supabase Connection
  try {
    console.log('2. Testing Supabase Database Connectivity...');
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`   ✅ Supabase DB connected successfully (profiles table verified)\n`);
    passed++;
  } catch (err) {
    console.error('   ❌ Test 2 Failed:', err.message, '\n');
    failed++;
  }

  // Test 3: LLM Provider (OpenRouter)
  try {
    console.log('3. Testing LLM Integration via OpenRouter...');
    const answer = await rag.callLLM(
      'You are a testing assistant. Answer in one short sentence.',
      'What is CampusMind?'
    );
    console.log(`   - LLM Output: "${answer.trim()}"`);
    console.log('   ✅ LLM Integration OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 3 Failed:', err.message, '\n');
    failed++;
  }

  // Test 4: Embedding Service
  try {
    console.log('4. Testing Local Embedding Model (@xenova/transformers)...');
    const embeddingService = require('./services/embeddingService');
    const vec = await embeddingService.embedText('Testing vector embeddings');
    if (!Array.isArray(vec) || vec.length !== 384) {
      throw new Error(`Invalid vector dimensions: expected 384, got ${vec?.length}`);
    }
    console.log(`   - Vector generated: 384 dimensions`);
    console.log('   ✅ Embedding Service OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 4 Failed:', err.message, '\n');
    failed++;
  }

  // Test 5: RAG Pipeline with Fallback
  try {
    console.log('5. Testing RAG Pipeline with Fallback Handling...');
    const ragResult = await rag.generateAnswer('Tell me something not in documents', 'test-user');
    if (!ragResult || typeof ragResult.answer !== 'string') {
      throw new Error('Invalid RAG response structure');
    }
    console.log(`   - Fallback Flag: ${ragResult.usedFallback}`);
    console.log(`   - Answer: "${ragResult.answer.substring(0, 60)}..."`);
    console.log('   ✅ RAG Pipeline & Fallback OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 5 Failed:', err.message, '\n');
    failed++;
  }

  // Test 6: Text Splitter
  try {
    console.log('6. Testing Text Splitter...');
    const splitter = require('./utils/textSplitter');
    const ts = new splitter();
    const sampleText = 'This is paragraph 1.\n\nThis is paragraph 2 with more details.'.repeat(20);
    const chunks = ts.splitText(sampleText, 100, 20);
    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error('Splitter produced no chunks');
    }
    console.log(`   - Created ${chunks.length} chunks from sample text`);
    console.log('   ✅ Text Splitter OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 6 Failed:', err.message, '\n');
    failed++;
  }

  console.log('==============================================');
  console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
  console.log('==============================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().then(() => {
  setTimeout(() => process.exit(0), 500);
}).catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});

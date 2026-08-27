// Automated integration test for CampusMind backend
const env = require('./config/env');
const rag = require('./services/ragService');
const supabase = require('./config/supabaseClient');
const retrievalService = require('./services/retrievalService');
const rerankService = require('./services/rerankService');
const ragConfig = require('./config/rag');

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
    if (!env.groq.apiKey) {
      throw new Error('GROQ_API_KEY missing in env');
    }
    console.log(`   - AI Provider: Groq (${env.groq.model})`);
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

  // Test 3: Groq LLM Integration
  try {
    console.log('3. Testing Groq LLM Integration...');
    const { Groq } = require('groq-sdk');
    const groq = new Groq({ apiKey: env.groq.apiKey });
    const completion = await groq.chat.completions.create({
      model: env.groq.model,
      max_tokens: 64,
      messages: [
        { role: 'system', content: 'Answer in one short sentence.' },
        { role: 'user', content: 'What is CampusMind?' },
      ],
    });
    const answer = completion.choices?.[0]?.message?.content || '';
    console.log(`   - LLM Output: "${answer.trim()}"`);
    console.log('   ✅ Groq Integration OK\n');
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

  // Test 5: Hybrid Retrieval (semantic + keyword RPCs)
  try {
    console.log('5. Testing Hybrid Retrieval (pgvector + tsvector RPCs)...');
    const candidates = await retrievalService.hybridRetrieve('admission fees and hostel');
    if (!Array.isArray(candidates)) {
      throw new Error('hybridRetrieve did not return an array');
    }
    console.log(`   - Fused candidates: ${candidates.length} (top ${ragConfig.fusionTopK})`);
    if (candidates.length > 0) {
      const first = candidates[0];
      console.log(`   - Best candidate rrfScore: ${first.rrfScore?.toFixed(4)}`);
      console.log(`   - Best candidate document_title: ${first.document_title}`);
    }
    console.log('   ✅ Hybrid Retrieval OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 5 Failed:', err.message, '\n');
    failed++;
  }

  // Test 6: Re-ranking Score Parser (no network)
  try {
    console.log('6. Testing Re-ranking Score Parser...');
    const parsed = rerankService.parseScores('[8, 3, 10]', 3);
    if (JSON.stringify(parsed) !== JSON.stringify([8, 3, 10])) {
      throw new Error(`Unexpected parse result: ${JSON.stringify(parsed)}`);
    }
    const clamped = rerankService.parseScores('[15, -2, x]', 3);
    if (JSON.stringify(clamped) !== JSON.stringify([10, 0, 0])) {
      throw new Error(`Unexpected clamp result: ${JSON.stringify(clamped)}`);
    }
    console.log('   - Parses + clamps scores correctly');
    console.log('   ✅ Re-ranking Score Parser OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 6 Failed:', err.message, '\n');
    failed++;
  }

  // Test 7: RAG Pipeline with Fallback (offline path, no Groq answer call needed)
  try {
    console.log('7. Testing RAG Pipeline Fallback Handling...');
    const ragResult = await rag.generateAnswer('Tell me something not in documents', 'test-user');
    if (!ragResult || typeof ragResult.answer !== 'string') {
      throw new Error('Invalid RAG response structure');
    }
    console.log(`   - Fallback Flag: ${ragResult.usedFallback}`);
    console.log(`   - Confidence: ${ragResult.confidence}`);
    console.log(`   - Answer: "${ragResult.answer.substring(0, 60)}..."`);
    console.log('   ✅ RAG Pipeline & Fallback OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 7 Failed:', err.message, '\n');
    failed++;
  }

  // Test 8: Text Splitter
  try {
    console.log('8. Testing Text Splitter...');
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
    console.error('   ❌ Test 8 Failed:', err.message, '\n');
    failed++;
  }

  // Test 9: Source Highlighting Shape
  try {
    console.log('9. Testing Source Highlighting Shape...');
    const source = rag.buildSource(
      {
        content: 'The hostel fee is 5000 per semester. Payments are due by the 15th of each month.',
        document_title: 'Hostel Policy',
        relevanceScore: 8,
        similarity: 0.72,
      },
      1
    );
    if (!source.highlighted_span || typeof source.highlighted_span.start !== 'number') {
      throw new Error('highlighted_span missing or malformed');
    }
    if (source.highlighted_span.text.length === 0) {
      throw new Error('highlighted_span text is empty');
    }
    if (source.confidence !== 0.8) {
      throw new Error(`Expected confidence 0.8, got ${source.confidence}`);
    }
    console.log(`   - highlighted_span: "${source.highlighted_span.text.substring(0, 40)}..."`);
    console.log('   ✅ Source Highlighting Shape OK\n');
    passed++;
  } catch (err) {
    console.error('   ❌ Test 9 Failed:', err.message, '\n');
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

import { CacheManager } from './dist/cache/CacheManager.js';

async function testNewResolve() {
  console.log('🔧 새로운 resolveNestedKey 테스트...\n');

  const cacheManager = new CacheManager();

  const config = {
    sources: {
      b17_queries: {
        name: 'b17_queries',
        path: './B17R2010_query.json',
        primary: true
      }
    }
  };

  try {
    await cacheManager.loadAll(config);

    // 사용자 요청대로 테스트
    console.log('🎯 사용자 요청 테스트:');

    const tests = [
      { key: 'B17R2010.select', desc: 'b17. 접두사 없이 (원래 요청)' },
      { key: 'b17r2010.select', desc: '소문자로' },
      { key: 'B17R2010.L2N.select', desc: '다른 쿼리' },
      { key: 'b17.B17R2010.select', desc: 'b17. 접두사 포함' }
    ];

    for (const test of tests) {
      console.log(`\n테스트: ${test.desc}`);
      console.log(`키: "${test.key}"`);

      const result = cacheManager.query(test.key);

      if (result.found) {
        console.log(`✅ 찾음! 소스: ${result.source}`);
        console.log(`   ID: ${result.value.id}`);
        console.log(`   설명: ${result.value.desc}`);
      } else {
        console.log(`❌ 찾지 못함`);
      }
    }

  } catch (error) {
    console.error('❌ 실패:', error.message);
  }
}

testNewResolve().catch(console.error);
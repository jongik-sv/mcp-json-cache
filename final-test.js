import { CacheManager } from './dist/cache/CacheManager.js';

async function finalTest() {
  console.log('🎯 최종 테스트...\n');

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

    // 직접 CacheManager query 테스트
    console.log('📋 CacheManager query 테스트:');

    const tests = [
      'B17R2010.select',
      'b17r2010.select',
      'b17.B17R2010.select',
      'B17R2010.L2N.select'
    ];

    for (const key of tests) {
      console.log(`\n키: "${key}"`);
      const result = cacheManager.query(key);

      if (result.found) {
        console.log(`✅ 성공! 소스: ${result.source}`);
        console.log(`   ID: ${result.value.id}`);
        console.log(`   설명: ${result.value.desc.substring(0, 50)}...`);
      } else {
        console.log(`❌ 실패`);
      }
    }

    // 전체 키 목록에서 확인
    console.log('\n🔍 전체 키 확인:');
    const keys = cacheManager.listKeys();
    const testKeys = keys.filter(k => k.toLowerCase().includes('b17r2010.select'));
    console.log('B17R2010.select 관련 키들:');
    testKeys.forEach(k => console.log(`  - "${k}"`));

  } catch (error) {
    console.error('❌ 실패:', error.message);
    console.error(error.stack);
  }
}

finalTest().catch(console.error);
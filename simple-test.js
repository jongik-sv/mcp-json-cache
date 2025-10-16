import { CacheManager } from './dist/cache/CacheManager.js';

async function simpleTest() {
  console.log('🔍 간단한 테스트...\n');

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
    console.log('✅ 로드 성공');

    // 가장 단순한 키 테스트
    console.log('\n📦 단순 키 테스트:');
    const result1 = cacheManager.query('b17');
    console.log(`'b17' 키: ${result1.found ? '✅ 찾음' : '❌ 찾지 못함'}`);

    if (result1.found) {
      console.log('b17 데이터 타입:', typeof result1.value);
      console.log('b17 데이터 키:', Object.keys(result1.value));

      // 중첩 키 테스트
      console.log('\n🔗 중첩 키 테스트:');
      const result2 = cacheManager.query('b17.B17R2010.select');
      console.log(`'b17.B17R2010.select': ${result2.found ? '✅ 찾음' : '❌ 찾지 못함'}`);

      if (result2.found) {
        console.log('데이터 ID:', result2.value.id);
        console.log('데이터 설명:', result2.value.desc);
      }

      // 대소문자 테스트
      console.log('\n🔤 대소문자 테스트:');
      const result3 = cacheManager.query('b17.b17r2010.select');
      console.log(`'b17.b17r2010.select' (소문자): ${result3.found ? '✅ 찾음' : '❌ 찾지 못함'}`);

      // b17. 접두사 제거 테스트
      console.log('\n✂️ 접두사 제거 테스트:');
      const result4 = cacheManager.query('B17R2010.select');
      console.log(`'B17R2010.select' (b17. 제거): ${result4.found ? '✅ 찾음' : '❌ 찾지 못함'}`);
    }

  } catch (error) {
    console.error('❌ 실패:', error.message);
  }
}

simpleTest().catch(console.error);
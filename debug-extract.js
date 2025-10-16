import { CacheManager } from './dist/cache/CacheManager.js';

async function debugExtract() {
  console.log('🔍 extractKeys 디버깅...\n');

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

    const cache = cacheManager.getCache('b17_queries');
    if (!cache) {
      console.log('❌ 캐시를 찾을 수 없음');
      return;
    }

    const data = cache.clone();

    // extractKeys가 어떤 키를 추출하는지 확인
    console.log('📋 extractKeys 결과:');
    const keys = cache.keys();
    const b17Keys = keys.filter(k => k.toLowerCase().includes('b17r2010.select'));

    console.log('B17R2010.select 관련 키:');
    b17Keys.forEach(key => console.log(`  - "${key}"`));

    // 수동으로 extractKeys 로직 시뮬레이션
    console.log('\n🔧 수동 extractKeys 시뮬레이션:');

    function extractKeys(obj, prefix) {
      const result = [];

      if (obj === null || typeof obj !== 'object') {
        return result;
      }

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          result.push(fullKey);

          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            result.push(...extractKeys(obj[key], fullKey));
          }
        }
      }

      return result;
    }

    const manualKeys = extractKeys(data, '');
    const manualB17Keys = manualKeys.filter(k => k.toLowerCase().includes('b17r2010.select'));

    console.log('수동 추출 B17R2010.select 관련 키:');
    manualB17Keys.forEach(key => console.log(`  - "${key}"`));

    // 실제 데이터 구조 확인
    console.log('\n📊 실제 b17 객체 구조:');
    if (data.b17) {
      console.log('b17 객체 키:');
      Object.keys(data.b17).forEach(key => {
        console.log(`  - "${key}" (타입: ${typeof data.b17[key]})`);
        if (key.includes('B17R2010.select')) {
          console.log(`    ID: ${data.b17[key].id}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ 실패:', error.message);
  }
}

debugExtract().catch(console.error);
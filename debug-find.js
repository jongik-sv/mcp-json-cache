import { CacheManager } from './dist/cache/CacheManager.js';

async function debugFind() {
  console.log('🔍 array.find 디버깅...\n');

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

    const allKeys = cache.keys();
    console.log('전체 키 개수:', allKeys.length);

    // 찾으려는 키
    const searchKey = 'B17R2010.select';
    const keyWithPrefix = 'b17.' + searchKey;

    console.log(`\n찾으려는 키: "${keyWithPrefix}"`);

    // 대소문자 무시 비교 테스트
    console.log('\n🔍 대소문자 무시 비교:');
    allKeys.forEach(key => {
      const matches = key.toLowerCase() === keyWithPrefix.toLowerCase();
      if (matches || key.toLowerCase().includes('b17r2010.select')) {
        console.log(`  "${key}" → ${matches ? '✅ 일치' : '❌ 불일치'}`);
      }
    });

    // find 메소드 테스트
    console.log('\n🎯 find 메소드 테스트:');
    const foundKey = allKeys.find(k => k.toLowerCase() === keyWithPrefix.toLowerCase());
    console.log(`찾은 키: ${foundKey ? `"${foundKey}"` : '없음'}`);

    if (foundKey) {
      const result = cache.get(foundKey);
      console.log(`cache.get("${foundKey}") 결과:`, result ? '✅ 찾음' : '❌ 없음');
    }

  } catch (error) {
    console.error('❌ 실패:', error.message);
  }
}

debugFind().catch(console.error);
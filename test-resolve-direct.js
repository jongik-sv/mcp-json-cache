import { CacheManager } from './dist/cache/CacheManager.js';

async function testResolveDirect() {
  console.log('🔧 resolveNestedKey 직접 테스트...\n');

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

    // 직접 resolveNestedKey 테스트
    console.log('🔍 직접 키 접근 테스트:');

    // 1. 기본 접근
    console.log('1. data["b17"]:', data['b17'] ? '✅ 존재' : '❌ 없음');

    // 2. 중첩 접근
    const b17Data = data['b17'];
    console.log('2. b17Data["B17R2010.select"]:', b17Data['B17R2010.select'] ? '✅ 존재' : '❌ 없음');

    if (b17Data['B17R2010.select']) {
      console.log('   ID:', b17Data['B17R2010.select'].id);
    }

    // 3. 점진적 접근 시뮬레이션
    console.log('\n3. 점진적 접근 시뮬레이션:');
    const key = 'b17.B17R2010.select';
    const firstDot = key.indexOf('.');
    console.log(`   첫 번째 점 위치: ${firstDot}`);

    if (firstDot > 0) {
      const firstKey = key.substring(0, firstDot);
      const remainingKey = key.substring(firstDot + 1);
      console.log(`   firstKey: "${firstKey}"`);
      console.log(`   remainingKey: "${remainingKey}"`);

      const firstValue = data[firstKey];
      console.log(`   data[firstKey] 타입: ${typeof firstValue}`);
      console.log(`   data[firstKey] 객체: ${typeof firstValue === 'object'}`);

      if (firstValue && typeof firstValue === 'object') {
        const finalValue = firstValue[remainingKey];
        console.log(`   firstValue[remainingKey]:`, finalValue ? '✅ 찾음' : '❌ 없음');
        if (finalValue) {
          console.log(`   ID: ${finalValue.id}`);
        }
      }
    }

    // 4. 캐시 get 메소드 테스트
    console.log('\n4. 캐시 get 메소드 테스트:');
    const result1 = cache.get('b17.B17R2010.select');
    console.log('cache.get("b17.B17R2010.select"):', result1 ? '✅ 찾음' : '❌ 없음');

    const result2 = cache.get('B17R2010.select');
    console.log('cache.get("B17R2010.select"):', result2 ? '✅ 찾음' : '❌ 없음');

  } catch (error) {
    console.error('❌ 실패:', error.message);
    console.error(error.stack);
  }
}

testResolveDirect().catch(console.error);
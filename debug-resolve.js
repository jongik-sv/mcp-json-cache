import { CacheManager } from './dist/cache/CacheManager.js';

async function debugResolve() {
  console.log('🐛 resolveNestedKey 디버깅...\n');

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

    // 캐시 직접 접근
    const cache = cacheManager.getCache('b17_queries');
    if (!cache) {
      console.log('❌ 캐시를 찾을 수 없음');
      return;
    }

    // 데이터 직접 확인
    const data = cache.clone();
    console.log('📊 데이터 구조:');
    console.log('  b17 존재:', 'b17' in data);

    if ('b17' in data) {
      console.log('  b17 타입:', typeof data.b17);
      console.log('  b17.B17R2010.select 존재:', 'B17R2010.select' in data.b17);

      if ('B17R2010.select' in data.b17) {
        console.log('  ✅ 데이터는 실제로 존재함!');
        console.log('  B17R2010.select ID:', data.b17['B17R2010.select'].id);
      }
    }

    // 수동으로 resolveNestedKey 시뮬레이션
    console.log('\n🔧 수동 resolveNestedKey 테스트:');

    // 올바른 키 경로 테스트
    const correctKey = 'b17.B17R2010.select';
    const correctKeys = correctKey.split('.');
    console.log(`  올바른 키 "${correctKey}" 분할:`, correctKeys);

    let current = data;
    for (let i = 0; i < correctKeys.length; i++) {
      const keyPart = correctKeys[i];
      current = current[keyPart];
      if (current === undefined) {
        console.log(`    ❌ ${keyPart}에서 실패`);
        break;
      }
      if (i === correctKeys.length - 1) {
        console.log(`  ✅ 올바른 키 성공: ID=${current.id}`);
      }
    }

    // 사용자가 원하는 키 테스트
    const userKey = 'B17R2010.select';
    console.log(`\n  사용자 키 "${userKey}"로 테스트:`);
    const userKeyWithPrefix = 'b17.' + userKey;
    const userKeys = userKeyWithPrefix.split('.');
    console.log(`  사용자 키+접두사 "${userKeyWithPrefix}" 분할:`, userKeys);

    current = data;
    for (let i = 0; i < userKeys.length; i++) {
      const keyPart = userKeys[i];
      current = current[keyPart];
      if (current === undefined) {
        console.log(`    ❌ ${keyPart}에서 실패`);
        break;
      }
      if (i === userKeys.length - 1) {
        console.log(`  ✅ 사용자 키 성공: ID=${current.id}`);
      }
    }

    // b17.으로 시작하는 다른 키 테스트
    const key = 'b17.B17R2010.select';
    const keys = key.split('.');
    console.log(`\n  기존 키 "${key}" 분할:`, keys);

    current = data;
    console.log('  시작 데이터 타입:', typeof current);

    for (let i = 0; i < keys.length; i++) {
      const keyPart = keys[i];
      console.log(`  단계 ${i + 1}: keyPart = "${keyPart}"`);
      console.log(`    현재 타입: ${typeof current}`);
      console.log(`    현재가 객체: ${typeof current === 'object'}`);

      if (current === null || current === undefined) {
        console.log(`    ❌ ${keyPart}에서 null/undefined 발견`);
        break;
      }

      if (typeof current !== 'object') {
        console.log(`    ❌ ${keyPart}에서 객체가 아님`);
        break;
      }

      console.log(`    다음 키 존재: ${keyPart in current}`);
      current = current[keyPart];
      console.log(`    다음 값 타입: ${typeof current}`);

      if (i === keys.length - 1) {
        console.log(`  ✅ 최종 결과: ${current ? '찾음' : '찾지 못함'}`);
        if (current && current.id) {
          console.log(`  ID: ${current.id}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ 실패:', error.message);
  }
}

debugResolve().catch(console.error);
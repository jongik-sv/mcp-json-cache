// 테스트 스크립트: B17R2010.select 검색 기능 테스트
import { CacheManager } from './dist/cache/CacheManager.js';

async function testB17R2010Search() {
  console.log('🧪 B17R2010 검색 기능 테스트 시작...\n');

  const cacheManager = new CacheManager();

  // B17R2010_query.json 로드
  const config = {
    sources: {
      b17_queries: {
        name: 'b17_queries',
        path: './B17R2010_query.json',
        primary: true
      }
    },
    options: {
      autoReload: true,
      cacheSize: 1000,
      logLevel: 'info'
    }
  };

  try {
    await cacheManager.loadAll(config);
    console.log('✅ JSON 파일 로드 성공\n');

    // 테스트 케이스
    const testCases = [
      {
        name: '대소문자 구분 없이 정확한 키 검색',
        key: 'B17R2010.select'
      },
      {
        name: '대소문자 구분 없이 정확한 키 검색 (소문자)',
        key: 'b17r2010.select'
      },
      {
        name: 'b17. 접두사 없이 검색',
        key: 'B17R2010.select'
      },
      {
        name: 'b17. 접두사 없이 검색 (소문자)',
        key: 'b17r2010.select'
      },
      {
        name: '원래 키 형식으로 검색 (소문자 접두사)',
        key: 'b17.B17R2010.select'
      },
      {
        name: '다른 쿼리 테스트',
        key: 'B17R2010.L2N.select'
      },
      {
        name: 'b17. 접두사 없이 다른 쿼리 테스트',
        key: 'B17R2010.L2N.select'
      }
    ];

    console.log('🔍 검색 테스트 시작:\n');

    for (const testCase of testCases) {
      console.log(`테스트: ${testCase.name}`);
      console.log(`검색 키: "${testCase.key}"`);

      const result = cacheManager.query(testCase.key);

      if (result.found) {
        const queryData = result.value;
        console.log(`✅ 찾음! 소스: ${result.source}`);
        console.log(`   ID: ${queryData.id}`);
        console.log(`   설명: ${queryData.desc}`);
        console.log(`   파일: ${queryData.file_name}`);
      } else {
        console.log(`❌ 찾지 못함`);
      }

      console.log('---\n');
    }

    // 전체 키 목록 확인
    console.log('📋 전체 키 목록:');
    const keys = cacheManager.listKeys();
    keys.forEach(key => console.log(`  - ${key}`));

    // B17R2010 관련 키만 필터링
    console.log('\n🎯 B17R2010 관련 키:');
    const b17Keys = keys.filter(key => key.toLowerCase().includes('b17r2010'));
    b17Keys.forEach(key => console.log(`  - ${key}`));

    // 직접 쿼리 테스트
    console.log('\n🔍 직접 쿼리 테스트:');
    const directResult1 = cacheManager.query('b17.B17R2010.select');
    console.log(`'b17.B17R2010.select' 직접 쿼리: ${directResult1.found ? '✅ 찾음' : '❌ 찾지 못함'}`);

    const directResult2 = cacheManager.query('B17R2010.select');
    console.log(`'B17R2010.select' 직접 쿼리: ${directResult2.found ? '✅ 찾음' : '❌ 찾지 못함'}`);

    const directResult3 = cacheManager.query('b17.B17R2010.L2N.select');
    console.log(`'b17.B17R2010.L2N.select' 직접 쿼리: ${directResult3.found ? '✅ 찾음' : '❌ 찾지 못함'}`);

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

testB17R2010Search().catch(console.error);
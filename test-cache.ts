/**
 * 캐싱 기능 단독 테스트 스크립트
 * MCP 통합 없이 JsonCache와 CacheManager만 검증
 */

import { JsonCache } from './dist/cache/JsonCache.js';
import { CacheManager } from './dist/cache/CacheManager.js';

/**
 * JsonCache 단일 파일 테스트
 */
async function testJsonCache() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   JsonCache 단일 파일 테스트          ║');
  console.log('╚═══════════════════════════════════════╝\n');

  try {
    const cache = new JsonCache('queries', './examples/queries.json');

    console.log('📂 파일 로딩 중...');
    await cache.load();
    console.log('✅ 로드 완료!\n');

    // 통계 정보
    const stats = cache.getStats();
    console.log('📊 캐시 통계:');
    console.log(`  - 이름: ${stats.name}`);
    console.log(`  - 경로: ${stats.path}`);
    console.log(`  - 키 개수: ${stats.keys}`);
    console.log(`  - 파일 크기: ${Math.round(stats.size / 1024)}KB`);
    console.log(`  - 로드 시간: ${stats.loadedAt.toISOString()}`);
    console.log(`  - 조회 횟수: ${stats.hits}\n`);

    // 단순 키 조회
    console.log('🔍 단순 키 조회 (metadata):');
    const metadata = cache.get('metadata');
    console.log(JSON.stringify(metadata, null, 2));
    console.log('');

    // 중첩 키 조회
    console.log('🔍 중첩 키 조회 (b17.B17R2010.select.query):');
    const query = cache.get('b17.B17R2010.select.query');
    console.log(`  "${query}"`);
    console.log('');

    // 더 깊은 중첩 키 조회
    console.log('🔍 깊은 중첩 키 조회 (b17.B17R2010.select.description):');
    const description = cache.get('b17.B17R2010.select.description');
    console.log(`  "${description}"`);
    console.log('');

    // 존재하지 않는 키
    console.log('🔍 존재하지 않는 키 조회 (nonexistent):');
    const notFound = cache.get('nonexistent');
    console.log(`  결과: ${notFound === undefined ? 'undefined (정상)' : 'ERROR'}`);
    console.log('');

    // 키 목록 (일부만 표시)
    const allKeys = cache.keys();
    console.log(`📝 전체 키 목록 (총 ${allKeys.length}개, 처음 10개만 표시):`);
    allKeys.slice(0, 10).forEach(key => console.log(`  - ${key}`));
    console.log('');

    // 키 검색 테스트
    console.log('🔎 키 검색 (패턴: "select", contains 모드):');
    const searchResults = cache.search('select', 'contains');
    console.log(`  매칭 결과: ${searchResults.length}개`);
    searchResults.slice(0, 3).forEach(result => {
      console.log(`  - ${result.key}`);
    });
    console.log('');

    console.log('✅ JsonCache 테스트 완료!\n');
    return true;

  } catch (error) {
    console.error('❌ JsonCache 테스트 실패:', error);
    return false;
  }
}

/**
 * CacheManager 다중 소스 테스트
 */
async function testCacheManager() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   CacheManager 다중 소스 테스트       ║');
  console.log('╚═══════════════════════════════════════╝\n');

  try {
    const manager = new CacheManager();

    console.log('📂 다중 소스 로딩 중...');
    await manager.loadAll({
      sources: {
        queries: {
          name: 'queries',
          path: './examples/queries.json',
          primary: true
        },
        legacy: {
          name: 'legacy',
          path: './examples/legacy.json'
        },
        sample: {
          name: 'sample',
          path: './examples/sample1.json'
        }
      }
    });
    console.log('✅ 모든 소스 로드 완료!\n');

    // 소스 목록
    const sources = manager.listSources();
    console.log('📊 로드된 소스 목록:');
    sources.forEach(source => {
      console.log(`  - ${source.name}: ${source.keys}개 키, ${Math.round(source.size / 1024)}KB`);
    });
    console.log('');

    // Primary 소스 확인
    const primarySource = manager.getPrimarySource();
    console.log(`🎯 Primary 소스: ${primarySource}\n`);

    // 특정 소스에서 조회
    console.log('🔍 특정 소스 조회 (queries 소스에서 "metadata"):');
    const result1 = manager.query('metadata', 'queries');
    console.log(`  - Found: ${result1.found}`);
    console.log(`  - Source: ${result1.source}`);
    console.log(`  - Value:`, JSON.stringify(result1.value, null, 2));
    console.log('');

    // 전체 소스에서 조회 (primary 우선)
    console.log('🔍 전체 소스 조회 (소스 미지정):');
    const result2 = manager.query('b17.B17R2010.select.query');
    console.log(`  - Found: ${result2.found}`);
    console.log(`  - Source: ${result2.source}`);
    console.log(`  - Value: "${result2.value}"`);
    console.log('');

    // 키 목록 조회
    console.log('📝 전체 키 목록 (처음 15개):');
    const allKeys = manager.listKeys();
    allKeys.slice(0, 15).forEach(key => console.log(`  - ${key}`));
    console.log(`  ... 총 ${allKeys.length}개 키\n`);

    // 특정 소스의 키만 조회
    console.log('📝 특정 소스 키 목록 (queries, 처음 10개):');
    const queriesKeys = manager.listKeys('queries');
    queriesKeys.slice(0, 10).forEach(key => console.log(`  - ${key}`));
    console.log('');

    // prefix 필터링
    console.log('📝 Prefix 필터링 (b17로 시작하는 키):');
    const filteredKeys = manager.listKeys(undefined, 'b17');
    filteredKeys.forEach(key => console.log(`  - ${key}`));
    console.log('');

    // 전역 통계
    const globalStats = manager.getGlobalStats();
    console.log('📊 전역 통계:');
    console.log(`  - 전체 소스: ${globalStats.totalSources}`);
    console.log(`  - 로드된 소스: ${globalStats.loadedSources}`);
    console.log(`  - 전체 키: ${globalStats.totalKeys}`);
    console.log(`  - 전체 크기: ${Math.round(globalStats.totalSize / 1024)}KB`);
    console.log(`  - 총 조회 횟수: ${globalStats.totalHits}`);
    console.log(`  - 캐시 히트율: ${globalStats.cacheHitRate.toFixed(2)}%`);
    console.log(`  - 업타임: ${Math.round(globalStats.uptime)}초`);
    console.log('');

    // 메모리 사용량
    const memoryUsage = manager.getMemoryUsage();
    console.log(`💾 메모리 사용량: ${Math.round(memoryUsage / 1024)}KB\n`);

    // 성능 테스트 (1000번 조회)
    console.log('⚡ 성능 테스트 (1000번 조회):');
    const startTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      manager.query('b17.B17R2010.select.query');
    }
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`  - 총 소요 시간: ${duration}ms`);
    console.log(`  - 평균 응답 시간: ${(duration / 1000).toFixed(3)}ms`);
    console.log('');

    console.log('✅ CacheManager 테스트 완료!\n');
    return true;

  } catch (error) {
    console.error('❌ CacheManager 테스트 실패:', error);
    if (error instanceof Error) {
      console.error('  상세:', error.message);
      console.error('  스택:', error.stack);
    }
    return false;
  }
}

/**
 * 메인 테스트 실행
 */
async function main() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║                                               ║');
  console.log('║     MCP JSON Cache - 캐싱 기능 단독 테스트     ║');
  console.log('║                                               ║');
  console.log('╚═══════════════════════════════════════════════╝');

  const results = {
    jsonCache: false,
    cacheManager: false
  };

  // JsonCache 테스트
  results.jsonCache = await testJsonCache();

  // CacheManager 테스트
  results.cacheManager = await testCacheManager();

  // 최종 결과
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║          최종 테스트 결과             ║');
  console.log('╚═══════════════════════════════════════╝\n');
  console.log(`  JsonCache:     ${results.jsonCache ? '✅ 통과' : '❌ 실패'}`);
  console.log(`  CacheManager:  ${results.cacheManager ? '✅ 통과' : '❌ 실패'}`);
  console.log('');

  if (results.jsonCache && results.cacheManager) {
    console.log('🎉 모든 테스트 통과! 캐싱 기능이 정상 동작합니다.');
    console.log('📝 다음 단계: MCP 서버 통합 (src/index.ts, src/tools/)');
    process.exit(0);
  } else {
    console.log('⚠️  일부 테스트 실패. 위 로그를 확인해주세요.');
    process.exit(1);
  }
}

// 실행
main().catch(error => {
  console.error('\n❌ 치명적 오류:', error);
  process.exit(1);
});

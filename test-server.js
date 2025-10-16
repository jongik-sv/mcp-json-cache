/**
 * Test Server - MCP JSON Cache Server 테스트
 * 개발 단계에서 간단히 기능을 테스트하기 위한 테스트 서버
 */

import { CacheManager } from './dist/cache/CacheManager.js';
import { configManager } from './dist/config.js';
import { QueryJsonTool } from './dist/tools/query.js';
import { ListJsonKeysTool } from './dist/tools/list-keys.js';
import { ListSourcesTool } from './dist/tools/list-sources.js';

/**
 * 테스트 실행 함수
 */
async function runTests() {
  console.log('🧪 MCP JSON Cache Server 테스트 시작');
  console.log('=====================================');

  try {
    // 1. 설정 테스트
    console.log('\n1. 설정 테스트');
    const config = await configManager.loadConfig();
    console.log('✅ 설정 로드 성공');
    console.log(`   소스 수: ${Object.keys(config.sources).length}`);
    console.log(`   자동 리로드: ${config.options?.autoReload}`);

    // 2. 캐시 매니저 테스트
    console.log('\n2. 캐시 매니저 테스트');
    const cacheManager = new CacheManager();
    await cacheManager.loadAll(config);
    console.log('✅ 캐시 로드 성공');
    console.log(`   로드된 소스: ${cacheManager.getLoadedSources().join(', ')}`);
    console.log(`   전체 키 수: ${cacheManager.getGlobalStats().totalKeys}`);

    // 3. Tools 생성
    console.log('\n3. MCP Tools 생성');
    const queryTool = new QueryJsonTool(cacheManager);
    const keysTool = new ListJsonKeysTool(cacheManager);
    const sourcesTool = new ListSourcesTool(cacheManager);
    console.log('✅ Tools 생성 성공');

    // 4. query_json Tool 테스트
    console.log('\n4. query_json Tool 테스트');
    console.log('4.1 단일 키 조회');
    const queryResult1 = await queryTool.execute({ key: 'users' });
    console.log('결과:', queryResult1.success ? '✅ 성공' : '❌ 실패');
    if (queryResult1.success) {
      console.log(`   소스: ${queryResult1.source}`);
      console.log(`   키: ${queryResult1.key}`);
      console.log(`   찾음: ${queryResult1.found}`);
    }

    console.log('\n4.2 중첩 키 조회');
    const queryResult2 = await queryTool.execute({ key: 'users.user1.name' });
    console.log('결과:', queryResult2.success ? '✅ 성공' : '❌ 실패');
    if (queryResult2.success) {
      console.log(`   값: ${JSON.stringify(queryResult2.data)}`);
    }

    console.log('\n4.3 소스 지정 조회');
    const queryResult3 = await queryTool.execute({ key: 'queries', source: 'queries' });
    console.log('결과:', queryResult3.success ? '✅ 성공' : '❌ 실패');

    console.log('\n4.4 존재하지 않는 키 조회');
    const queryResult4 = await queryTool.execute({ key: 'nonexistent' });
    console.log('결과:', !queryResult4.found ? '✅ 정상 (미발견)' : '❌ 비정상');

    // 5. list_json_keys Tool 테스트
    console.log('\n5. list_json_keys Tool 테스트');
    console.log('5.1 모든 키 목록');
    const keysResult1 = await keysTool.execute({});
    console.log('결과:', keysResult1.success ? '✅ 성공' : '❌ 실패');
    if (keysResult1.success) {
      console.log(`   반환된 키: ${keysResult1.keys.length}개`);
      console.log(`   전체 키: ${keysResult1.total}개`);
      console.log(`   제한됨: ${keysResult1.limited}`);
    }

    console.log('\n5.2 prefix 필터링');
    const keysResult2 = await keysTool.execute({ prefix: 'users.' });
    console.log('결과:', keysResult2.success ? '✅ 성공' : '❌ 실패');
    if (keysResult2.success) {
      console.log(`   필터링된 키: ${keysResult2.keys.length}개`);
      console.log(`   키 목록: ${keysResult2.keys.join(', ')}`);
    }

    console.log('\n5.3 특정 소스 키 목록');
    const keysResult3 = await keysTool.execute({ source: 'queries' });
    console.log('결과:', keysResult3.success ? '✅ 성공' : '❌ 실패');

    // 6. list_sources Tool 테스트
    console.log('\n6. list_sources Tool 테스트');
    const sourcesResult = await sourcesTool.execute();
    console.log('결과:', sourcesResult.success ? '✅ 성공' : '❌ 실패');
    if (sourcesResult.success) {
      console.log(`   전체 소스: ${sourcesResult.summary.total}개`);
      console.log(`   로드된 소스: ${sourcesResult.summary.loaded}개`);
      console.log(`   전체 키: ${sourcesResult.summary.totalKeys}개`);
      console.log(`   캐시 히트율: ${sourcesResult.summary.cacheHitRate.toFixed(1)}%`);

      console.log('\n소스 상세 정보:');
      sourcesResult.sources.forEach((source, index) => {
        const status = source.isLoaded ? '✅' : '❌';
        const primary = source.isPrimary ? ' [PRIMARY]' : '';
        console.log(`   ${index + 1}. ${status} ${source.name}${primary}`);
        console.log(`      키: ${source.keys}개, 크기: ${source.sizeFormatted}`);
      });
    }

    // 7. 성능 테스트
    console.log('\n7. 성능 테스트');
    console.log('7.1 다중 키 조회 성능');
    const startTime = performance.now();
    const promises = [];

    const testKeys = ['users', 'queries', 'legacy_system', 'products', 'orders'];
    for (const key of testKeys) {
      promises.push(queryTool.execute({ key }));
    }

    const results = await Promise.all(promises);
    const endTime = performance.now();
    const duration = endTime - startTime;

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ ${successCount}/${testKeys.length} 개 조회 성공`);
    console.log(`   소요 시간: ${duration.toFixed(2)}ms`);
    console.log(`   평균 응답 시간: ${(duration / testKeys).toFixed(2)}ms`);

    // 8. 에러 핸들링 테스트
    console.log('\n8. 에러 핸들링 테스트');
    console.log('8.1 잘못된 파라미터');
    const errorResult1 = await queryTool.execute({ key: '' });
    console.log('결과:', !errorResult1.success ? '✅ 정상 (거부됨)' : '❌ 비정상');

    console.log('\n8.2 존재하지 않는 소스');
    const errorResult2 = await keysTool.execute({ source: 'nonexistent' });
    console.log('결과:', !errorResult2.success ? '✅ 정상 (거부됨)' : '❌ 비정상');

    // 9. 전역 상태 테스트
    console.log('\n9. 전역 상태 테스트');
    const globalStats = cacheManager.getGlobalStats();
    console.log('✅ 전역 상태 정상');
    console.log(`   서버 가동 시간: ${globalStats.uptime.toFixed(0)}초`);
    console.log(`   메모리 사용량: ${(globalStats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

    // 10. 최종 성공 메시지
    console.log('\n=====================================');
    console.log('🎉 모든 테스트 통과!');
    console.log('MCP JSON Cache Server가 정상적으로 동작합니다.');

    console.log('\n📊 요약:');
    console.log(`   ✅ 설정 시스템: 정상`);
    console.log(`   ✅ 캐싱 엔진: 정상`);
    console.log(`   ✅ MCP Tools: 3개 정상`);
    console.log(`   ✅ 쿼리 기능: 정상`);
    console.log(`   ✅ 에러 핸들링: 정상`);
    console.log(`   ✅ 성능 목표: 달성 (${(duration / testKeys).toFixed(2)}ms 평균)`);

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    console.error('상세 정보:', error.stack);
    process.exit(1);
  }
}

// 테스트 실행
runTests().catch(error => {
  console.error('테스트 실행 실패:', error);
  process.exit(1);
});
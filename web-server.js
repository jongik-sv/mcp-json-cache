#!/usr/bin/env node

/**
 * 웹 서버 전용 실행 스크립트
 * MCP 프로토콜 없이 순수 웹 UI만 제공
 */

import { CacheManager } from './dist/cache/CacheManager.js';
import { configManager } from './dist/config.js';
import { WebServer } from './dist/web/server.js';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startWebServer() {
    console.log('🌐 MCP JSON Cache 웹 서버 시작');
    console.log('================================');

    try {
        // 환경변수 설정
        process.env.JSON_SOURCES = 'b17:B17R2010_query.json';
        process.env.WEB_ENABLED = 'true';
        process.env.WEB_PORT = '6315';
        process.env.WEB_HOST = 'localhost';

        // 설정 로드
        const config = await configManager.loadConfig();
        console.log('✅ 설정 로드 완료');
        console.log('📁 JSON 소스:', Object.keys(config.sources));

        // 캐시 매니저 생성 및 데이터 로드
        const cacheManager = new CacheManager();
        await cacheManager.loadAll(config);

        const stats = cacheManager.getGlobalStats();
        console.log('✅ 캐시 로드 완료');
        console.log(`   로드된 소스: ${cacheManager.getLoadedSources().join(', ')}`);
        console.log(`   전체 키: ${stats.totalKeys}개`);
        console.log(`   데이터 크기: ${Math.round(stats.totalSize / 1024)}KB`);

        // 웹 서버 설정
        const webConfig = {
            enabled: true,
            port: 6315,
            host: 'localhost'
        };

        // 웹 서버 생성 및 시작
        const webServer = new WebServer(cacheManager, webConfig);
        await webServer.start();

        console.log('================================');
        console.log('🎉 웹 서버 시작 성공!');
        console.log(`📱 주소: http://${webConfig.host}:${webConfig.port}`);
        console.log('🔧 API 엔드포인트:');
        console.log('   GET  /api/sources  - 소스 목록');
        console.log('   GET  /api/keys     - 키 목록');
        console.log('   GET  /api/query    - 데이터 조회');
        console.log('   GET  /api/stats    - 통계 정보');
        console.log('   GET  /api/health   - 상태 확인');
        console.log('================================');
        console.log('🛑 종료하려면 Ctrl+C를 누르세요');

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 웹 서버 종료 중...');
            await webServer.shutdown();
            cacheManager.shutdown();
            console.log('✅ 종료 완료');
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\n🛑 웹 서버 종료 중...');
            await webServer.shutdown();
            cacheManager.shutdown();
            console.log('✅ 종료 완료');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ 웹 서버 시작 실패:', error.message);
        console.error('상세 정보:', error.stack);
        process.exit(1);
    }
}

// 웹 서버 시작
startWebServer();
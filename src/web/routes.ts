/**
 * REST API Routes
 * 웹 관리 UI를 위한 REST API 엔드포인트
 */

import { Express, Request, Response } from 'express';
import { CacheManager } from '../cache/CacheManager.js';
import { logger } from '../utils/logger.js';
import { ApiResponse } from '../types.js';

const routeLogger = logger.withSource('API_ROUTES');

/**
 * 라우트 설정
 */
export function setupRoutes(app: Express, cacheManager: CacheManager): void {

  // GET /api/sources - 소스 목록 및 통계
  app.get('/api/sources', async (req: Request, res: Response) => {
    try {
      const sources = cacheManager.getLoadedSources();
      const stats = sources.map(sourceName => {
        const sourceStats = cacheManager.getSourceStats(sourceName);
        return sourceStats;
      });

      const response: ApiResponse = {
        success: true,
        data: {
          sources: stats,
          total: stats.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      routeLogger.error('소스 목록 조회 실패', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/sources/:name - 특정 소스 상세
  app.get('/api/sources/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const stats = cacheManager.getSourceStats(name);

      if (!stats) {
        return res.status(404).json({
          success: false,
          error: `소스를 찾을 수 없습니다: ${name}`,
          timestamp: new Date().toISOString()
        });
      }

      const response: ApiResponse = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      routeLogger.error('소스 상세 조회 실패', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/keys - 키 목록 (source, prefix, search, maxDepth 쿼리)
  app.get('/api/keys', async (req: Request, res: Response) => {
    try {
      const source = req.query.source as string | undefined;
      const prefix = req.query.prefix as string | undefined;
      const search = req.query.search as string | undefined; // 새로운 검색 파라미터
      const limit = parseInt(req.query.limit as string) || 500;
      const maxDepth = req.query.maxDepth ? parseInt(req.query.maxDepth as string) : cacheManager.getDefaultMaxDepth();

      let keys: string[] = [];

      if (source) {
        // 특정 소스의 키 목록 - 첫 번째 레벨 키만 반환 (maxDepth=0)
        const sourceKeys = cacheManager.getKeys(source, undefined, 0);

        if (search) {
          // 검색어로 필터링 (b17/b47 접두사 자동 처리)
          keys = sourceKeys.filter(key => {
            const keyLower = key.toLowerCase();
            const searchLower = search.toLowerCase();

            // 정확히 일치하는 검색어는 제외 (하위 키만 표시)
            if (keyLower === searchLower) return false;

            // 검색어로 시작하되 검색어 자체는 제외
            if (keyLower.startsWith(searchLower + '.')) return true;

            // 검색어 포함
            if (keyLower.includes(searchLower)) return true;

            // b17. 접두사 자동 처리
            if (!searchLower.startsWith('b17.') && !searchLower.startsWith('b47.')) {
              const withB17 = 'b17.' + searchLower;
              const withB47 = 'b47.' + searchLower;
              if (keyLower === withB17 || keyLower === withB47) return false;
              if (keyLower.startsWith(withB17 + '.') || keyLower.startsWith(withB47 + '.')) return true;
              if (keyLower.includes(withB17) || keyLower.includes(withB47)) return true;
            }

            // b17. 접두사 제거하고 비교
            if ((searchLower.startsWith('b17.') || searchLower.startsWith('b47.'))) {
              const withoutPrefix = searchLower.substring(4);
              if (keyLower === withoutPrefix) return false;
              if (keyLower.startsWith(withoutPrefix + '.')) return true;
              if (keyLower.includes(withoutPrefix)) return true;
            }

            return false;
          });
        } else if (prefix) {
          // 기존 prefix 필터링 - 접두사 자체만 허용하고 하위 키는 제외
          keys = sourceKeys.filter(key => key === prefix);
        } else {
          keys = sourceKeys;
        }
      } else {
        // 전체 소스의 키 목록
        const sources = cacheManager.getLoadedSources();
        const allKeys = new Set<string>();

        sources.forEach(sourceName => {
          // 첫 번째 레벨 키만 반환 (maxDepth=0)
          const sourceKeys = cacheManager.getKeys(sourceName, undefined, 0);

          if (search) {
            // 검색어로 필터링
            const filteredKeys = sourceKeys.filter(key => {
              const keyLower = key.toLowerCase();
              const searchLower = search.toLowerCase();

              // 정확히 일치하는 검색어는 제외 (하위 키만 표시)
              if (keyLower === searchLower) return false;

              // 검색어로 시작하되 검색어 자체는 제외
              if (keyLower.startsWith(searchLower + '.')) return true;

              // 검색어 포함
              if (keyLower.includes(searchLower)) return true;

              // b17. 접두사 자동 처리
              if (!searchLower.startsWith('b17.') && !searchLower.startsWith('b47.')) {
                const withB17 = 'b17.' + searchLower;
                const withB47 = 'b47.' + searchLower;
                if (keyLower === withB17 || keyLower === withB47) return false;
                if (keyLower.startsWith(withB17 + '.') || keyLower.startsWith(withB47 + '.')) return true;
                if (keyLower.includes(withB17) || keyLower.includes(withB47)) return true;
              }

              // b17. 접두사 제거하고 비교
              if ((searchLower.startsWith('b17.') || searchLower.startsWith('b47.'))) {
                const withoutPrefix = searchLower.substring(4);
                if (keyLower === withoutPrefix) return false;
                if (keyLower.startsWith(withoutPrefix + '.')) return true;
                if (keyLower.includes(withoutPrefix)) return true;
              }

              return false;
            });
            filteredKeys.forEach(key => allKeys.add(key));
          } else if (prefix) {
            // 기존 prefix 필터링 - 접두사 자체만 허용하고 하위 키는 제외
            sourceKeys.filter(key => key === prefix).forEach(key => allKeys.add(key));
          } else {
            // 모든 키
            sourceKeys.forEach(key => allKeys.add(key));
          }
        });

        keys = Array.from(allKeys).sort();
      }

      // 결과 제한
      const limited = keys.slice(0, limit);
      const hasMore = keys.length > limit;

      const response: ApiResponse = {
        success: true,
        data: {
          source,
          prefix: search || prefix, // search를 우선순위로
          keys: limited,
          total: keys.length,
          returned: limited.length,
          hasMore,
          searchType: search ? 'fuzzy' : (prefix ? 'prefix' : 'all')
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      routeLogger.error('키 목록 조회 실패', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/query - 키 조회 (key, source 쿼리)
  app.get('/api/query', async (req: Request, res: Response) => {
    try {
      const key = req.query.key as string;
      const source = req.query.source as string | undefined;

      if (!key) {
        return res.status(400).json({
          success: false,
          error: 'key 파라미터가 필요합니다',
          timestamp: new Date().toISOString()
        });
      }

      let result;

      if (source) {
        // 특정 소스에서 조회
        result = cacheManager.query(key, source);
      } else {
        // 전체 소스에서 검색
        result = cacheManager.queryAll(key);
      }

      if (!result.found) {
        return res.status(404).json({
          success: false,
          error: `키를 찾을 수 없습니다: ${key}`,
          data: {
            key,
            source,
            availableSources: cacheManager.getLoadedSources()
          },
          timestamp: new Date().toISOString()
        });
      }

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      routeLogger.error('키 조회 실패', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/reload/:name - 소스 리로드
  app.post('/api/reload/:name', async (req: Request, res: Response) => {
    try {
      const { name } = req.params;

      const startTime = Date.now();
      await cacheManager.reloadSource(name);
      const duration = Date.now() - startTime;

      const stats = cacheManager.getSourceStats(name);

      const response: ApiResponse = {
        success: true,
        data: {
          source: name,
          duration,
          stats
        },
        timestamp: new Date().toISOString()
      };

      routeLogger.info('소스 리로드 완료', { source: name, duration });
      res.json(response);

    } catch (error) {
      routeLogger.error('소스 리로드 실패', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/reload-all - 전체 리로드
  app.post('/api/reload-all', async (req: Request, res: Response) => {
    try {
      const sources = cacheManager.getLoadedSources();
      const results = [];

      const startTime = Date.now();

      for (const source of sources) {
        try {
          await cacheManager.reloadSource(source);
          results.push({
            source,
            success: true
          });
        } catch (error) {
          results.push({
            source,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      const response: ApiResponse = {
        success: true,
        data: {
          total: sources.length,
          success: successCount,
          failed: sources.length - successCount,
          duration,
          results
        },
        timestamp: new Date().toISOString()
      };

      routeLogger.info('전체 리로드 완료', {
        total: sources.length,
        success: successCount,
        duration
      });

      res.json(response);

    } catch (error) {
      routeLogger.error('전체 리로드 실패', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/stats - 전체 통계
  app.get('/api/stats', async (req: Request, res: Response) => {
    try {
      const globalStats = cacheManager.getGlobalStats();

      const response: ApiResponse = {
        success: true,
        data: globalStats,
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error) {
      routeLogger.error('통계 조회 실패', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      timestamp: new Date().toISOString()
    });
  });
}

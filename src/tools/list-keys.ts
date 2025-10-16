/**
 * list_json_keys Tool - 키 목록 조회 Tool
 * 캐시된 JSON 데이터의 키 목록을 반환 (소스별 필터링 및 prefix 검색 지원)
 */

import { CacheManager } from '../cache/CacheManager.js';
import { logger } from '../utils/logger.js';
import { withGracefulDegradation } from '../utils/errors.js';

export interface ListJsonKeysParams {
  source?: string;
  prefix?: string;
  limit?: number;
  maxDepth?: number;
}

export interface ListJsonKeysResult {
  success: boolean;
  keys: string[];
  total: number;
  source?: string;
  prefix?: string;
  limited: boolean;
  availableSources: string[];
  message?: string;
}

export class ListJsonKeysTool {
  private cacheManager: CacheManager;
  private sourceLogger = logger.withSource('list_json_keys');
  private readonly DEFAULT_LIMIT = 500;
  private readonly MAX_LIMIT = 1000;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Tool 스키마 정의
   */
  public getSchema() {
    return {
      name: "list_json_keys",
      description: "JSON 캐시의 키 목록 조회. 소스별 필터링, prefix 검색, 개수 제한, 깊이 제한을 지원합니다.",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "특정 소스의 키만 조회 (미지정 시 모든 소스의 키 조회)"
          },
          prefix: {
            type: "string",
            description: "특정 접두사로 키 필터링 (예: 'user.', 'config.')"
          },
          limit: {
            type: "number",
            description: "반환할 키의 최대 개수 (기본값: 500, 최대: 1000)"
          },
          maxDepth: {
            type: "number",
            description: "키 추출 최대 깊이 (기본값: 2, 예: 2면 'b17.B17R2010.select'까지만 추출)"
          }
        }
      }
    };
  }

  /**
   * 키 목록 조회 실행
   */
  public async execute(params: ListJsonKeysParams): Promise<ListJsonKeysResult> {
    const { source, prefix, limit, maxDepth = this.cacheManager.getDefaultMaxDepth() } = params;

    this.sourceLogger.debug('키 목록 조회 시작', { source, prefix, limit, maxDepth });

    try {
      // 파라미터 검증
      const validationResult = this.validateParams(params);
      if (!validationResult.valid) {
        return {
          success: false,
          keys: [],
          total: 0,
          limited: false,
          availableSources: this.getAvailableSources(),
          message: validationResult.message
        };
      }

      // 캐시 상태 확인
      if (!this.cacheManager.isLoaded()) {
        return {
          success: false,
          keys: [],
          total: 0,
          limited: false,
          availableSources: [],
          message: '캐시가 로드되지 않았습니다'
        };
      }

      // 유효한 limit 값 설정
      const effectiveLimit = this.calculateEffectiveLimit(limit);

      // 키 목록 조회 (성능 최적화)
      const keys = this.getKeysOptimized(source, prefix, effectiveLimit, maxDepth);

      const limited = keys.length >= effectiveLimit;
      const total = this.getTotalKeyCount(source, prefix, maxDepth);

      this.sourceLogger.debug('키 목록 조회 완료', {
        source,
        prefix,
        returned: keys.length,
        total,
        limited
      });

      return {
        success: true,
        keys,
        total,
        source,
        prefix,
        limited,
        availableSources: this.getAvailableSources()
      };

    } catch (error) {
      this.sourceLogger.error('키 목록 조회 중 오류', error);
      return {
        success: false,
        keys: [],
        total: 0,
        limited: false,
        availableSources: this.getAvailableSources(),
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 성능 최적화된 키 목록 조회
   */
  private getKeysOptimized(source: string | undefined, prefix: string | undefined, limit: number, maxDepth?: number): string[] {
    const startTime = performance.now();

    let keys: string[] = [];

    if (source) {
      // 특정 소스의 키만 조회
      const cache = this.cacheManager.getCache(source);
      if (cache && cache.isLoaded()) {
        keys = cache.keys(maxDepth);
      }
    } else {
      // 모든 소스의 키 조회 (중복 제거)
      const keySet = new Set<string>();
      const allCaches = this.cacheManager.getAllCaches();

      for (const cache of allCaches.values()) {
        if (cache.isLoaded()) {
          cache.keys(maxDepth).forEach(key => keySet.add(key));
        }
      }

      keys = Array.from(keySet);
    }

    // prefix 필터링
    if (prefix) {
      keys = keys.filter(key => key.startsWith(prefix));
    }

    // 정렬 (사전순)
    keys.sort();

    // 개수 제한
    const limitedKeys = keys.slice(0, limit);

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.sourceLogger.performance('list_json_keys_optimized', duration, {
      source,
      prefix,
      beforeLimit: keys.length,
      afterLimit: limitedKeys.length,
      limit
    });

    return limitedKeys;
  }

  /**
   * 전체 키 개수 계산 (limit 제한 없음)
   */
  private getTotalKeyCount(source: string | undefined, prefix: string | undefined, maxDepth?: number): number {
    let total = 0;

    if (source) {
      const cache = this.cacheManager.getCache(source);
      if (cache && cache.isLoaded()) {
        const keys = cache.keys(maxDepth);
        total = prefix ? keys.filter(key => key.startsWith(prefix)).length : keys.length;
      }
    } else {
      const allCaches = this.cacheManager.getAllCaches();
      const keySet = new Set<string>();

      for (const cache of allCaches.values()) {
        if (cache.isLoaded()) {
          cache.keys(maxDepth).forEach(key => {
            if (!prefix || key.startsWith(prefix)) {
              keySet.add(key);
            }
          });
        }
      }

      total = keySet.size;
    }

    return total;
  }

  /**
   * 유효한 limit 값 계산
   */
  private calculateEffectiveLimit(limit?: number): number {
    if (limit === undefined || limit === null) {
      return this.DEFAULT_LIMIT;
    }

    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1) {
      this.sourceLogger.warn(`유효하지 않은 limit 값: ${limit}, 기본값 사용`);
      return this.DEFAULT_LIMIT;
    }

    return Math.min(limit, this.MAX_LIMIT);
  }

  /**
   * 파라미터 검증
   */
  private validateParams(params: ListJsonKeysParams): { valid: boolean; message?: string } {
    const { source, prefix, limit } = params;

    // source 검증
    if (source !== undefined) {
      if (typeof source !== 'string') {
        return {
          valid: false,
          message: 'source는 문자열이어야 합니다'
        };
      }

      if (source.trim() === '') {
        return {
          valid: false,
          message: 'source는 비어있지 않은 문자열이어야 합니다'
        };
      }

      if (source.length > 100) {
        return {
          valid: false,
          message: 'source 길이가 너무 깁니다 (최대 100자)'
        };
      }

      // 소스 존재 확인
      const cache = this.cacheManager.getCache(source);
      if (!cache) {
        return {
          valid: false,
          message: `소스 '${source}'를 찾을 수 없습니다`
        };
      }
    }

    // prefix 검증
    if (prefix !== undefined) {
      if (typeof prefix !== 'string') {
        return {
          valid: false,
          message: 'prefix는 문자열이어야 합니다'
        };
      }

      if (prefix.length > 200) {
        return {
          valid: false,
          message: 'prefix 길이가 너무 깁니다 (최대 200자)'
        };
      }
    }

    // limit 검증
    if (limit !== undefined) {
      if (typeof limit !== 'number' || !Number.isInteger(limit)) {
        return {
          valid: false,
          message: 'limit는 정수여야 합니다'
        };
      }

      if (limit < 1) {
        return {
          valid: false,
          message: 'limit는 1 이상이어야 합니다'
        };
      }

      if (limit > this.MAX_LIMIT) {
        return {
          valid: false,
          message: `limit는 ${this.MAX_LIMIT} 이하여야 합니다`
        };
      }
    }

    return { valid: true };
  }

  /**
   * 사용 가능한 소스 목록 반환
   */
  private getAvailableSources(): string[] {
    return this.cacheManager.getLoadedSources();
  }

  /**
   * 키 검색 기능 (고급)
   */
  public async searchKeys(params: ListJsonKeysParams & { pattern: string }): Promise<ListJsonKeysResult & { matches: string[] }> {
    const { source, prefix, limit, pattern } = params;

    this.sourceLogger.debug('키 검색 시작', { source, prefix, limit, pattern });

    try {
      // 기본 키 목록 조회
      const baseResult = await this.execute({ source, prefix, limit });

      if (!baseResult.success) {
        return {
          ...baseResult,
          matches: []
        };
      }

      // 패턴 검색 (대소문자 무시)
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matches = baseResult.keys.filter(key => regex.test(key));

      this.sourceLogger.debug('키 검색 완료', {
        pattern,
        totalKeys: baseResult.keys.length,
        matches: matches.length
      });

      return {
        ...baseResult,
        matches
      };

    } catch (error) {
      this.sourceLogger.error('키 검색 중 오류', error);
      return {
        success: false,
        keys: [],
        matches: [],
        total: 0,
        limited: false,
        availableSources: this.getAvailableSources(),
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 통계 정보 반환
   */
  public getStats() {
    const allCaches = this.cacheManager.getAllCaches();
    let totalKeys = 0;
    let loadedSources = 0;

    for (const cache of allCaches.values()) {
      if (cache.isLoaded()) {
        totalKeys += cache.getStats().keys;
        loadedSources++;
      }
    }

    return {
      totalSources: allCaches.size,
      loadedSources,
      totalKeys,
      averageKeysPerSource: loadedSources > 0 ? Math.round(totalKeys / loadedSources) : 0,
      defaultLimit: this.DEFAULT_LIMIT,
      maxLimit: this.MAX_LIMIT
    };
  }

  /**
   * 성능 측정을 포함한 키 목록 조회
   */
  public async executeWithMetrics(params: ListJsonKeysParams): Promise<ListJsonKeysResult & { metrics: any }> {
    const startTime = performance.now();

    const result = await this.execute(params);

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.sourceLogger.performance('list_json_keys', duration, {
      source: params.source,
      prefix: params.prefix,
      returnedKeys: result.keys.length,
      totalKeys: result.total
    });

    return {
      ...result,
      metrics: {
        duration: Math.round(duration * 100) / 100,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Tool 팩토리 함수
 */
export function createListJsonKeysTool(cacheManager: CacheManager): ListJsonKeysTool {
  return new ListJsonKeysTool(cacheManager);
}
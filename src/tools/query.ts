/**
 * query_json Tool - JSON 데이터 조회 Tool
 * 캐시된 JSON 데이터에서 키로 데이터 조회 (중첩 키 지원)
 */

import { CacheManager } from '../cache/CacheManager.js';
import { logger } from '../utils/logger.js';
import { withGracefulDegradation } from '../utils/errors.js';

export interface QueryJsonParams {
  key: string;
  source?: string;
  jsonpath?: string;
}

export interface QueryJsonResult {
  success: boolean;
  data?: any;
  source?: string;
  key: string;
  found: boolean;
  message?: string;
  availableSources?: string[];
}

export class QueryJsonTool {
  private cacheManager: CacheManager;
  private sourceLogger = logger.withSource('query_json');

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Tool 스키마 정의
   */
  public getSchema() {
    return {
      name: "query_json",
      description: "JSON 캐시에서 키로 데이터 조회. 여러 JSON 소스를 동시에 관리하며 키값으로 빠르게 검색합니다. 중첩 키 접근(예: user.profile.name)과 JSONPath 쿼리를 지원합니다.",
      inputSchema: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "조회할 키 (중첩 키는 dot notation: user.profile.name)"
          },
          source: {
            type: "string",
            description: "JSON 소스명 (미지정 시 모든 소스 검색, primary 소스 우선)"
          },
          jsonpath: {
            type: "string",
            description: "JSONPath 쿼리 (선택, 복잡한 데이터 필터링용)"
          }
        },
        required: ["key"]
      }
    };
  }

  /**
   * 쿼리 실행
   */
  public async execute(params: QueryJsonParams): Promise<QueryJsonResult> {
    const { key, source, jsonpath } = params;

    this.sourceLogger.debug('쿼리 실행 시작', { key, source, jsonpath });

    try {
      // 파라미터 검증
      const validationResult = this.validateParams(params);
      if (!validationResult.valid) {
        return {
          success: false,
          key,
          found: false,
          message: validationResult.message,
          availableSources: this.getAvailableSources()
        };
      }

      // JSONPath 쿼리인 경우 별도 처리
      if (jsonpath) {
        return await this.executeJsonPathQuery(key, source, jsonpath);
      }

      // 일반 키 조회
      const queryResult = this.cacheManager.query(key, source);

      this.sourceLogger.debug('쿼리 결과', {
        key,
        source: queryResult.source,
        found: queryResult.found,
        valueType: typeof queryResult.value
      });

      // 결과 포맷팅
      if (queryResult.found) {
        return {
          success: true,
          data: this.formatValue(queryResult.value),
          source: queryResult.source,
          key,
          found: true
        };
      } else {
        return {
          success: false,
          key,
          found: false,
          message: `키 '${key}'를 찾을 수 없습니다`,
          source: queryResult.source,
          availableSources: this.getAvailableSources()
        };
      }

    } catch (error) {
      this.sourceLogger.error('쿼리 실행 중 오류', error);
      return {
        success: false,
        key,
        found: false,
        message: error instanceof Error ? error.message : String(error),
        availableSources: this.getAvailableSources()
      };
    }
  }

  /**
   * JSONPath 쿼리 실행
   */
  private async executeJsonPathQuery(
    key: string,
    source: string | undefined,
    jsonpath: string
  ): Promise<QueryJsonResult> {
    try {
      // JSONPath 라이브러리 동적 import
      const { JSONPath } = await import('jsonpath-plus');

      // 먼저 키로 데이터 조회
      const queryResult = this.cacheManager.query(key, source);

      if (!queryResult.found) {
        return {
          success: false,
          key,
          found: false,
          message: `키 '${key}'를 찾을 수 없습니다`,
          availableSources: this.getAvailableSources()
        };
      }

      // JSONPath 쿼리 실행
      const jsonPathResult = JSONPath({ path: jsonpath, json: queryResult.value });

      this.sourceLogger.debug('JSONPath 쿼리 결과', {
        key,
        jsonpath,
        resultCount: Array.isArray(jsonPathResult) ? jsonPathResult.length : 1,
        resultType: typeof jsonPathResult
      });

      return {
        success: true,
        data: this.formatValue(jsonPathResult),
        source: queryResult.source,
        key,
        found: true
      };

    } catch (error) {
      this.sourceLogger.error('JSONPath 쿼리 실패', error);
      return {
        success: false,
        key,
        found: false,
        message: `JSONPath 쿼리 실패: ${error instanceof Error ? error.message : String(error)}`,
        availableSources: this.getAvailableSources()
      };
    }
  }

  /**
   * 파라미터 검증
   */
  private validateParams(params: QueryJsonParams): { valid: boolean; message?: string } {
    const { key, source, jsonpath } = params;

    // key 필수 검증
    if (!key || typeof key !== 'string' || key.trim() === '') {
      return {
        valid: false,
        message: 'key 파라미터가 필요합니다 (비어있지 않은 문자열)'
      };
    }

    // key 형식 검증
    if (key.length > 1000) {
      return {
        valid: false,
        message: 'key 길이가 너무 깁니다 (최대 1000자)'
      };
    }

    // source 검증
    if (source && typeof source !== 'string') {
      return {
        valid: false,
        message: 'source는 문자열이어야 합니다'
      };
    }

    // jsonpath 검증
    if (jsonpath && typeof jsonpath !== 'string') {
      return {
        valid: false,
        message: 'jsonpath는 문자열이어야 합니다'
      };
    }

    if (jsonpath && jsonpath.length > 500) {
      return {
        valid: false,
        message: 'jsonpath 길이가 너무 깁니다 (최대 500자)'
      };
    }

    return { valid: true };
  }

  /**
   * 값 포맷팅
   */
  private formatValue(value: any): any {
    // null, undefined, primitive 타입은 그대로 반환
    if (value === null || value === undefined || typeof value !== 'object') {
      return value;
    }

    // 객체인 경우
    try {
      // 순환 참조 검사
      const seen = new WeakSet();
      const jsonString = JSON.stringify(value, (key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return '[Circular Reference]';
          }
          seen.add(val);
        }
        return val;
      });

      // 크기 제한 (50KB)
      if (jsonString.length > 50000) {
        return {
          _type: 'LargeObject',
          _size: jsonString.length,
          _truncated: true,
          _message: '데이터가 너무 커서 잘렸습니다'
        };
      }

      return value;

    } catch (error) {
      return {
        _type: 'SerializationError',
        _error: error instanceof Error ? error.message : String(error),
        _original: typeof value
      };
    }
  }

  /**
   * 사용 가능한 소스 목록 반환
   */
  private getAvailableSources(): string[] {
    return this.cacheManager.getLoadedSources();
  }

  /**
   * Tool 통계 정보 반환
   */
  public getStats() {
    return {
      totalQueries: 0, // TODO: 구현 필요
      averageResponseTime: 0, // TODO: 구현 필요
      successRate: 0, // TODO: 구현 필요
      cacheHitRate: this.cacheManager.getGlobalStats().cacheHitRate
    };
  }

  /**
   * 성능 측정을 포함한 쿼리 실행
   */
  public async executeWithMetrics(params: QueryJsonParams): Promise<QueryJsonResult & { metrics: any }> {
    const startTime = performance.now();

    const result = await this.execute(params);

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.sourceLogger.performance('query_json', duration, {
      key: params.key,
      source: params.source,
      found: result.found,
      success: result.success
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
export function createQueryJsonTool(cacheManager: CacheManager): QueryJsonTool {
  return new QueryJsonTool(cacheManager);
}
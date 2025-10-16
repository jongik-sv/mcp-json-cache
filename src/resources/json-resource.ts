/**
 * MCP Resource 인터페이스 구현
 * URI 패턴: json://{source}/{key}
 */

import { CacheManager } from '../cache/CacheManager.js';
import { logger } from '../utils/logger.js';

const resourceLogger = logger.withSource('RESOURCE');

export interface ResourceURI {
  scheme: string;
  source: string;
  key: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export class JsonResourceHandler {
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * URI 파싱
   * 지원 패턴:
   * - json://{source}/{key}
   * - json://{key} (모든 소스 검색)
   */
  public parseURI(uri: string): ResourceURI | null {
    const match = uri.match(/^json:\/\/([^/]+)(?:\/(.+))?$/);

    if (!match) {
      resourceLogger.warn('잘못된 URI 형식', { uri });
      return null;
    }

    const [, firstPart, secondPart] = match;

    // json://{source}/{key} 형식
    if (secondPart) {
      return {
        scheme: 'json',
        source: firstPart,
        key: secondPart
      };
    }

    // json://{key} 형식 (전체 소스 검색)
    return {
      scheme: 'json',
      source: '',  // 빈 문자열 = 전체 검색
      key: firstPart
    };
  }

  /**
   * Resource 조회
   */
  public async readResource(uri: string): Promise<ResourceContent> {
    const parsed = this.parseURI(uri);

    if (!parsed) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }

    resourceLogger.debug('Resource 조회', {
      uri,
      source: parsed.source || 'all',
      key: parsed.key
    });

    try {
      // 캐시에서 데이터 조회
      const result = this.cacheManager.query(
        parsed.key,
        parsed.source || undefined
      );

      if (!result.found) {
        const availableSources = this.cacheManager.getLoadedSources();
        throw new Error(
          `Key '${parsed.key}' not found. ` +
          `Available sources: ${availableSources.join(', ')}`
        );
      }

      // JSON 데이터를 문자열로 변환
      const text = JSON.stringify(result.value, null, 2);

      resourceLogger.info('Resource 조회 성공', {
        uri,
        source: result.source,
        key: parsed.key,
        size: text.length
      });

      return {
        uri,
        mimeType: 'application/json',
        text
      };

    } catch (error) {
      resourceLogger.error('Resource 조회 실패', {
        uri,
        error
      });
      throw error;
    }
  }

  /**
   * Resource 목록 조회
   * 특정 소스의 모든 키를 Resource URI로 변환
   */
  public listResources(source?: string): string[] {
    const sources = source
      ? [source]
      : this.cacheManager.getLoadedSources();

    const resourceURIs: string[] = [];

    for (const sourceName of sources) {
      const cache = this.cacheManager.getCache(sourceName);
      if (!cache) continue;

      const keys = cache.keys();
      for (const key of keys) {
        resourceURIs.push(`json://${sourceName}/${key}`);
      }
    }

    resourceLogger.debug('Resource 목록 조회', {
      source: source || 'all',
      count: resourceURIs.length
    });

    return resourceURIs;
  }

  /**
   * Resource 템플릿 목록 반환
   * MCP Resource 템플릿 기능 지원
   */
  public getResourceTemplates() {
    const sources = this.cacheManager.getLoadedSources();

    return sources.map(sourceName => ({
      uriTemplate: `json://${sourceName}/{key}`,
      name: `${sourceName} JSON Cache`,
      description: `Access cached JSON data from ${sourceName} source`,
      mimeType: 'application/json'
    }));
  }

  /**
   * URI 유효성 검증
   */
  public isValidURI(uri: string): boolean {
    return this.parseURI(uri) !== null;
  }

  /**
   * URI 생성 헬퍼
   */
  public createURI(source: string, key: string): string {
    return `json://${source}/${key}`;
  }

  /**
   * 전체 검색 URI 생성 헬퍼
   */
  public createSearchURI(key: string): string {
    return `json://${key}`;
  }
}

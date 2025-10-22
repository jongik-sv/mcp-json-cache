/**
 * CacheManager - 다중 JSON 소스 관리 클래스
 * 여러 JSON 파일을 동시에 관리하고 전역 검색 기능 제공
 */

import { JsonCache } from './JsonCache.js';
import { CacheConfig, QueryResult, CacheStats, ReloadResult, CacheError } from '../types.js';

export class CacheManager {
  private caches: Map<string, JsonCache> = new Map();
  private primarySource?: string;
  private config?: CacheConfig;
  private defaultMaxDepth: number = 2;

  /**
   * 모든 소스 로드
   */
  public async loadAll(config: CacheConfig): Promise<void> {
    this.config = config;
    this.defaultMaxDepth = config.options?.maxDepth ?? 2;
    const sourceEntries = Object.entries(config.sources);

    if (sourceEntries.length === 0) {
      throw new CacheError('로드할 소스가 없습니다', 'NO_SOURCES');
    }

    // 최대 10개 소스 제한
    if (sourceEntries.length > 10) {
      throw new CacheError(
        `소스 개수가 너무 많습니다: ${sourceEntries.length} (최대 10개)`,
        'TOO_MANY_SOURCES'
      );
    }

    const loadPromises: Promise<void>[] = [];
    const errors: Error[] = [];

    // primary 소스 식별
    this.primarySource = sourceEntries.find(([, source]) => source.primary)?.[0];

    // 모든 소스 병렬 로드
    for (const [name, sourceConfig] of sourceEntries) {
      const cache = new JsonCache(sourceConfig.name, sourceConfig.path);

      // 로드 시도 (실패해도 다른 소스는 계속 진행)
      const loadPromise = this.loadSourceWithFallback(cache, errors);
      loadPromises.push(loadPromise);

      this.caches.set(name, cache);
    }

    // 모든 로드 완료 대기
    await Promise.allSettled(loadPromises);

    // 모든 소스가 실패한 경우 에러 발생
    if (errors.length === sourceEntries.length) {
      throw new CacheError(
        `모든 소스 로드 실패: ${errors.map(e => e.message).join(', ')}`,
        'ALL_SOURCES_FAILED'
      );
    }

    // 일부 실패한 경우 경고 로그 (stderr 사용)
    if (errors.length > 0) {
      console.error(`[CacheManager] ${errors.length}개 소스 로드 실패:`);
      errors.forEach(error => console.error(`  - ${error.message}`));
    }
  }

  /**
   * 개별 소스 로드 (실패 시 다른 소스는 계속 진행)
   */
  private async loadSourceWithFallback(cache: JsonCache, errors: Error[]): Promise<void> {
    try {
      await cache.load();
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 전체 소스에서 키 검색 (source 미지정)
   */
  public queryAll(key: string): QueryResult {
    return this.query(key);
  }

  /**
   * 키로 데이터 조회
   */
  public query(key: string, source?: string): QueryResult {
    if (!this.isLoaded()) {
      throw new CacheError('캐시가 로드되지 않았습니다', 'CACHE_NOT_LOADED');
    }

    if (!key) {
      throw new CacheError('키가 필요합니다', 'KEY_REQUIRED');
    }

    // 특정 소스 지정 시 해당 소스에서만 검색
    if (source) {
      const cache = this.caches.get(source);
      if (!cache) {
        return {
          source: 'unknown',
          key,
          value: undefined,
          found: false
        };
      }

      const value = cache.get(key);
      return {
        source,
        key,
        value,
        found: value !== undefined
      };
    }

    // 소스 미지정 시 전체 소스 순회 검색 (primary 우선)
    if (this.primarySource) {
      const primaryCache = this.caches.get(this.primarySource);
      if (primaryCache) {
        const value = primaryCache.get(key);
        if (value !== undefined) {
          return {
            source: this.primarySource,
            key,
            value,
            found: true
          };
        }
      }
    }

    // 나머지 소스에서 검색
    for (const [sourceName, cache] of this.caches) {
      if (sourceName === this.primarySource) continue; // primary는 이미 검색함

      const value = cache.get(key);
      if (value !== undefined) {
        return {
          source: sourceName,
          key,
          value,
          found: true
        };
      }
    }

    // 찾지 못한 경우
    return {
      source: 'unknown',
      key,
      value: undefined,
      found: false
    };
  }

  /**
   * 키 목록 조회 (별칭)
   */
  public getKeys(source?: string, prefix?: string, maxDepth?: number): string[] {
    return this.listKeys(source, prefix, maxDepth);
  }

  /**
   * 키 목록 조회
   */
  public listKeys(source?: string, prefix?: string, maxDepth?: number): string[] {
    if (!this.isLoaded()) {
      return [];
    }

    // maxDepth가 지정되지 않으면 기본값 사용
    const effectiveMaxDepth = maxDepth ?? this.defaultMaxDepth;

    let allKeys: string[] = [];

    if (source) {
      // 특정 소스의 키만 조회
      const cache = this.caches.get(source);
      if (cache) {
        allKeys = cache.keys(effectiveMaxDepth);
      }
    } else {
      // 모든 소스의 키 조회 (중복 제거)
      const keySet = new Set<string>();
      for (const cache of this.caches.values()) {
        cache.keys(effectiveMaxDepth).forEach(key => keySet.add(key));
      }
      allKeys = Array.from(keySet);
    }

    // prefix 필터링
    if (prefix) {
      allKeys = allKeys.filter(key => key.startsWith(prefix));
    }

    // 정렬 (개수 제한은 웹 API 레벨에서 처리)
    return allKeys.sort();
  }

  /**
   * 특정 소스의 통계 정보 반환
   */
  public getSourceStats(source: string): any {
    const cache = this.caches.get(source);
    if (!cache) return null;

    const stats = cache.getStats();
    const sourceConfig = this.config?.sources[source];

    return {
      name: stats.name,
      path: stats.path,
      keys: stats.keys,
      size: stats.size,
      sizeFormatted: this.formatBytes(stats.size),
      loadedAt: stats.loadedAt,
      loadedAtFormatted: this.formatDate(stats.loadedAt),
      hits: stats.hits,
      isLoaded: cache.isLoaded(),
      isPrimary: source === this.primarySource,
      isWatchEnabled: sourceConfig?.watch || false
    };
  }

  /**
   * 소스 목록 및 통계 반환
   */
  public listSources(): CacheStats[] {
    const stats: CacheStats[] = [];

    for (const cache of this.caches.values()) {
      stats.push(cache.getStats());
    }

    return stats.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 개별 소스 리로드 (별칭)
   */
  public async reloadSource(source: string): Promise<ReloadResult> {
    return this.reload(source);
  }

  /**
   * 개별 소스 리로드
   */
  public async reload(source: string): Promise<ReloadResult> {
    const startTime = Date.now();

    const cache = this.caches.get(source);
    if (!cache) {
      return {
        source,
        success: false,
        error: `소스 '${source}'를 찾을 수 없습니다`,
        keys: 0,
        size: 0,
        duration: Date.now() - startTime
      };
    }

    try {
      await cache.load();
      const stats = cache.getStats();

      return {
        source,
        success: true,
        keys: stats.keys,
        size: stats.size,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        source,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        keys: 0,
        size: 0,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 모든 소스 리로드
   */
  public async reloadAll(): Promise<ReloadResult[]> {
    const results: ReloadResult[] = [];

    for (const sourceName of this.caches.keys()) {
      const result = await this.reload(sourceName);
      results.push(result);
    }

    return results;
  }

  /**
   * 특정 소스의 캐시 반환
   */
  public getCache(source: string): JsonCache | undefined {
    return this.caches.get(source);
  }

  /**
   * 모든 캐스 반환
   */
  public getAllCaches(): Map<string, JsonCache> {
    return new Map(this.caches);
  }

  /**
   * primary 소스 반환
   */
  public getPrimarySource(): string | undefined {
    return this.primarySource;
  }

  /**
   * 설정 반환
   */
  public getConfig(): CacheConfig | undefined {
    return this.config;
  }

  /**
   * 기본 maxDepth 반환
   */
  public getDefaultMaxDepth(): number {
    return this.defaultMaxDepth;
  }

  /**
   * 로드된 소스 목록 반환
   */
  public getLoadedSources(): string[] {
    return Array.from(this.caches.keys()).filter(name => {
      const cache = this.caches.get(name);
      return cache?.isLoaded();
    });
  }

  /**
   * 캐시가 로드되었는지 확인
   */
  public isLoaded(): boolean {
    return this.caches.size > 0 && Array.from(this.caches.values()).some(cache => cache.isLoaded());
  }

  /**
   * 전체 통계 정보 반환
   */
  public getGlobalStats() {
    const sources = this.listSources();
    const loadedSources = sources.filter(s => s.keys > 0);

    return {
      totalSources: sources.length,
      loadedSources: loadedSources.length,
      totalKeys: sources.reduce((sum, s) => sum + s.keys, 0),
      totalSize: sources.reduce((sum, s) => sum + s.size, 0),
      totalHits: sources.reduce((sum, s) => sum + s.hits, 0),
      cacheHitRate: this.calculateHitRate(sources),
      uptime: process.uptime(),
      lastReload: loadedSources.length > 0
        ? Math.max(...loadedSources.map(s => s.loadedAt.getTime()))
        : null
    };
  }

  /**
   * 캐시 히트율 계산
   */
  private calculateHitRate(sources: CacheStats[]): number {
    const totalHits = sources.reduce((sum, s) => sum + s.hits, 0);
    const totalRequests = totalHits + (sources.length * 10); // 가정: 소스당 최소 10번 요청

    return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
  }

  /**
   * 메모리 사용량 계산
   */
  public getMemoryUsage(): number {
    let totalUsage = 0;

    for (const cache of this.caches.values()) {
      totalUsage += cache.estimateMemoryUsage();
    }

    return totalUsage;
  }

  /**
   * 캐시 정리 (메모리 최적화)
   */
  public cleanup(): void {
    for (const cache of this.caches.values()) {
      if (!cache.isLoaded()) {
        // 로드되지 않은 캐시 정리
        cache.clear();
      }
    }

    // 가비지 컬렉션 제안
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 바이트 포맷팅
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 날짜 포맷팅
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;

    return date.toLocaleString();
  }

  /**
   * 캐시 매니저 종료
   */
  public shutdown(): void {
    // 모든 캐시 정리
    for (const cache of this.caches.values()) {
      cache.clear();
    }

    // 캐시 맵 초기화
    this.caches.clear();
    this.primarySource = undefined;
    this.config = undefined;
  }
}
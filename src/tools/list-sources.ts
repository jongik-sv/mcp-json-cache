/**
 * list_sources Tool - 소스 목록 및 통계 조회 Tool
 * 로드된 JSON 소스 목록과 상세 통계 정보를 반환
 */

import { CacheManager } from '../cache/CacheManager.js';
import { logger } from '../utils/logger.js';
import { withGracefulDegradation } from '../utils/errors.js';

export interface ListSourcesParams {
  includeDetails?: boolean;
  sortBy?: 'name' | 'loadedAt' | 'keys' | 'size' | 'hits';
  sortOrder?: 'asc' | 'desc';
}

export interface SourceDetails {
  name: string;
  path: string;
  keys: number;
  size: number;
  sizeFormatted: string;
  loadedAt: string;
  loadedAtFormatted: string;
  hits: number;
  isLoaded: boolean;
  isPrimary: boolean;
  isWatchEnabled: boolean;
  memoryUsage: number;
  memoryUsageFormatted: string;
  averageKeyLength: number;
}

export interface ListSourcesResult {
  success: boolean;
  sources: SourceDetails[];
  summary: {
    total: number;
    loaded: number;
    primary?: string;
    totalKeys: number;
    totalSize: number;
    totalSizeFormatted: string;
    totalHits: number;
    averageKeysPerSource: number;
    memoryUsage: number;
    memoryUsageFormatted: string;
    uptime: number;
    uptimeFormatted: string;
    cacheHitRate: number;
  };
  metadata: {
    timestamp: string;
    version: string;
    config: {
      maxSources: number;
      maxFileSize: string;
      autoReload: boolean;
    };
  };
  message?: string;
}

export class ListSourcesTool {
  private cacheManager: CacheManager;
  private sourceLogger = logger.withSource('list_sources');
  private version = '1.0.0';

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  /**
   * Tool 스키마 정의
   */
  public getSchema() {
    return {
      name: "list_sources",
      description: "로드된 JSON 소스 목록 및 상세 통계 정보를 반환합니다. 소스별 메타데이터, 성능 통계, 상태 정보를 포함합니다.",
      inputSchema: {
        type: "object",
        properties: {
          includeDetails: {
            type: "boolean",
            description: "상세 정보 포함 여부 (기본값: true)"
          },
          sortBy: {
            type: "string",
            enum: ["name", "loadedAt", "keys", "size", "hits"],
            description: "정렬 기준 (기본값: name)"
          },
          sortOrder: {
            type: "string",
            enum: ["asc", "desc"],
            description: "정렬 순서 (기본값: asc)"
          }
        }
      }
    };
  }

  /**
   * 소스 목록 조회 실행
   */
  public async execute(params: ListSourcesParams = {}): Promise<ListSourcesResult> {
    const { includeDetails = true, sortBy = 'name', sortOrder = 'asc' } = params;

    this.sourceLogger.debug('소스 목록 조회 시작', { includeDetails, sortBy, sortOrder });

    try {
      // 캐시 상태 확인
      if (!this.cacheManager.isLoaded()) {
        return this.createErrorResponse('캐시가 로드되지 않았습니다');
      }

      // 글로벌 통계 수집
      const globalStats = this.cacheManager.getGlobalStats();
      const allCaches = this.cacheManager.getAllCaches();

      // 소스별 상세 정보 수집
      const sources: SourceDetails[] = [];
      let totalKeys = 0;
      let totalSize = 0;
      let totalHits = 0;
      let totalMemoryUsage = 0;

      for (const [sourceName, cache] of allCaches) {
        const cacheStats = cache.getStats();
        const memoryUsage = cache.estimateMemoryUsage();
        const config = this.cacheManager.getConfig();
        const sourceConfig = config?.sources[sourceName];

        const sourceDetails: SourceDetails = {
          name: sourceName,
          path: cacheStats.path,
          keys: cacheStats.keys,
          size: cacheStats.size,
          sizeFormatted: this.formatFileSize(cacheStats.size),
          loadedAt: cacheStats.loadedAt.toISOString(),
          loadedAtFormatted: this.formatDate(cacheStats.loadedAt),
          hits: cacheStats.hits,
          isLoaded: cache.isLoaded(),
          isPrimary: sourceConfig?.primary || false,
          isWatchEnabled: sourceConfig?.watch || false,
          memoryUsage,
          memoryUsageFormatted: this.formatFileSize(memoryUsage),
          averageKeyLength: this.calculateAverageKeyLength(cache)
        };

        sources.push(sourceDetails);

        // 전체 통계 누적
        if (cache.isLoaded()) {
          totalKeys += cacheStats.keys;
          totalSize += cacheStats.size;
          totalHits += cacheStats.hits;
          totalMemoryUsage += memoryUsage;
        }
      }

      // 소스 정렬
      const sortedSources = this.sortSources(sources, sortBy, sortOrder);

      // 요약 정보 생성
      const summary = {
        total: allCaches.size,
        loaded: sortedSources.filter(s => s.isLoaded).length,
        primary: sortedSources.find(s => s.isPrimary)?.name,
        totalKeys,
        totalSize,
        totalSizeFormatted: this.formatFileSize(totalSize),
        totalHits,
        averageKeysPerSource: totalKeys > 0 ? Math.round(totalKeys / sortedSources.length) : 0,
        memoryUsage: totalMemoryUsage,
        memoryUsageFormatted: this.formatFileSize(totalMemoryUsage),
        uptime: globalStats.uptime,
        uptimeFormatted: this.formatUptime(globalStats.uptime),
        cacheHitRate: globalStats.cacheHitRate
      };

      // 메타데이터 생성
      const metadata = {
        timestamp: new Date().toISOString(),
        version: this.version,
        config: {
          maxSources: 10,
          maxFileSize: '50MB',
          autoReload: this.cacheManager.getConfig()?.options?.autoReload || false
        }
      };

      this.sourceLogger.debug('소스 목록 조회 완료', {
        totalSources: sources.length,
        loadedSources: summary.loaded,
        totalKeys,
        cacheHitRate: summary.cacheHitRate
      });

      return {
        success: true,
        sources: includeDetails ? sortedSources : this.createMinimalSourceList(sortedSources),
        summary,
        metadata
      };

    } catch (error) {
      this.sourceLogger.error('소스 목록 조회 중 오류', error);
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 소스 정렬
   */
  private sortSources(sources: SourceDetails[], sortBy: string, sortOrder: string): SourceDetails[] {
    const sorted = [...sources].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'loadedAt':
          comparison = new Date(a.loadedAt).getTime() - new Date(b.loadedAt).getTime();
          break;
        case 'keys':
          comparison = a.keys - b.keys;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'hits':
          comparison = a.hits - b.hits;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Primary 소스를 맨 앞으로
    return sorted.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return 0;
    });
  }

  /**
   * 최소한 소스 목록 생성
   */
  private createMinimalSourceList(sources: SourceDetails[]): SourceDetails[] {
    return sources.map(source => ({
      name: source.name,
      path: source.path,
      keys: source.keys,
      size: source.size,
      sizeFormatted: source.sizeFormatted,
      loadedAt: source.loadedAt,
      loadedAtFormatted: source.loadedAtFormatted,
      hits: source.hits,
      isLoaded: source.isLoaded,
      isPrimary: source.isPrimary,
      isWatchEnabled: source.isWatchEnabled,
      memoryUsage: source.memoryUsage,
      memoryUsageFormatted: source.memoryUsageFormatted,
      averageKeyLength: source.averageKeyLength
    }));
  }

  /**
   * 에러 응답 생성
   */
  private createErrorResponse(message: string): ListSourcesResult {
    return {
      success: false,
      sources: [],
      summary: {
        total: 0,
        loaded: 0,
        totalKeys: 0,
        totalSize: 0,
        totalSizeFormatted: '0 B',
        totalHits: 0,
        averageKeysPerSource: 0,
        memoryUsage: 0,
        memoryUsageFormatted: '0 B',
        uptime: 0,
        uptimeFormatted: '0s',
        cacheHitRate: 0
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: this.version,
        config: {
          maxSources: 10,
          maxFileSize: '50MB',
          autoReload: false
        }
      },
      message
    };
  }

  /**
   * 파일 크기 포맷팅
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.floor(Math.log10(bytes) / 3);
    const size = bytes / Math.pow(1024, unitIndex);

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 날짜 포맷팅
   */
  private formatDate(date: Date): string {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 가동 시간 포맷팅
   */
  private formatUptime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else if (seconds < 86400) {
      return `${Math.round(seconds / 3600)}h`;
    } else {
      return `${Math.round(seconds / 86400)}d`;
    }
  }

  /**
   * 평균 키 길이 계산
   */
  private calculateAverageKeyLength(cache: any): number {
    try {
      const keys = cache.keys();
      if (keys.length === 0) return 0;

      const totalLength = keys.reduce((sum: number, key: string) => sum + key.length, 0);
      return Math.round(totalLength / keys.length);
    } catch (error) {
      this.sourceLogger.warn('평균 키 길이 계산 실패', error);
      return 0;
    }
  }

  /**
   * 특정 소스의 상세 정보 조회
   */
  public async getSourceDetails(sourceName: string): Promise<ListSourcesResult & { source?: SourceDetails }> {
    this.sourceLogger.debug('소스 상세 정보 조회', { sourceName });

    try {
      const result = await this.execute();

      if (!result.success) {
        return {
          ...result,
          source: undefined
        };
      }

      const source = result.sources.find(s => s.name === sourceName);

      if (!source) {
        return {
          ...result,
          source: undefined,
          message: `소스 '${sourceName}'를 찾을 수 없습니다`
        };
      }

      return {
        ...result,
        source,
        message: `소스 '${sourceName}' 정보 조회 완료`
      };

    } catch (error) {
      this.sourceLogger.error('소스 상세 정보 조회 중 오류', error);
      return {
        ...this.createErrorResponse(error instanceof Error ? error.message : String(error)),
        source: undefined
      };
    }
  }

  /**
   * 통계 정보 반환
   */
  public getStats() {
    const globalStats = this.cacheManager.getGlobalStats();
    const config = this.cacheManager.getConfig();

    return {
      version: this.version,
      uptime: globalStats.uptime,
      totalSources: globalStats.totalSources,
      loadedSources: globalStats.loadedSources,
      cacheHitRate: globalStats.cacheHitRate,
      memoryUsage: this.cacheManager.getMemoryUsage(),
      autoReloadEnabled: config?.options?.autoReload || false,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * 성능 측정을 포함한 소스 목록 조회
   */
  public async executeWithMetrics(params: ListSourcesParams = {}): Promise<ListSourcesResult & { metrics: any }> {
    const startTime = performance.now();

    const result = await this.execute(params);

    const endTime = performance.now();
    const duration = endTime - startTime;

    this.sourceLogger.performance('list_sources', duration, {
      includeDetails: params.includeDetails,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      sourcesCount: result.sources.length
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
export function createListSourcesTool(cacheManager: CacheManager): ListSourcesTool {
  return new ListSourcesTool(cacheManager);
}
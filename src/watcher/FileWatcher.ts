/**
 * FileWatcher - 파일 변경 감지 및 자동 리로드 시스템
 * chokidar를 사용하여 JSON 파일 변경을 감지하고 자동으로 캐시 리로드
 */

import * as chokidar from 'chokidar';
import { CacheManager } from '../cache/CacheManager.js';
import { logger } from '../utils/logger.js';
import { CacheConfig } from '../types.js';

export interface WatcherStats {
  watching: number;
  changes: number;
  lastChange: Date | null;
  errors: number;
}

export interface FileChangeEvent {
  type: 'change' | 'unlink' | 'add';
  source: string;
  path: string;
  timestamp: Date;
}

export type FileChangeListener = (event: FileChangeEvent) => void;

export class FileWatcher {
  private watcher?: chokidar.FSWatcher;
  private cacheManager: CacheManager;
  private config: CacheConfig;
  private watchedPaths: Map<string, string> = new Map(); // path -> source name
  private stats: WatcherStats = {
    watching: 0,
    changes: 0,
    lastChange: null,
    errors: 0
  };
  private changeListeners: FileChangeListener[] = [];
  private reloadDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private watcherLogger = logger.withSource('FILE_WATCHER');

  constructor(cacheManager: CacheManager, config: CacheConfig) {
    this.cacheManager = cacheManager;
    this.config = config;
  }

  /**
   * 파일 감시 시작
   */
  public start(): void {
    if (this.watcher) {
      this.watcherLogger.warn('파일 감시가 이미 시작되었습니다');
      return;
    }

    // watch 활성화된 소스들의 경로 수집
    const pathsToWatch: string[] = [];

    for (const [sourceName, sourceConfig] of Object.entries(this.config.sources)) {
      if (sourceConfig.watch) {
        pathsToWatch.push(sourceConfig.path);
        this.watchedPaths.set(sourceConfig.path, sourceName);
      }
    }

    if (pathsToWatch.length === 0) {
      this.watcherLogger.info('감시할 파일이 없습니다 (watch 옵션 비활성화)');
      return;
    }

    // chokidar watcher 생성
    this.watcher = chokidar.watch(pathsToWatch, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    // 이벤트 핸들러 등록
    this.watcher
      .on('change', (path) => this.handleFileChange(path, 'change'))
      .on('unlink', (path) => this.handleFileChange(path, 'unlink'))
      .on('add', (path) => this.handleFileChange(path, 'add'))
      .on('error', (error) => this.handleError(error));

    this.stats.watching = pathsToWatch.length;
    this.watcherLogger.info('파일 감시 시작', {
      watching: pathsToWatch.length,
      paths: pathsToWatch
    });
  }

  /**
   * 파일 변경 이벤트 처리
   */
  private handleFileChange(path: string, type: 'change' | 'unlink' | 'add'): void {
    const sourceName = this.watchedPaths.get(path);

    if (!sourceName) {
      this.watcherLogger.debug('알 수 없는 파일 변경', { path });
      return;
    }

    this.stats.changes++;
    this.stats.lastChange = new Date();

    const event: FileChangeEvent = {
      type,
      source: sourceName,
      path,
      timestamp: new Date()
    };

    this.watcherLogger.info('파일 변경 감지', {
      type,
      source: sourceName,
      path
    });

    // 리스너들에게 알림
    this.notifyListeners(event);

    // 파일 삭제 시에는 리로드 하지 않음
    if (type === 'unlink') {
      this.watcherLogger.warn('파일 삭제 감지, 리로드 스킵', { source: sourceName });
      return;
    }

    // 디바운스를 통한 자동 리로드
    this.scheduleReload(sourceName);
  }

  /**
   * 디바운스를 적용한 리로드 스케줄링
   * 짧은 시간에 여러 변경이 발생해도 한 번만 리로드
   */
  private scheduleReload(sourceName: string): void {
    // 기존 타이머 취소
    const existingTimer = this.reloadDebounceTimers.get(sourceName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 500ms 후 리로드 실행
    const timer = setTimeout(async () => {
      await this.executeReload(sourceName);
      this.reloadDebounceTimers.delete(sourceName);
    }, 500);

    this.reloadDebounceTimers.set(sourceName, timer);
  }

  /**
   * 실제 리로드 실행
   */
  private async executeReload(sourceName: string): Promise<void> {
    this.watcherLogger.info('자동 리로드 시작', { source: sourceName });

    try {
      const result = await this.cacheManager.reloadSource(sourceName);

      if (result.success) {
        this.watcherLogger.info('자동 리로드 완료', {
          source: sourceName,
          keys: result.keys,
          duration: result.duration
        });
      } else {
        this.stats.errors++;
        this.watcherLogger.error('자동 리로드 실패 (기존 캐시 유지)', {
          source: sourceName,
          error: result.error
        });
      }
    } catch (error) {
      this.stats.errors++;
      this.watcherLogger.error('자동 리로드 중 예외 발생', {
        source: sourceName,
        error
      });
    }
  }

  /**
   * 에러 핸들러
   */
  private handleError(error: unknown): void {
    this.stats.errors++;
    this.watcherLogger.error('파일 감시 중 오류', error);
  }

  /**
   * 변경 이벤트 리스너 추가
   */
  public addChangeListener(listener: FileChangeListener): void {
    this.changeListeners.push(listener);
  }

  /**
   * 변경 이벤트 리스너 제거
   */
  public removeChangeListener(listener: FileChangeListener): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * 리스너들에게 변경 이벤트 알림
   */
  private notifyListeners(event: FileChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        this.watcherLogger.error('리스너 실행 중 오류', error);
      }
    }
  }

  /**
   * 통계 정보 반환
   */
  public getStats(): WatcherStats {
    return { ...this.stats };
  }

  /**
   * 감시 중인 소스 목록 반환
   */
  public getWatchedSources(): string[] {
    return Array.from(this.watchedPaths.values());
  }

  /**
   * 특정 소스가 감시 중인지 확인
   */
  public isWatching(sourceName: string): boolean {
    return Array.from(this.watchedPaths.values()).includes(sourceName);
  }

  /**
   * 파일 감시 중지
   */
  public async stop(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    // 대기 중인 리로드 타이머 모두 취소
    for (const timer of this.reloadDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.reloadDebounceTimers.clear();

    // watcher 종료
    await this.watcher.close();
    this.watcher = undefined;

    this.watcherLogger.info('파일 감시 중지', {
      totalChanges: this.stats.changes,
      errors: this.stats.errors
    });

    // 통계 리셋
    this.stats = {
      watching: 0,
      changes: 0,
      lastChange: null,
      errors: 0
    };
  }

  /**
   * 감시 중인지 확인
   */
  public isActive(): boolean {
    return this.watcher !== undefined;
  }
}

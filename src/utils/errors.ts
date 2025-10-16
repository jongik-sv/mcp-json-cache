/**
 * Error Handler - 에러 핸들링 프레임워크
 * 그레이스풀 디그레이션 및 에러 복구 전략 제공
 */

import { logger } from './logger.js';
import { CacheError, ConfigError, ValidationError } from '../types.js';

export interface ErrorContext {
  operation: string;
  source?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  canRecover(error: Error): boolean;
  recover(error: Error, context: ErrorContext): Promise<any>;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ErrorReport {
  error: Error;
  context: ErrorContext;
  timestamp: Date;
  recovered: boolean;
  attempts: number;
  duration: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private recoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();
  private errorReports: ErrorReport[] = [];
  private maxReports: number = 1000;

  private constructor() {
    this.setupDefaultStrategies();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 기본 복구 전략 설정
   */
  private setupDefaultStrategies(): void {
    // 파일 로드 오류 복구 전략
    this.recoveryStrategies.set('FILE_NOT_FOUND', {
      canRecover: (error: Error) => error instanceof CacheError && error.code === 'FILE_NOT_FOUND',
      recover: async (error: Error, context: ErrorContext) => {
        logger.warn(`파일을 찾을 수 있음: ${context.source}`, { error: error.message });
        return { success: false, message: '파일을 찾을 수 없습니다' };
      },
      maxRetries: 0
    });

    // JSON 파싱 오류 복구 전략
    this.recoveryStrategies.set('JSON_PARSE_ERROR', {
      canRecover: (error: Error) => error instanceof CacheError && error.code === 'JSON_PARSE_ERROR',
      recover: async (error: Error, context: ErrorContext) => {
        logger.warn(`JSON 파싱 실패: ${context.source}`, { error: error.message });
        return { success: false, message: 'JSON 파싱에 실패했습니다' };
      },
      maxRetries: 2,
      retryDelay: 1000
    });

    // 설정 오류 복구 전략
    this.recoveryStrategies.set('CONFIG_LOAD_ERROR', {
      canRecover: (error: Error) => error instanceof ConfigError,
      recover: async (error: Error, context: ErrorContext) => {
        logger.warn('설정 로드 실패, 기본값 사용', { error: error.message });
        return { success: true, message: '기본 설정으로 복구' };
      },
      maxRetries: 1
    });

    // 네트워크/IO 오류 복구 전략
    this.recoveryStrategies.set('LOAD_ERROR', {
      canRecover: (error: Error) => error instanceof CacheError && error.code === 'LOAD_ERROR',
      recover: async (error: Error, context: ErrorContext) => {
        logger.warn(`파일 로드 오류: ${context.source}`, { error: error.message });

        // 재시도 지연
        await this.delay(2000);

        return { success: false, message: '일시적인 로드 오류' };
      },
      maxRetries: 3,
      retryDelay: 2000
    });
  }

  /**
   * 에러 처리 및 복구 시도
   */
  public async handleError(
    error: Error,
    context: ErrorContext,
    fallback?: () => any
  ): Promise<any> {
    const startTime = Date.now();
    const errorReport: ErrorReport = {
      error,
      context,
      timestamp: new Date(),
      recovered: false,
      attempts: 0,
      duration: 0
    };

    try {
      // 에러 로깅
      this.logError(error, context);

      // 복구 전략 찾기
      const strategy = this.findRecoveryStrategy(error);

      if (strategy && strategy.canRecover(error)) {
        const maxRetries = strategy.maxRetries || 1;
        const retryDelay = strategy.retryDelay || 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          errorReport.attempts = attempt;

          try {
            logger.info(`복구 시도 ${attempt}/${maxRetries}: ${context.operation}`);

            const result = await strategy.recover(error, context);

            if (result.success) {
              errorReport.recovered = true;
              logger.info(`복구 성공: ${context.operation}`);
              return result;
            }

            if (attempt < maxRetries) {
              await this.delay(retryDelay);
            }

          } catch (recoveryError) {
            logger.warn(`복구 시도 ${attempt} 실패: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);

            if (attempt < maxRetries) {
              await this.delay(retryDelay);
            }
          }
        }
      }

      // 복구 실패 시 폴백 실행
      if (fallback) {
        logger.info(`폴백 실행: ${context.operation}`);
        try {
          const fallbackResult = await fallback();
          errorReport.recovered = true;
          logger.info(`폴백 성공: ${context.operation}`);
          return fallbackResult;
        } catch (fallbackError) {
          logger.error(`폴백 실패: ${context.operation}`, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
        }
      }

      // 모든 복구 실패
      logger.error(`복구 실패: ${context.operation}`, error);
      throw error;

    } finally {
      errorReport.duration = Date.now() - startTime;
      this.addErrorReport(errorReport);
    }
  }

  /**
   * 그레이스풀 디그레이션 함수
   * 오류가 발생해도 애플리케이션이 계속 실행되도록 함
   */
  public async withGracefulDegradation<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const handledError = error instanceof Error ? error : new Error(String(error));

      try {
        return await this.handleError(handledError, context, fallback);
      } catch (handlingError) {
        // 최종 실패 시 fallback 실행
        logger.error(`최종 실패, fallback 실행: ${context.operation}`, handlingError instanceof Error ? handlingError : new Error(String(handlingError)));
        return await fallback();
      }
    }
  }

  /**
   * 동기식 그레이스풀 디그레이션
   */
  public withGracefulDegradationSync<T>(
    operation: () => T,
    context: ErrorContext,
    fallback?: () => T
  ): T | null {
    try {
      return operation();
    } catch (error) {
      const handledError = error instanceof Error ? error : new Error(String(error));

      // 에러 로깅
      this.logError(handledError, context);

      // 폴백 실행
      if (fallback) {
        try {
          logger.info(`동기 폴백 실행: ${context.operation}`);
          return fallback();
        } catch (fallbackError) {
          logger.error(`동기 폴백 실패: ${context.operation}`, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
        }
      }

      // 실패 시 null 반환
      logger.error(`동기 작업 실패 (그레이스풀 디그레이션): ${context.operation}`, handledError);
      return null;
    }
  }

  /**
   * 복구 전략 등록
   */
  public registerRecoveryStrategy(
    errorCode: string,
    strategy: ErrorRecoveryStrategy
  ): void {
    this.recoveryStrategies.set(errorCode, strategy);
    logger.debug(`복구 전략 등록: ${errorCode}`);
  }

  /**
   * 복구 전략 찾기
   */
  private findRecoveryStrategy(error: Error): ErrorRecoveryStrategy | undefined {
    if (error instanceof CacheError) {
      return this.recoveryStrategies.get(error.code);
    } else if (error instanceof ConfigError) {
      return this.recoveryStrategies.get(error.code);
    } else if (error instanceof ValidationError) {
      return this.recoveryStrategies.get('VALIDATION_ERROR');
    }

    // 일반적인 에러 타입으로 복구 전략 찾기
    if (error.name === 'TypeError') {
      return this.recoveryStrategies.get('TYPE_ERROR');
    } else if (error.name === 'ReferenceError') {
      return this.recoveryStrategies.get('REFERENCE_ERROR');
    }

    return undefined;
  }

  /**
   * 에러 로깅
   */
  private logError(error: Error, context: ErrorContext): void {
    const logContext = {
      operation: context.operation,
      source: context.source,
      userId: context.userId,
      requestId: context.requestId,
      metadata: context.metadata,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    };

    if (error instanceof CacheError || error instanceof ConfigError) {
      logger.error(`[${error.code}] ${error.message}`, logContext);
    } else {
      logger.error(`[${error.name}] ${error.message}`, logContext);
    }
  }

  /**
   * 에러 보고서 추가
   */
  private addErrorReport(report: ErrorReport): void {
    this.errorReports.push(report);

    // 보고서 개수 제한
    if (this.errorReports.length > this.maxReports) {
      this.errorReports.shift();
    }
  }

  /**
   * 에러 보고서 목록 반환
   */
  public getErrorReports(limit?: number): ErrorReport[] {
    const reports = [...this.errorReports].reverse(); // 최신순
    return limit ? reports.slice(0, limit) : reports;
  }

  /**
   * 에러 통계 정보 반환
   */
  public getErrorStats() {
    const total = this.errorReports.length;
    const recovered = this.errorReports.filter(r => r.recovered).length;
    const byOperation = new Map<string, number>();
    const byErrorType = new Map<string, number>();

    for (const report of this.errorReports) {
      // 작업별 통계
      const operationCount = byOperation.get(report.context.operation) || 0;
      byOperation.set(report.context.operation, operationCount + 1);

      // 에러 타입별 통계
      const errorType = report.error.constructor.name;
      const typeCount = byErrorType.get(errorType) || 0;
      byErrorType.set(errorType, typeCount + 1);
    }

    return {
      total,
      recovered,
      recoveryRate: total > 0 ? (recovered / total) * 100 : 0,
      averageDuration: total > 0 ? this.errorReports.reduce((sum, r) => sum + r.duration, 0) / total : 0,
      byOperation: Object.fromEntries(byOperation),
      byErrorType: Object.fromEntries(byErrorType),
      maxReports: this.maxReports
    };
  }

  /**
   * 보고서 정리
   */
  public clearReports(): void {
    this.errorReports = [];
    logger.info('에러 보고서 정리 완료');
  }

  /**
   * 보고서 크기 설정
   */
  public setMaxReports(size: number): void {
    this.maxReports = Math.max(100, size);

    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(-this.maxReports);
    }
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 글로벌 에러 핸들러 설정
   */
  public setupGlobalHandlers(): void {
    // 미처리 예외 핸들러
    process.on('uncaughtException', (error: Error) => {
      logger.error('처리되지 않은 예외', error);
      // 프로세스 종료 방지 (그레이스풀 디그레이션)
    });

    // 미처리 Promise 거부 핸들러
    process.on('unhandledRejection', (reason: any) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('처리되지 않은 Promise 거부', error);
    });
  }
}

// 싱글톤 인스턴스 export
export const errorHandler = ErrorHandler.getInstance();

// 편의 함수 export
export const withGracefulDegradation = <T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  fallback: () => T | Promise<T>
): Promise<T> => {
  return errorHandler.withGracefulDegradation(operation, context, fallback);
};

export const withGracefulDegradationSync = <T>(
  operation: () => T,
  context: ErrorContext,
  fallback?: () => T
): T | null => {
  return errorHandler.withGracefulDegradationSync(operation, context, fallback);
};

// 글로벌 핸들러 자동 설정
errorHandler.setupGlobalHandlers();
/**
 * Logger - MCP stdio 호환 로깅 유틸리티
 * stderr 전용 출력 및 구조화된 로그 지원
 */

import { LogLevel } from '../types.js';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  source?: string;
}

// 소스별 로거 인터페이스
export interface SourceLogger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, error?: any) => void;
  performance: (operation: string, duration: number, context?: any) => void;
  mcp: (message: string, context?: any) => void;
}

export class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel = 'info';
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 1000;

  // 성능 측정 메서드 추가
  public performance(operation: string, duration: number, context?: any): void {
    this.info(`[PERF] ${operation}: ${duration}ms`, context);
  }

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 로그 레벨 설정
   */
  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * 현재 로그 레벨 반환
   */
  public getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * 로그 레벨 순서 확인
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.currentLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * 타임스탬프 생성
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 로그 메시지 포맷팅
   */
  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, message, context, source } = entry;

    let formatted = `[${timestamp}] ${level.toUpperCase()}`;

    if (source) {
      formatted += ` [${source}]`;
    }

    formatted += `: ${message}`;

    if (context) {
      try {
        const contextStr = typeof context === 'string'
          ? context
          : JSON.stringify(context, null, 2);
        formatted += `\n${contextStr}`;
      } catch (error) {
        formatted += `\n[Context serialization failed: ${error}]`;
      }
    }

    return formatted;
  }

  /**
   * 로그 출력 (stderr 전용)
   */
  private writeLog(entry: LogEntry): void {
    // MCP stdio 호환을 위해 stderr 사용
    process.stderr.write(this.formatMessage(entry) + '\n');
  }

  /**
   * 로그 버퍼에 추가
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);

    // 버퍼 크기 제한
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * 디버그 로그
   */
  public debug(message: string, ...args: any[]): void {
    if (!this.shouldLog('debug')) return;

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level: 'debug',
      message,
      context: args.length > 0 ? args : undefined
    };

    this.writeLog(entry);
    this.addToBuffer(entry);
  }

  /**
   * 정보 로그
   */
  public info(message: string, ...args: any[]): void {
    if (!this.shouldLog('info')) return;

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level: 'info',
      message,
      context: args.length > 0 ? args : undefined
    };

    this.writeLog(entry);
    this.addToBuffer(entry);
  }

  /**
   * 경고 로그
   */
  public warn(message: string, ...args: any[]): void {
    if (!this.shouldLog('warn')) return;

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level: 'warn',
      message,
      context: args.length > 0 ? args : undefined
    };

    this.writeLog(entry);
    this.addToBuffer(entry);
  }

  /**
   * 에러 로그
   */
  public error(message: string, error?: Error | any): void {
    if (!this.shouldLog('error')) return;

    let context: any;

    if (error instanceof Error) {
      context = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (error) {
      context = error;
    }

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level: 'error',
      message,
      context
    };

    this.writeLog(entry);
    this.addToBuffer(entry);
  }

  /**
   * 소스별 로그
   */
  public withSource(source: string): SourceLogger {
    return {
      debug: (message: string, ...args: any[]) => {
        if (!this.shouldLog('debug')) return;
        const entry: LogEntry = {
          timestamp: this.getTimestamp(),
          level: 'debug',
          message,
          context: args.length > 0 ? args : undefined,
          source
        };
        this.writeLog(entry);
        this.addToBuffer(entry);
      },
      info: (message: string, ...args: any[]) => {
        if (!this.shouldLog('info')) return;
        const entry: LogEntry = {
          timestamp: this.getTimestamp(),
          level: 'info',
          message,
          context: args.length > 0 ? args : undefined,
          source
        };
        this.writeLog(entry);
        this.addToBuffer(entry);
      },
      warn: (message: string, ...args: any[]) => {
        if (!this.shouldLog('warn')) return;
        const entry: LogEntry = {
          timestamp: this.getTimestamp(),
          level: 'warn',
          message,
          context: args.length > 0 ? args : undefined,
          source
        };
        this.writeLog(entry);
        this.addToBuffer(entry);
      },
      error: (message: string, error?: Error | any) => {
        if (!this.shouldLog('error')) return;
        let context: any;

        if (error instanceof Error) {
          context = {
            name: error.name,
            message: error.message,
            stack: error.stack
          };
        } else if (error) {
          context = error;
        }

        const entry: LogEntry = {
          timestamp: this.getTimestamp(),
          level: 'error',
          message,
          context,
          source
        };
        this.writeLog(entry);
        this.addToBuffer(entry);
      },
      performance: (operation: string, duration: number, context?: any) => {
        const entry: LogEntry = {
          timestamp: this.getTimestamp(),
          level: 'info',
          message: `[PERF] ${operation}: ${duration}ms`,
          context,
          source
        };
        this.writeLog(entry);
        this.addToBuffer(entry);
      },
      mcp: (message: string, context?: any) => {
        const entry: LogEntry = {
          timestamp: this.getTimestamp(),
          level: 'info',
          message: `[MCP] ${message}`,
          context,
          source
        };
        this.writeLog(entry);
        this.addToBuffer(entry);
      }
    };
  }

  /**
   * 로그 버퍼 반환
   */
  public getBuffer(limit?: number): LogEntry[] {
    if (limit && limit > 0) {
      return this.logBuffer.slice(-limit);
    }
    return [...this.logBuffer];
  }

  /**
   * 로그 버퍼 정리
   */
  public clearBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * 특정 레벨의 로그만 필터링
   */
  public filterByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level === level);
  }

  /**
   * 특정 소스의 로그만 필터링
   */
  public filterBySource(source: string): LogEntry[] {
    return this.logBuffer.filter(entry => entry.source === source);
  }

  /**
   * 로그 버퍼 크기 설정
   */
  public setBufferSize(size: number): void {
    this.maxBufferSize = Math.max(100, size); // 최소 100개

    // 현재 버퍼 크기 조정
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  /**
   * 통계 정보 반환
   */
  public getStats() {
    const stats = {
      total: this.logBuffer.length,
      byLevel: {} as Record<LogLevel, number>,
      bySource: {} as Record<string, number>,
      bufferSize: this.maxBufferSize,
      currentLevel: this.currentLevel
    };

    // 레벨별 통계
    for (const level of ['debug', 'info', 'warn', 'error'] as LogLevel[]) {
      stats.byLevel[level] = this.logBuffer.filter(entry => entry.level === level).length;
    }

    // 소스별 통계
    const sourceCounts = new Map<string, number>();
    for (const entry of this.logBuffer) {
      if (entry.source) {
        sourceCounts.set(entry.source, (sourceCounts.get(entry.source) || 0) + 1);
      }
    }

    stats.bySource = Object.fromEntries(sourceCounts);

    return stats;
  }

  /**
   * MCP 프로토콜용 로그 (프로세스 시작/종료 등)
   */
  public mcp(message: string, context?: any): void {
    this.info(`[MCP] ${message}`, context);
  }

  
  /**
   * 요청/응답 로그
   */
  public request(method: string, path: string, statusCode: number, duration: number): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    const message = `[REQ] ${method} ${path} ${statusCode} (${duration}ms)`;

    if (level === 'warn') {
      this.warn(message);
    } else {
      this.info(message);
    }
  }
}

// 싱글톤 인스턴스 export
export const logger = Logger.getInstance();
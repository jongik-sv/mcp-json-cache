/**
 * JSON Cache MCP Server - Type Definitions
 * 데이터 모델 및 타입 정의
 */

// 로그 레벨 타입
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// JSON 소스 설정
export interface JsonSource {
  name: string;
  path: string;
  watch?: boolean;
  primary?: boolean;
}

// 캐시 설정
export interface CacheConfig {
  sources: Record<string, JsonSource>;
  options?: {
    autoReload?: boolean;
    cacheSize?: number;
    logLevel?: LogLevel;
    maxDepth?: number;
  };
}

// 캐시 통계 정보
export interface CacheStats {
  name: string;
  path: string;
  keys: number;
  size: number;
  loadedAt: Date;
  hits: number;
}

// 쿼리 결과
export interface QueryResult {
  source: string;
  key: string;
  value: any;
  found: boolean;
}

// MCP Tool 스키마 타입
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

// 웹 API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// 소스 목록 API 응답
export interface SourcesResponse {
  sources: CacheStats[];
  total: number;
  memoryUsage: number;
}

// 키 목록 API 응답
export interface KeysResponse {
  source?: string;
  keys: string[];
  total: number;
  prefix?: string;
}

// 전체 통계 API 응답
export interface StatsResponse {
  totalSources: number;
  totalKeys: number;
  memoryUsage: number;
  cacheHitRate: number;
  uptime: number;
  lastReload?: string;
}

// 에러 타입
export class CacheError extends Error {
  constructor(
    message: string,
    public code: string,
    public source?: string
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export class ConfigError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// 내부 캐시 데이터 타입
export interface CacheData {
  [key: string]: any;
}

// 파일 감시 이벤트 타입
export interface FileWatchEvent {
  type: 'change' | 'add' | 'unlink';
  path: string;
  source: string;
  timestamp: Date;
}

// 리로드 결과 타입
export interface ReloadResult {
  source: string;
  success: boolean;
  error?: string;
  keys: number;
  size: number;
  duration: number;
}
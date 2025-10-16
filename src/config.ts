/**
 * Configuration Manager
 * 환경변수 파싱 및 설정 파일 로드
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CacheConfig, JsonSource, ConfigError } from './types.js';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: CacheConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 설정 로드 (우선순위: 환경변수 > 설정파일 > 기본값)
   */
  public async loadConfig(): Promise<CacheConfig> {
    try {
      // 1. 환경변수에서 설정 파싱
      const envConfig = this.parseEnvironmentVariables();

      if (envConfig) {
        this.config = envConfig;
        return envConfig;
      }

      // 2. 설정 파일 로드
      const fileConfig = this.loadConfigFile();

      if (fileConfig) {
        this.config = fileConfig;
        return fileConfig;
      }

      // 3. 기본 설정 반환
      this.config = this.getDefaultConfig();
      return this.config;

    } catch (error) {
      throw new ConfigError(
        `설정 로드 실패: ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_LOAD_ERROR'
      );
    }
  }

  /**
   * 현재 설정 반환
   */
  public getConfig(): CacheConfig | null {
    return this.config;
  }

  /**
   * 환경변수 파싱
   * 우선순위: JSON_SOURCES > JSON_FILES > JSON_FILE
   */
  private parseEnvironmentVariables(): CacheConfig | null {
    // JSON_SOURCES (name:path;name:path 형식)
    const jsonSources = process.env.JSON_SOURCES;
    if (jsonSources) {
      return this.parseJsonSources(jsonSources);
    }

    // JSON_FILES (path;path;path 형식, 자동 이름 생성)
    const jsonFiles = process.env.JSON_FILES;
    if (jsonFiles) {
      return this.parseJsonFiles(jsonFiles);
    }

    // JSON_FILE (단일 파일, 하위 호환성)
    const jsonFile = process.env.JSON_FILE;
    if (jsonFile) {
      return this.parseJsonFile(jsonFile);
    }

    return null;
  }

  /**
   * 환경변수에서 maxDepth 값 읽기
   */
  private getMaxDepthFromEnv(): number {
    const maxDepth = process.env.MAX_DEPTH;
    if (maxDepth) {
      const parsed = parseInt(maxDepth, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return 2; // 기본값
  }

  /**
   * JSON_SOURCES 환경변수 파싱 (name:path;name:path)
   */
  private parseJsonSources(jsonSources: string): CacheConfig {
    const sources: Record<string, JsonSource> = {};
    const entries = jsonSources.split(';');

    entries.forEach((entry, index) => {
      const trimmed = entry.trim();
      if (!trimmed) return;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) {
        throw new ConfigError(
          `JSON_SOURCES 형식 오류: ${trimmed} (name:path 형식이어야 함)`,
          'INVALID_FORMAT'
        );
      }

      const name = trimmed.substring(0, colonIndex).trim();
      const path = trimmed.substring(colonIndex + 1).trim();

      if (!name || !path) {
        throw new ConfigError(
          `JSON_SOURCES 형식 오류: ${trimmed} (name과 path가 비어있음)`,
          'INVALID_FORMAT'
        );
      }

      sources[name] = {
        name,
        path,
        watch: true,
        primary: index === 0 // 첫 번째 소스를 primary로 설정
      };
    });

    return {
      sources,
      options: {
        autoReload: true,
        logLevel: 'info',
        maxDepth: this.getMaxDepthFromEnv()
      }
    };
  }

  /**
   * JSON_FILES 환경변수 파싱 (path;path;path, 자동 이름 생성)
   */
  private parseJsonFiles(jsonFiles: string): CacheConfig {
    const sources: Record<string, JsonSource> = {};
    const paths = jsonFiles.split(';');

    paths.forEach((path, index) => {
      const trimmed = path.trim();
      if (!trimmed) return;

      const name = this.generateSourceName(trimmed, index);

      sources[name] = {
        name,
        path: trimmed,
        watch: true,
        primary: index === 0
      };
    });

    return {
      sources,
      options: {
        autoReload: true,
        logLevel: 'info',
        maxDepth: this.getMaxDepthFromEnv()
      }
    };
  }

  /**
   * JSON_FILE 환경변수 파싱 (단일 파일)
   */
  private parseJsonFile(jsonFile: string): CacheConfig {
    const name = this.generateSourceName(jsonFile, 0);

    return {
      sources: {
        [name]: {
          name,
          path: jsonFile,
          watch: true,
          primary: true
        }
      },
      options: {
        autoReload: true,
        logLevel: 'info',
        maxDepth: this.getMaxDepthFromEnv()
      }
    };
  }

  /**
   * 소스 이름 자동 생성
   */
  private generateSourceName(filePath: string, index: number): string {
    const fileName = filePath.split(/[\\/]/).pop() || `file${index}`;
    const baseName = fileName.replace(/\.(json|js|ts)$/, '');

    // 영문과 숫자만 남기고 소문자로 변환
    const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    return cleanName || `source${index}`;
  }

  /**
   * 설정 파일 로드
   */
  private loadConfigFile(): CacheConfig | null {
    const configPath = join(process.cwd(), 'config', 'default.json');

    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const fileContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(fileContent) as CacheConfig;

      this.validateConfig(config);
      return config;

    } catch (error) {
      throw new ConfigError(
        `설정 파일 로드 실패 (${configPath}): ${error instanceof Error ? error.message : String(error)}`,
        'CONFIG_FILE_ERROR'
      );
    }
  }

  /**
   * 기본 설정 반환
   */
  private getDefaultConfig(): CacheConfig {
    return {
      sources: {
        'default': {
          name: 'default',
          path: './data.json',
          watch: true,
          primary: true
        }
      },
      options: {
        autoReload: true,
        cacheSize: 1000,
        logLevel: 'info',
        maxDepth: this.getMaxDepthFromEnv()
      }
    };
  }

  /**
   * 설정 검증
   */
  private validateConfig(config: CacheConfig): void {
    if (!config.sources || typeof config.sources !== 'object') {
      throw new ConfigError('sources 필드가 필요합니다', 'INVALID_CONFIG');
    }

    const sourceEntries = Object.entries(config.sources);
    if (sourceEntries.length === 0) {
      throw new ConfigError('최소 하나의 소스가 필요합니다', 'INVALID_CONFIG');
    }

    let primaryCount = 0;

    sourceEntries.forEach(([name, source]) => {
      if (!source.name || !source.path) {
        throw new ConfigError(
          `소스 ${name}에 name 또는 path가 없습니다`,
          'INVALID_SOURCE'
        );
      }

      if (source.primary) {
        primaryCount++;
      }
    });

    // primary 소스가 없으면 첫 번째 소스를 primary로 설정
    if (primaryCount === 0 && sourceEntries.length > 0) {
      const [firstName] = sourceEntries[0];
      config.sources[firstName].primary = true;
    }
  }

  /**
   * 웹 서버 설정 반환
   */
  public getWebConfig() {
    return {
      enabled: process.env.WEB_ENABLED !== 'false',
      port: parseInt(process.env.WEB_PORT || '6315', 10),
      host: process.env.WEB_HOST || 'localhost'
    };
  }
}

// 싱글톤 인스턴스 export
export const configManager = ConfigManager.getInstance();
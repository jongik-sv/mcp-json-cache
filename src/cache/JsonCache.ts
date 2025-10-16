/**
 * JsonCache - 단일 JSON 파일 캐시 클래스
 * JSON 파일 로드 및 중첩 키 접근 기능 제공
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { CacheData, CacheStats, CacheError } from '../types.js';

export class JsonCache {
  private name: string;
  private path: string;
  private data: CacheData = {};
  private stats: CacheStats;
  private loadedAt: Date | null = null;

  constructor(name: string, path: string) {
    this.name = name;
    this.path = path;

    this.stats = {
      name,
      path,
      keys: 0,
      size: 0,
      loadedAt: new Date(),
      hits: 0
    };
  }

  /**
   * JSON 파일 로드
   */
  public async load(): Promise<void> {
    try {
      // 파일 존재 확인
      if (!existsSync(this.path)) {
        throw new CacheError(
          `파일을 찾을 수 없습니다: ${this.path}`,
          'FILE_NOT_FOUND',
          this.name
        );
      }

      // 파일 크기 확인
      const fileStat = statSync(this.path);
      const fileSizeInBytes = fileStat.size;

      // 파일 크기 제한 (50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (fileSizeInBytes > maxSize) {
        throw new CacheError(
          `파일 크기가 너무 큽니다: ${Math.round(fileSizeInBytes / 1024 / 1024)}MB (최대 50MB)`,
          'FILE_TOO_LARGE',
          this.name
        );
      }

      // 파일 읽기
      const fileContent = readFileSync(this.path, 'utf-8');

      // JSON 파싱
      let parsedData: any;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new CacheError(
          `JSON 파싱 실패: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          'JSON_PARSE_ERROR',
          this.name
        );
      }

      // 데이터가 객체인지 확인
      if (typeof parsedData !== 'object' || parsedData === null) {
        throw new CacheError(
          'JSON 파일은 객체를 포함해야 합니다',
          'INVALID_JSON_FORMAT',
          this.name
        );
      }

      // 데이터 설정
      this.data = parsedData;
      this.loadedAt = new Date();

      // 통계 정보 업데이트
      this.stats.keys = this.countKeys(this.data);
      this.stats.size = fileSizeInBytes;
      this.stats.loadedAt = this.loadedAt;

    } catch (error) {
      // 이미 CacheError인 경우 그대로 전달
      if (error instanceof CacheError) {
        throw error;
      }

      // 기타 에러는 CacheError로 래핑
      throw new CacheError(
        `파일 로드 실패: ${error instanceof Error ? error.message : String(error)}`,
        'LOAD_ERROR',
        this.name
      );
    }
  }

  /**
   * 키로 값 검색 (대소문자 무시, b17. 접두사 자동 처리)
   */
  public get(key: string): any | undefined {
    try {
      this.stats.hits++;

      // 모든 키 목록 가져오기
      const allKeys = this.keys();

      // 1. 정확히 일치하는 키 찾기 (대소문자 무시)
      let matchedKey = allKeys.find(k => k.toLowerCase() === key.toLowerCase());
      if (matchedKey) {
        return this.resolveNestedKey(matchedKey, this.data);
      }

      // 2. b17. 접두사 추가해서 찾기 (대소문자 무시)
      if (!key.toLowerCase().startsWith('b17.')) {
        const keyWithPrefix = 'b17.' + key;
        matchedKey = allKeys.find(k => k.toLowerCase() === keyWithPrefix.toLowerCase());
        if (matchedKey) {
          return this.resolveNestedKey(matchedKey, this.data);
        }
      }

      // 3. b17. 접두사 제거해서 찾기 (대소문자 무시)
      if (key.toLowerCase().startsWith('b17.')) {
        const keyWithoutPrefix = key.substring(4);
        matchedKey = allKeys.find(k => k.toLowerCase() === keyWithoutPrefix.toLowerCase());
        if (matchedKey) {
          return this.resolveNestedKey(matchedKey, this.data);
        }
      }

      // 4. 원래 키로 마지막 시도
      return this.resolveNestedKey(key, this.data);

    } catch (error) {
      // 키 해석 오류는 undefined 반환
      return undefined;
    }
  }

  /**
   * 키 존재 여부 확인
   */
  public has(key: string): boolean {
    try {
      const value = this.resolveNestedKey(key, this.data);
      return value !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * 모든 키 목록 반환
   * @param maxDepth 최대 깊이 (옵션, 지정하지 않으면 모든 깊이)
   */
  public keys(maxDepth?: number): string[] {
    return this.extractKeys(this.data, '', 0, maxDepth);
  }

  /**
   * 키 검색 (정확히 일치 또는 포함)
   */
  public search(pattern: string, mode: 'exact' | 'contains' = 'exact'): any[] {
    const allKeys = this.keys();
    const matchedKeys: string[] = [];

    if (mode === 'exact') {
      // 정확히 일치하는 키 찾기
      for (const key of allKeys) {
        if (key === pattern) {
          matchedKeys.push(key);
        }
      }
    } else {
      // 패턴을 포함하는 키 찾기
      for (const key of allKeys) {
        if (key.includes(pattern)) {
          matchedKeys.push(key);
        }
      }
    }

    // 결과 반환
    return matchedKeys.map(key => ({
      key,
      value: this.get(key)
    }));
  }

  /**
   * 캐시 통계 정보 반환
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 캐시 이름 반환
   */
  public getName(): string {
    return this.name;
  }

  /**
   * 파일 경로 반환
   */
  public getPath(): string {
    return this.path;
  }

  /**
   * 로드된 시간 반환
   */
  public getLoadedAt(): Date | null {
    return this.loadedAt;
  }

  /**
   * 캐시가 로드되었는지 확인
   */
  public isLoaded(): boolean {
    return this.loadedAt !== null;
  }

  /**
   * 캐시 데이터 초기화
   */
  public clear(): void {
    this.data = {};
    this.loadedAt = null;
    this.stats.keys = 0;
    this.stats.size = 0;
    this.stats.hits = 0;
  }

  /**
   * 중첩 키 해석 (점(.)을 포함하는 키도 지원)
   * 우선순위:
   * 1. 키 전체가 직접 존재하는지 확인 (data[key])
   * 2. 첫 번째 점으로 분리해서 접근 (data[firstKey][remainingKey])
   * 3. 모든 점으로 분리해서 순차 접근 (data[key1][key2][key3]...)
   */
  private resolveNestedKey(key: string, data: any): any {
    if (!key || typeof key !== 'string') {
      throw new Error('유효한 키가 필요합니다');
    }

    // 1. 키 전체가 직접 있는지 먼저 확인 (가장 빠른 경로)
    if (data.hasOwnProperty(key)) {
      return data[key];
    }

    // 2. 첫 번째 점으로 분리해서 접근 시도
    // 예: "b17.B17R2010.select" → data["b17"]["B17R2010.select"]
    const firstDot = key.indexOf('.');
    if (firstDot > 0) {
      const firstKey = key.substring(0, firstDot);
      const remainingKey = key.substring(firstDot + 1);

      if (data.hasOwnProperty(firstKey)) {
        const firstValue = data[firstKey];
        if (firstValue && typeof firstValue === 'object') {
          // 남은 키도 직접 확인
          if (firstValue.hasOwnProperty(remainingKey)) {
            return firstValue[remainingKey];
          }
          // 남은 키를 재귀적으로 처리
          return this.resolveNestedKey(remainingKey, firstValue);
        }
      }
    }

    // 3. 모든 점으로 분리해서 순차 접근 시도
    // 예: "a.b.c" → data["a"]["b"]["c"]
    const keys = key.split('.');
    let current = data;

    for (const keyPart of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current !== 'object') {
        return undefined;
      }

      if (!current.hasOwnProperty(keyPart)) {
        return undefined;
      }

      current = current[keyPart];
    }

    return current;
  }

  /**
   * 객체의 모든 키 추출 (재귀적)
   * @param obj 대상 객체
   * @param prefix 키 접두사
   * @param depth 현재 깊이 (0부터 시작)
   * @param maxDepth 최대 깊이 (옵션, undefined면 제한 없음)
   */
  private extractKeys(obj: any, prefix: string, depth: number = 0, maxDepth?: number): string[] {
    const keys: string[] = [];

    if (obj === null || typeof obj !== 'object') {
      return keys;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        keys.push(fullKey);

        // maxDepth가 지정되고 현재 depth가 maxDepth-1에 도달하면 재귀 중단
        // (depth는 0부터 시작하므로, maxDepth=2면 depth 0, 1까지만 탐색)
        const shouldRecurse = maxDepth === undefined || depth < maxDepth - 1;

        // 재귀적으로 중첩 객체의 키도 추출 (깊이 제한 적용)
        if (shouldRecurse && typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          keys.push(...this.extractKeys(obj[key], fullKey, depth + 1, maxDepth));
        }
      }
    }

    return keys;
  }

  /**
   * 객체의 총 키 개수 계산
   */
  private countKeys(obj: any): number {
    if (obj === null || typeof obj !== 'object') {
      return 0;
    }

    let count = 0;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        count++;

        // 재귀적으로 중첩 객체의 키도 계산
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          count += this.countKeys(obj[key]);
        }
      }
    }

    return count;
  }

  /**
   * 메모리 사용량 추정 (바이트 단위)
   */
  public estimateMemoryUsage(): number {
    try {
      const jsonString = JSON.stringify(this.data);
      return Buffer.byteLength(jsonString, 'utf-8');
    } catch (error) {
      // 직렬화 실패 시 기본값 반환
      return this.stats.size;
    }
  }

  /**
   * 캐시 데이터 복제본 반환 (안전한 접근)
   */
  public clone(): CacheData {
    try {
      return JSON.parse(JSON.stringify(this.data));
    } catch (error) {
      // 복제 실패 시 빈 객체 반환
      return {};
    }
  }
}
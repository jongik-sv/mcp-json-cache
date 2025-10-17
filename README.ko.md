# MCP JSON 캐시 서버

고성능 MCP (Model Context Protocol) 서버로, JSON 파일을 메모리에 캐싱하여 빠른 키 기반 조회를 제공합니다. 특히 레거시 시스템 분석 및 반복적인 JSON 데이터 접근 패턴에 최적화되어 있습니다.

## 기능

- ⚡ **빠른 메모리 캐싱**: 키 조회 시 밀리초 단위 응답 시간
- 🔑 **중첩 키 접근**: 점 표기법 지원 (`user.profile.name`)
- 📁 **다중 소스 지원**: 여러 JSON 파일을 동시에 캐싱
- 🔄 **자동 리로드**: 파일 변경 시 자동 캐시 새로고침
- 🌐 **웹 관리 UI**: 모니터링 및 관리를 위한 내장 대시보드
- 🛡️ **오류 내성**: 실패한 소스가 다른 캐시 데이터에 영향주지 않음
- 📊 **통계**: 성능 메트릭 및 캐시 히트 추적

## 빠른 시작

### 1. 설치

```bash
git clone <repository-url>
cd mcp-json-cache
npm install
```

### 2. 빌드

```bash
npm run build
```

### 3. 기본 사용법

```bash
# 테스트용 JSON 파일 생성
echo {"test": "value", "foo": "bar"} > test.json

# 환경변수 설정 및 실행
set JSON_FILE=test.json
npm start
```

### 4. 웹 UI 접속

브라우저에서 다음 주소 열기:
```
http://localhost:6315
```

## 설치 및 설정

### 사전 요구사항

- Node.js 16+
- npm 또는 yarn

### 개발 환경 설정

```bash
# 리포지토리 복제
git clone <repository-url>
cd mcp-json-cache

# 의존성 설치
npm install

# 개발 모드 (TypeScript 포함)
npm run dev

# 감시 모드 (변경 시 자동 재컴파일)
npm run watch
```

### 프로덕션 빌드

```bash
# TypeScript를 JavaScript로 컴파일
npm run build

# 컴파일된 버전 실행
npm start
```

## 설정

### 환경변수

환경변수를 사용하여 설정 (우선순위 순):

#### 단일 JSON 파일
```bash
set JSON_FILE=./path/to/your/file.json
```

#### 여러 JSON 파일 (자동 이름 지정)
```bash
set JSON_FILES=./queries.json;./procedures.json;./codes.json
```

#### 여러 명명된 소스 (권장)
```bash
set JSON_SOURCES=queries:C:/data/queries.json;procedures:C:/data/procedures.json;codes:C:/data/codes.json
```

#### 웹 서버 옵션
```bash
# 웹 서버 비활성화
set WEB_ENABLED=false

# 포트 변경 (기본값: 6315, 사용 중이면 자동으로 다음 포트 시도)
set WEB_PORT=3000

# 호스트 변경 (기본값: localhost)
set WEB_HOST=0.0.0.0

# 로그 레벨 (debug, info, warn, error)
set LOG_LEVEL=info
```

### 설정 파일

영구적인 설정을 위해 `config/default.json` 생성:

```json
{
  "sources": {
    "queries": {
      "path": "./data/queries.json",
      "watch": true,
      "primary": true
    },
    "procedures": {
      "path": "./data/procedures.json",
      "watch": true,
      "primary": false
    }
  },
  "options": {
    "autoReload": true,
    "cacheSize": 1000,
    "logLevel": "info"
  },
  "web": {
    "enabled": true,
    "port": 6315,
    "host": "localhost"
  }
}
```

## 사용 예제

### 예제 1: 레거시 데이터베이스 분석

```bash
# 레거시 시스템 분석 설정
set JSON_SOURCES=queries:C:/legacy/complete_query_index.json;procedures:C:/legacy/aps_procedure.json;codes:C:/legacy/error_codes.json
npm start
```

### 예제 2: 다중 환경 설정

```json
{
  "sources": {
    "dev_queries": {
      "path": "./data/dev/queries.json",
      "watch": true,
      "primary": true
    },
    "prod_queries": {
      "path": "./data/prod/queries.json",
      "watch": false,
      "primary": false
    },
    "error_codes": {
      "path": "./data/error_codes.json",
      "watch": true
    }
  }
}
```

### 예제 3: 개발 환경 설정

```bash
# 핫 리로드로 개발 환경 설정
set JSON_SOURCES=test_data:./test-data/sample.json
set LOG_LEVEL=debug
set WEB_PORT=3000
npm run dev
```

## MCP 도구

### `query_json`

캐시된 JSON 데이터를 키로 조회하며 선택적으로 소스를 지정할 수 있습니다.

**파라미터:**
- `key` (필수): 조회할 키, 중첩 접근을 위해 점 표기법 지원
- `source` (선택): 특정 JSON 소스 이름

**예시:**
```javascript
// 기본 조회
await query_json({ key: "user.name" })

// 특정 소스에서 조회
await query_json({ key: "procedure.get_user", source: "procedures" })

// 중첩 접근
await query_json({ key: "database.connection.pool.max_connections" })
```

### `list_json_keys`

캐시된 JSON 소스에서 사용 가능한 키 목록을 표시합니다.

**파라미터:**
- `source` (선택): 특정 소스로 필터링
- `prefix` (선택): 접두사로 키 필터링

**예시:**
```javascript
// 모든 키 목록
await list_json_keys()

// 특정 소스의 키
await list_json_keys({ source: "queries" })

// 접두사가 있는 키
await list_json_keys({ prefix: "user." })
```

### `list_sources`

로드된 모든 JSON 소스와 통계를 표시합니다.

**반환값:** 소스 메타데이터 배열 포함:
- 소스 이름과 파일 경로
- 키 수와 파일 크기
- 로드 시간과 히트 수
- 감시 상태

## 웹 관리 UI

웹 인터페이스: `http://localhost:6315`

### 대시보드 탭

- **전체 통계**: 전체 소스, 키, 메모리 사용량, 캐시 히트율
- **소스 카드**: 리로드 컨트롤이 있는 개별 소스 상태
- **빠른 작업**: 모든 소스 리로드, 캐시 지우기, 로그 보기

### 소스 탭

- **소스 선택기**: 다른 JSON 소스 간 전환
- **키 검색**: 이름이나 접두사로 키 찾기
- **결과 테이블**: 검색이 포함된 페이지네이션된 키 목록
- **값 뷰어**: 모든 키 클릭 시 모달에서 JSON 값 보기

### 로그 탭

- **실시간 로그**: 서버 로그의 WebSocket 스트리밍
- **로그 필터링**: 레벨별 필터 (Debug, Info, Warn, Error)
- **자동 스크롤**: 새 로그 자동 추적
- **로그 지우기**: 로그 표시 정리

## Claude Code와 통합

`.claude/settings.local.json`에 추가:

```json
{
  "mcpServers": {
    "json-cache": {
      "command": "node",
      "args": ["C:/project/mcp-json-cache/dist/index.js"],
      "env": {
        "JSON_SOURCES": "queries:C:/path/to/queries.json;procedures:C:/path/to/procedures.json"
      }
    }
  }
}
```

### 확인 단계

1. **프로젝트 빌드:**
   ```bash
   npm run build
   ```

2. **MCP 서버 로드를 위해 Claude Code 재시작**

3. **연결 확인:**
   - Claude Code에서 `list_sources` 도구 사용
   - JSON 소스가 목록에 표시되는지 확인
   - `query_json`로 데이터 접근 테스트

## 아키텍처

### 컴포넌트 개요

```
┌─────────────────┐
│  Claude Code    │ (stdio를 통한 MCP 클라이언트)
└────────┬────────┘
         │ MCP 프로토콜
┌────────▼────────┐
│  MCP 서버       │ (stdio 전송)
└────────┬────────┘
         │
┌────────▼──────────┐
│  CacheManager     │ (다중 소스 조정)
└────────┬──────────┘
         │
    ┌────┴─────┬─────────┬─────────┐
    │          │         │         │
┌───▼───┐  ┌───▼──┐  ┌───▼──┐  ┌──▼──┐
│Cache1 │  │Cache2│  │Cache3│  │...  │ (개별 JSON 파일)
└───────┘  └──────┘  └──────┘  └─────┘
```

### 핵심 디자인 패턴

- **다중 소스 아키텍처**: 각 JSON 파일은 자체 캐시 인스턴스를 가짐
- **CacheManager 패턴**: 라우팅 및 통계를 위한 중앙 조정자
- **중첩 키 해결**: 깊은 객체 접근을 위한 재귀적 점 표기법 파싱
- **stdio 전송**: 표준 MCP 프로토콜 통신
- **오류 격리**: 실패한 소스가 전체 서버를 중단시키지 않음

## 성능

### 벤치마크

- **쿼리 응답 시간**: 일반적인 키 조회 <10ms
- **메모리 사용량**: 원본 JSON 파일 크기의 ~1.5배
- **시작 시간**: 10MB 전체 JSON 데이터 <100ms
- **동시 쿼리**: 100개 이상의 동시 요청 처리

### 최적화 팁

1. **기본 소스 사용**: 자주 접근하는 소스를 `"primary": true`로 표시
2. **파일 감시 활성화**: 자주 변경되는 파일에만 활성화
3. **메모리 사용량 모니터링**: 웹 대시보드로 소비량 추적
4. **키 접두사 필터링**: 결과 집합을 줄이기 위해 접두사 필터 사용

## 개발

### 프로젝트 구조

```
mcp-json-cache/
├── src/
│   ├── index.ts              # 메인 MCP 서버 진입점
│   ├── cache/
│   │   ├── JsonCache.ts      # 개별 JSON 파일 캐시
│   │   └── CacheManager.ts   # 다중 소스 조정자
│   ├── mcp/
│   │   └── tools.ts          # MCP 도구 구현
│   ├── web/
│   │   ├── server.ts         # 웹 UI 서버
│   │   └── routes/           # API 라우트
│   └── utils/
│       ├── logger.ts         # 구조화된 로깅
│       └── config.ts         # 설정 관리
├── config/
│   └── default.json          # 기본 설정
├── dist/                     # 컴파일된 JavaScript
└── package.json
```

### 스크립트

```bash
# 개발
npm run dev              # ts-node로 실행
npm run watch            # 자동 컴파일 감시 모드
npm run build            # dist/로 컴파일
npm start                # 컴파일된 버전 실행

# 웹 서버만 실행
npm run web              # 웹 관리 UI만 실행

# 테스트
npm test                 # 테스트 실행
npm run test:watch       # 감시 모드 테스트

# 린팅
npm run lint             # ESLint
npm run lint:fix         # 린팅 문제 자동 수정
```

### 웹 서버만 실행

MCP 서버 없이 웹 관리 UI만 실행하려면:

```bash
# JSON 파일 설정
set JSON_FILE=test.json

# 웹 서버만 실행
npm run web
```

그런 다음 웹 인터페이스 접속:
```
http://localhost:6315
```

### 새 기능 추가

1. **새 MCP 도구**: `src/mcp/tools.ts`에 추가
2. **웹 UI 라우트**: `src/web/routes/`에 추가
3. **캐시 기능**: `src/cache/` 클래스 확장
4. **설정**: `src/utils/config.ts` 업데이트

## 문제 해결

### 일반적인 문제

**서버가 시작되지 않을 때:**
- Node.js 16+가 설치되었는지 확인
- `npm install`이 성공적으로 완료되었는지 확인
- 서버는 포트가 사용 중이면 자동으로 다음 사용 가능한 포트를 찾습니다 (6315-6325)

**JSON 파일이 로드되지 않을 때:**
- 파일 경로가 정확하고 절대경로인지 확인
- 온라인 검증기로 JSON 문법 확인
- 파일 읽기 권한이 있는지 확인

**웹 UI에 접근할 수 없을 때:**
- `WEB_ENABLED=true` 확인 (기본값)
- 지정된 포트의 방화벽 설정 확인
- 서버가 성공적으로 시작되었는지 확인 (콘솔 로그 확인)

**MCP 도구가 작동하지 않을 때:**
- 서버가 실행 중인지 확인 (`npm start`)
- `.claude/settings.local.json`의 Claude Code 설정 확인
- 컴파일된 `dist/index.js`가 존재하는지 확인

### 디버그 모드

디버그 로깅 활성화:

```bash
set LOG_LEVEL=debug
npm start
```

상세 정보 표시:
- 설정 로딩
- JSON 파일 파싱
- 캐시 작업
- 웹 서버 요청
- MCP 도구 호출

### 로그 파일

- **콘솔 로그**: 실시간 서버 출력 (stderr)
- **웹 UI 로그**: `http://localhost:6315` 로그 탭에서 접근
- **오류 로그**: 파일 로드 실패 및 MCP 오류

## 기여

1. 리포지토리 포크
2. 기능 브랜치 생성: `git checkout -b feature-name`
3. 변경사항 적용 및 테스트 추가
4. 테스트 실행: `npm test`
5. 프로젝트 빌드: `npm run build`
6. 풀 리퀘스트 제출

## 라이선스

[여기에 라이선스 정보 추가]

## 지원

문제 및 질문이 있으시면:
- 문제 해결 섹션 확인
- 설정 예제 검토
- 상세 로그를 위해 디버그 모드 활성화
- 시스템 상태를 위해 웹 UI 대시보드 확인
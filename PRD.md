# JSON Cache MCP Server - Product Requirements Document

## 1. Project Overview

**Project Name**: JSON Cache MCP Server
**Version**: 1.0.0
**Purpose**: JSON 파일들을 메모리에 캐싱하여 Claude가 키값으로 빠르게 조회할 수 있는 MCP 서버

### Target Users
- Claude Code 사용자
- 레거시 시스템 분석 작업자
- 대량의 JSON 데이터를 반복 조회하는 개발자

### Core Value Proposition
- ⚡ 즉각적인 데이터 접근 (파일 I/O 제거)
- 🎯 다중 JSON 소스 통합 관리
- 🔄 자동 리로드로 데이터 최신성 유지
- 🧠 Claude의 컨텍스트 창 효율화

---

## 2. Functional Requirements

### Phase 1: MVP (Must Have)

#### FR-1.1: 다중 JSON 파일 로드
- **입력**: JSON 파일 경로 배열 (환경변수 또는 설정파일)
- **처리**: 각 파일을 메모리에 로드하고 소스명으로 인덱싱
- **예시**:
  ```json
  {
    "m17_query": "./db/m17_query.json",
    "m47_query": "./db/m47_query.json",
    "m30_query": "./db/m30_query.json",
    "m30_query": "./db/aps_query.json",
    "aps_procedure": "./db/aps_procedure.json"
  }
  ```

#### FR-1.2: 기본 조회 Tool (query_json)
**Parameters**:
- `key` (required): 조회할 키 값
- `source` (optional): JSON 소스명 (미지정 시 전체 검색)

**Response**:
- 성공: JSON 값 (문자열 포맷)
- 실패: 에러 메시지 및 가용 소스 목록

**Behavior**:
- 단일 소스 지정: 해당 소스에서만 검색
- 소스 미지정: 모든 소스를 순회하여 첫 번째 매칭 반환
- 중첩 키 지원: `user.profile.name` 형식

#### FR-1.3: 키 목록 Tool (list_json_keys)
**Parameters**:
- `source` (optional): 특정 소스의 키만 조회
- `prefix` (optional): 특정 접두사로 필터링

**Response**:
- 키 배열 (정렬됨)

---

### Phase 2: Enhanced (Should Have)

#### FR-2.1: 파일 변경 감지
- 로드된 JSON 파일 자동 감시
- 변경 감지 시 해당 소스만 리로드
- 리로드 실패 시 기존 캐시 유지

#### FR-2.2: 소스 관리
**Tool**: `list_sources`
**Response**:
```json
{
  "sources": [
    {
      "name": "queries",
      "path": "./complete_query_index.json",
      "keys": 1234,
      "size": "2.4MB",
      "loaded": "2025-10-16T10:30:00Z"
    }
  ]
}
```

#### FR-2.3: 웹 관리 페이지
**목적**: 캐시 상태 모니터링 및 관리를 위한 웹 UI

**기능**:
- 📊 **대시보드**
  - 로드된 소스 목록 (이름, 경로, 키 개수, 크기, 로드 시간)
  - 전체 통계 (총 소스 수, 총 키 개수, 메모리 사용량)
  - 캐시 히트율 및 조회 통계

- 🔍 **키 검색 및 조회**
  - 소스별 키 목록 표시
  - 키 검색 (prefix 필터링)
  - 키 값 조회 및 JSON 포맷팅

- 🔄 **소스 관리**
  - 개별 소스 리로드 버튼
  - 전체 소스 리로드
  - 파일 변경 감지 상태 표시

- 📋 **실시간 로그**
  - 서버 로그 스트리밍 (WebSocket)
  - 로그 레벨 필터링
  - 로그 검색

**접근**:
- HTTP 서버: `http://localhost:6315` (설정 가능)
- 인증: 기본적으로 localhost만 허용 (v1.0)

**기술**:
- Backend: Express.js (REST API)
- Frontend: HTML + Vanilla JS (단순 UI) 또는 Vue.js
- WebSocket: Socket.io (실시간 로그)

---

### Phase 3: Advanced (Nice to Have)

#### FR-3.1: JSONPath 쿼리
- `query_json`에 `jsonpath` 파라미터 추가
- 복잡한 쿼리 지원: `$.queries[?(@.type == 'SELECT')]`

#### FR-3.2: Resource 인터페이스
**URI Pattern**: `json://{source}/{key}`
**Example**: `json://queries/M472020014111`

#### FR-3.3: 성능 모니터링
**Tool**: `json_stats`
**Response**: 캐시 히트율, 메모리 사용량, 조회 통계

---

## 3. Technical Specifications

### Architecture
```
┌─────────────────┐           ┌──────────────────┐
│  Claude Code    │           │   Web Browser    │
└────────┬────────┘           └────────┬─────────┘
         │ MCP Protocol                │ HTTP/WS
┌────────▼────────┐           ┌────────▼─────────┐
│  MCP Server     │           │  Web Server      │
│  (stdio)        │           │  (Express)       │
└────────┬────────┘           └────────┬─────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
         ┌──────────▼──────────┐
         │    JsonCache        │
         │    Manager          │◄──────┐
         └──────────┬──────────┘       │
                    │              ┌───┴──────┐
         ┌──────────┴──────┐       │FileWatch │
         │                 │       │  er      │
    ┌────▼─────┬──────┬───▼───┐   └──────────┘
    │          │      │       │
┌───▼───┐  ┌───▼──┐ ┌─▼──┐ ┌─▼──┐
│Cache 1│  │Cache2│ │... │ │CacheN│
└───────┘  └──────┘ └────┘ └────┘
```

### Technology Stack
- **Runtime**: Node.js 20.x
- **Language**: TypeScript 5.x
- **Core**: `@modelcontextprotocol/sdk` ^1.0.0
- **Web Server**:
  - `express` ^4.18.0 (HTTP 서버)
  - `socket.io` ^4.6.0 (실시간 로그)
- **Optional**:
  - `jsonpath-plus` ^7.0.0 (JSONPath)
  - `chokidar` ^3.5.0 (파일 감시)
  - `lru-cache` ^10.0.0 (최적화)

### Configuration Schema
```json
{
  "sources": {
    "queries": {
      "path": "./complete_query_index.json",
      "watch": true,
      "primary": true
    },
    "legacy": {
      "path": "./legacy_index.json",
      "watch": false
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

### Environment Variables
```bash
# 단일 파일 (하위 호환)
JSON_FILE=./data.json

# 다중 파일 (배열, 세미콜론 구분)
JSON_FILES=./queries.json;./legacy.json;./codes.json

# 또는 소스명 포함 (콜론 구분)
JSON_SOURCES=queries:./queries.json;legacy:./legacy.json

# 웹 서버 설정
WEB_ENABLED=true
WEB_PORT=6315
WEB_HOST=localhost
```

---

## 4. Non-Functional Requirements

### Performance
- 조회 응답 시간: < 10ms (캐시 히트)
- 메모리 사용: JSON 파일 크기의 1.5배 이하
- 파일 리로드: < 1초 (10MB 파일 기준)

### Reliability
- 24시간 연속 운영 가능
- 파일 리로드 실패 시 기존 캐시 유지
- 잘못된 JSON 파일 무시 (다른 소스는 정상 동작)

### Scalability
- 최대 10개 JSON 소스 동시 로드
- 단일 JSON 파일 최대 50MB
- 총 캐시 크기 최대 500MB

### Usability
- 명확한 에러 메시지
- 로그를 통한 디버깅 지원
- 설정 파일 검증

---

## 5. Success Metrics

### Quantitative
- 파일 읽기 호출 90% 감소
- 평균 조회 시간 < 10ms
- 캐시 히트율 > 95%

### Qualitative
- 레거시 분석 워크플로우 통합
- Claude Code 사용자 피드백 긍정적
- 설정 및 사용 용이성

---

## 6. Out of Scope (v1.0)

- ❌ JSON 데이터 쓰기/수정 기능
- ❌ 네트워크를 통한 JSON 로드
- ❌ 데이터베이스 연동
- ❌ 인증/권한 관리
- ❌ 분산 캐싱

---

## 7. Future Roadmap (v2.0+)

- JSON Schema 검증
- GraphQL 스타일 쿼리
- 압축 및 스트리밍
- 웹 대시보드
- 다른 포맷 지원 (YAML, TOML)

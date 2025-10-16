# JSON Cache MCP Server - 구현 계획 (화면 중심)

## 프로젝트 개요

**프로젝트명**: mcp-json-cache
**목표**: 다중 JSON 파일을 메모리에 캐싱하여 Claude가 키값으로 빠르게 조회할 수 있는 MCP 서버
**버전**: 1.0.0

### 핵심 아키텍처
- **3-Tier Architecture**: Claude Code (MCP Client) + MCP Server (stdio) + JsonCache Manager
- **화면 중심 개발**: MCP Tool + Web UI 통합 개발 구조
- **기술 스택**: Node.js 20.x, TypeScript 5.x, Express.js, Socket.io, @modelcontextprotocol/sdk

### 개발 목표
- ⚡ 즉각적인 데이터 접근 (파일 I/O 제거, < 10ms 조회)
- 🎯 다중 JSON 소스 통합 관리 (최대 10개 소스, 500MB 캐시)
- 🔄 자동 리로드로 데이터 최신성 유지
- 🧠 Claude의 컨텍스트 창 효율화

---

## 1단계: 시스템 공통 기능

### [x] 1. 프로젝트 초기화 및 환경 설정
  - [ ] 1.1 프로젝트 구조 생성
    - 디렉토리 구조: src/, public/, config/, examples/, dist/
    - TypeScript 설정 (tsconfig.json)
    - 빌드 스크립트配置 (package.json)
  - [ ] 1.2 의존성 설치
    - 핵심: @modelcontextprotocol/sdk, express, socket.io
    - 개발: typescript, @types/node, ts-node
    - 선택: chokidar, jsonpath-plus
  - [ ] 1.3 개발 환경 설정
    - ESLint, Prettier 설정
    - Git 설정 (.gitignore)
    - 빌드 및 개발 스크립트
  _요구사항: FR-1.1_
  _참고: PRD.md 기술 명세_

### [x] 2. 핵심 캐싱 엔진 구현
  - [ ] 2.1 데이터 모델 및 타입 정의
    - JsonSource, CacheConfig, CacheStats 인터페이스
    - MCP Tool 스키마 정의
    - 웹 API 응답 타입 정의
  - [ ] 2.2 설정 관리 시스템
    - 환경변수 파싱 (JSON_SOURCES, JSON_FILES, JSON_FILE)
    - 설정 파일 로드 (config/default.json)
    - 설정 검증 및 기본값 처리
  - [ ] 2.3 JsonCache 클래스 구현
    - JSON 파일 로드 및 파싱
    - 중첩 키 접근 (dot notation)
    - 통계 수집 (hit count, load time)
  - [ ] 2.4 CacheManager 클래스 구현
    - 다중 소스 관리
    - 소스별 캐시 조율
    - 전역 검색 로직
  _요구사항: FR-1.1, FR-1.2, FR-1.3_
  _참고: PRD.md 아키텍처 다이어그램_

### [x] 3. 로깅 및 에러 핸들링 시스템
  - [ ] 3.1 Logger 유틸리티 구현
    - 로그 레벨 필터링 (debug, info, warn, error)
    - stderr 전용 출력 (MCP stdio 호환)
    - 타임스탬프 및 구조화 로그
  - [ ] 3.2 에러 핸들링 프레임워크
    - 커스텀 에러 클래스 정의
    - 그레이스풀 디그레이션 (일부 소스 실패 시 다른 소스 정상 동작)
    - 에러 복구 전략
  _요구사항: PRD.md 신뢰성 요구사항_
  _참고: 개발 노트 - stdio 및 로깅_

---

## 2단계: MCP Tool 화면 구현

### [x] 4. query_json Tool 구현
  - [ ] 4.1 Backend API 구현
    - MCP Tool 스키마 정의 (key, source, jsonpath 파라미터)
    - CacheManager 연동 로직
    - 결과 포맷팅 (JSON → 가독성 문자열)
    - 에러 처리 (키 없음, 소스 없음)
  - [ ] 4.2 Tool 핸들러 구현
    - 소스 지정 검색 로직
    - 전체 소스 순회 검색 (primary 우선)
    - 중첩 키 해석 (user.profile.name)
  - [ ] 4.3 검증 및 테스트
    - 단일 소스 조회 테스트
    - 다중 소스 검색 테스트
    - 응답 시간 측정 (< 10ms)
  _요구사항: FR-1.2_
  _참고: MCP Tools 섹션_

### [x] 5. list_json_keys Tool 구현
  - [ ] 5.1 Backend API 구현
    - MCP Tool 스키마 정의 (source, prefix 파라미터)
    - 키 목록 추출 및 정렬
    - prefix 필터링 로직
    - 결과 제한 (최대 500개)
  - [ ] 5.2 성능 최적화
    - 대용량 키 목록 처리
    - 메모리 효율적 순회
    - 캐싱 전략
  _요구사항: FR-1.3_
  _참고: MCP Tools 섹션_

### [x] 6. list_sources Tool 구현
  - [ ] 6.1 Backend API 구현
    - 소스 메타데이터 수집 (name, path, keys, size, loadedAt, hits)
    - 통계 정보 집계
    - JSON 응답 포맷팅
  - [ ] 6.2 실시간 정보 업데이트
    - 통계 데이터 동기화
    - 메모리 사용량 모니터링
    - 캐시 히트율 계산
  _요구사항: FR-2.2_
  _참고: MCP Tools 섹션_

---

## 3단계: 웹 관리 화면 구현

### [x] 7. 웹 서버 기반 구축
  - [ ] 7.1 Backend API 구현
    - Express.js 서버 설정 (포트 6315)
    - CORS 및 보안 설정 (localhost만 허용)
    - 미들웨어 구성 (logging, error handling)
    - 환경변수 처리 (WEB_ENABLED, WEB_PORT, WEB_HOST)
  - [ ] 7.2 REST API 엔드포인트 구현
    - GET /api/sources - 소스 목록 및 통계
    - GET /api/sources/:name - 특정 소스 상세
    - GET /api/keys - 키 목록 (source, prefix 쿼리)
    - GET /api/query - 키 조회 (key, source 쿼리)
    - POST /api/reload/:name - 소스 리로드
    - POST /api/reload-all - 전체 리로드
    - GET /api/stats - 전체 통계
  - [ ] 7.3 WebSocket 연동
    - Socket.io 서버 설정
    - 실시간 로그 스트리밍 (log:new, log:clear 이벤트)
    - 상태 변경 알림
  _요구사항: FR-2.3 웹 관리 페이지_
  _참고: PRD.md 기술 명세 - 웹 서버_

### [x] 8. 대시보드 화면 구현
  - [ ] 8.1 Frontend UI 구현
    - HTML 시맨틱 구조
    - 반응형 레이아웃 (CSS Grid/Flexbox)
    - 탭 네비게이션 (Dashboard, Sources, Logs)
    - 모던 UI 프레임워크 적용
  - [ ] 8.2 대시보드 기능 구현
    - 전체 통계 표시 (총 소스 수, 총 키 개수, 메모리 사용량, 캐시 히트율)
    - 소스 목록 카드 형태 표시
    - 각 소스별 상세 정보 (키 수, 파일 크기, 로드 시간, 히트 수)
    - 리로드 버튼 기능
  - [ ] 8.3 데이터 시각화
    - 차트 라이브러리 연동 (선택)
    - 실시간 데이터 업데이트
    - 인터랙티브 요소 구현
  _요구사항: FR-2.3 대시보드 기능_
  _참고: PRD.md 웹 관리 페이지 레이아웃_

### [x] 9. 소스 관리 화면 구현
  - [ ] 9.1 Frontend UI 구현
    - 소스 선택 드롭다운
    - 키 검색 인터페이스
    - 검색 결과 테이블
    - 키 값 상세 조회 모달
  - [ ] 9.2 검색 및 조회 기능
    - 소스별 키 목록 표시
    - prefix 필터링 검색
    - 키 값 조회 및 JSON 포맷팅
    - 무한 스크롤 또는 페이지네이션
  - [ ] 9.3 상호작용 기능
    - 키 클릭 시 상세 정보 팝업
    - JSON 뷰어 (구문 강조, 축소/확장)
    - 복사 기능
    - 즐겨찾기 기능 (선택)
  _요구사항: FR-2.3 키 검색 및 조회_
  _참고: PRD.md 웹 관리 페이지 기능_

### [x] 10. 실시간 로그 화면 구현
  - [ ] 10.1 Frontend UI 구현
    - 로그 레벨 필터 (ALL, DEBUG, INFO, WARN, ERROR)
    - 로그 목록 가상 스크롤
    - 자동 스크롤 기능
    - 로그 검색 기능
  - [ ] 10.2 WebSocket 클라이언트 구현
    - Socket.io 클라이언트 연결
    - 실시간 로그 수신
    - 로그 레벨별 색상 표시
    - 로그 이벤트 핸들링
  - [ ] 10.3 로그 관리 기능
    - 로그 지우기 기능
    - 로그 내보내기 (선택)
    - 로그 레벨 변경
    - 타임스탬프 포맷팅
  _요구사항: FR-2.3 실시간 로그_
  _참고: PRD.md 웹 관리 페이지 기능_

---

## 4단계: 고급 기능 화면 구현

### [x] 11. 파일 변경 감지 시스템
  - [ ] 11.1 Backend 기능 구현
    - chokidar 파일 감시자 설정
    - JSON 파일 변경 이벤트 핸들러
    - CacheManager 리로드 트리거
    - 에러 핸들링 (리로드 실패 시 기존 캐시 유지)
  - [ ] 11.2 상태 관리
    - 파일 감시 상태 추적
    - 변경 이력 기록
    - 자동 리로드 토글
  - [ ] 11.3 웹 UI 연동
    - 실시간 상태 표시
    - 수동 리로드 버튼
    - 변경 알림 메시지
  _요구사항: FR-2.1 파일 변경 감지_
  _참고: PRD.md 고급 기능_

### [x] 13. Resource 인터페이스 구현
  - [ ] 13.1 Backend 기능 구현
    - URI 패턴 처리 (json://{source}/{key})
    - MCP Resource 등록
    - Resource 핸들러 구현
    - 캐싱 최적화
  - [ ] 13.2 테스트 및 검증
    - Resource 조회 테스트
    - 성능 벤치마킹
    - 호환성 검증
  _요구사항: FR-3.2 Resource 인터페이스_
  _참고: PRD.md Phase 3 고급 기능_

---

## 5단계: 통합 및 배포

### [x] 14. 예제 및 문서화
  - [ ] 14.1 예제 파일 생성
    - sample1.json (users 데이터)
    - sample2.json (products 데이터)
    - 대용량 테스트 파일 (선택)
  - [ ] 14.2 Claude Code 설정 예시
    - claude-config.json 예제
    - 환경변수 설정 가이드
    - MCP 서버 등록 절차
  - [ ] 14.3 README.md 작성
    - 프로젝트 소개 및 주요 기능
    - 설치 및 설정 방법
    - 사용 예시 및 Tool 레퍼런스
    - 트러블슈팅 가이드
  _요구사항: PRD.md 사용성 요구사항_
  _참고: CLAUDE.md Integration 섹션_

### [x] 15. 실제 데이터 테스트
  - [ ] 15.1 대용량 데이터 테스트
    - complete_query_index.json 로드 테스트
    - 실제 쿼리 ID로 조회 테스트
    - 다중 소스 검색 테스트
  - [ ] 15.2 성능 측정
    - 조회 응답 시간 측정 (< 10ms 목표)
    - 메모리 사용량 측정
    - 캐시 히트율 측정
  - [ ] 15.3 스트레스 테스트
    - 동시 요청 처리 테스트
    - 대용량 파일 로드 테스트
    - 장시간 운영 안정성 테스트
  _요구사항: PRD.md 성능 요구사항_
  _참고: 개발 노트 - 실제 데이터 테스트_

### [x] 16. 빌드 및 배포
  - [ ] 16.1 빌드 프로세스
    - TypeScript 컴파일 (npm run build)
    - dist 폴더 검증
    - 번들 크기 최적화
  - [ ] 16.2 Claude Code 통합
    - .claude/settings.local.json 설정
    - MCP 서버 등록
    - Claude Code 재시작 및 연결 확인
  - [ ] 16.3 최종 검증
    - MCP Tool 동작 검증 (list_sources 호출)
    - 웹 UI 접근 검증 (http://localhost:6315)
    - 전체 기능 통합 테스트
  _요구사항: PRD.md 성공 지표_
  _참고: CLAUDE.md Integration 섹션_

---

## 화면별 완성도 기준

### MCP Tool 화면 그룹 (4, 5, 6번)
- [ ] **Backend API**: MCP Tool 스키마 정의 및 핸들러 구현 완료
- [ ] **기능 동작**: Claude Code에서 3개 Tool 모두 정상 동작
- [ ] **성능 목표**: 조회 응답 시간 < 10ms 달성
- [ ] **에러 처리**: 예외 상황 처리 및 사용자 피드백

### 웹 관리 화면 그룹 (7, 8, 9, 10번)
- [ ] **Backend API**: REST API 엔드포인트 7개 모두 구현 완료
- [ ] **Frontend UI**: 3개 탭 (Dashboard, Sources, Logs) 완전 구현
- [ ] **실시간 기능**: WebSocket 연동 및 실시간 데이터 업데이트
- [ ] **사용자 경험**: 직관적인 인터페이스 및 반응형 디자인

### 고급 기능 화면 그룹 (11, 12, 13번)
- [ ] **자동화**: 파일 변경 감지 및 자동 리로드 기능
- [ ] **확장성**: JSONPath 쿼리 및 Resource 인터페이스 지원
- [ ] **최적화**: 성능 모니터링 및 캐싱 전략
- [ ] **안정성**: 에러 복구 및 그레이스풀 디그레이션

---

## 성공 지표

### 기능적 성공 기준
- [ ] 모든 MCP Tool 완성: 3개 핵심 Tool 구현 및 Claude Code 동작
- [ ] 웹 관리 UI 완성: 3개 탭 대시보드 완전 구현 및 동작
- [ ] CRUD 완전성: 모든 소스에서 데이터 조회 기능 동작
- [ ] 자동화 완성: 파일 변경 감지 및 자동 리로드 기능 동작

### 성능적 성공 기준
- [ ] 응답성: MCP Tool 조회 < 10ms, 웹 UI 로딩 < 2초
- [ ] 확장성: 최대 10개 JSON 소스, 500MB 캐시 지원
- [ ] 안정성: 24시간 연속 운영 가능, 99% 이상 가용성
- [ ] 효율성: 캐시 히트율 > 95%, 메모리 사용량 최적화

### 사용자 경험 기준
- [ ] 직관성: 최소한의 교육으로 MCP Tool 및 웹 UI 사용 가능
- [ **일관성**: 모든 화면에서 동일한 UI 패턴 및 인터랙션
- [ ] 접근성: 명확한 에러 메시지 및 로그를 통한 디버깅 지원
- [ ] 편의성: 다양한 설정 방법 (환경변수, 설정파일) 제공

---

## 🎯 마일스톤

### Milestone 1: MVP 완료 (1-6번, 4단계)
- **목표**: 핵심 MCP 기능 완성
- **완료조건**: Claude Code에서 3개 Tool 정상 동작
- **예상시간**: 5-7시간

### Milestone 2: Enhanced 완료 (7-10번, 4단계)
- **목표**: 웹 관리 UI 완성
- **완료조건**: http://localhost:6315에서 모든 기능 동작
- **예상시간**: 추가 3-4시간

### Milestone 3: Production Ready (11-16번, 5단계)
- **목표**: 고급 기능 및 실제 배포
- **완료조건**: 실제 데이터 테스트 통과 및 문서화 완료
- **예상시간**: 추가 2-3시간

---

## 📊 개발 리소스 추정

| 화면 그룹 | Task 수 | 예상 시간 | 우선순위 | 완료 기준 |
|-----------|---------|-----------|-----------|------------|
| 시스템 공통 | 3개 | 2-3시간 | P0 | 기반 아키텍처 완성 |
| MCP Tool | 3개 | 2-3시간 | P0 | Claude Code 동작 |
| 웹 관리 | 4개 | 3-4시간 | P1 | 대시보드 접근 가능 |
| 고급 기능 | 3개 | 2-3시간 | P2 | 자동화 기능 |
| 통합 배포 | 3개 | 1-2시간 | P1 | 실제 사용 가능 |

**총 예상**: 10-15시간
**MVP까지**: 7-10시간 (P0, P1 필수)
**전체 기능**: 12-18시간 (P2 포함)

---

## ✅ 최종 완료 조건

- [ ] 다중 JSON 파일 로드 및 소스별 관리 (FR-1.1)
- [ ] 키 기반 데이터 조회 및 중첩 키 지원 (FR-1.2)
- [ ] 키 목록 조회 및 필터링 (FR-1.3)
- [ ] Claude Code에서 3개 MCP Tool 정상 동작
- [ ] 파일 변경 감지 및 자동 리로드 (FR-2.1)
- [ ] 소스 관리 및 통계 정보 제공 (FR-2.2)
- [ ] 웹 관리 페이지 완전 구현 (FR-2.3)
- [ ] JSONPath 쿼리 지원 (FR-3.1)
- [ ] Resource 인터페이스 구현 (FR-3.2)
- [ ] 성능 목표 달성 (조회 < 10ms, 캐시 히트율 > 95%)
- [ ] 문서화 완료 및 실제 사용 예시 제공
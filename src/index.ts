/**
 * MCP JSON Cache Server - Main Entry Point
 * 메인 진입점 및 MCP Tool 핸들러 연동
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { CacheManager } from './cache/CacheManager.js';
import { configManager } from './config.js';
import { logger } from './utils/logger.js';
import { errorHandler, ErrorContext } from './utils/errors.js';
import { QueryJsonTool, createQueryJsonTool } from './tools/query.js';
import { ListJsonKeysTool, createListJsonKeysTool } from './tools/list-keys.js';
import { ListSourcesTool, createListSourcesTool } from './tools/list-sources.js';
import { WebServer } from './web/server.js';
import { FileWatcher } from './watcher/FileWatcher.js';
import { JsonResourceHandler } from './resources/json-resource.js';

class MCPCacheServer {
  private server: Server;
  private cacheManager: CacheManager;
  private queryTool: QueryJsonTool;
  private keysTool: ListJsonKeysTool;
  private sourcesTool: ListSourcesTool;
  private webServer?: WebServer;
  private fileWatcher?: FileWatcher;
  private resourceHandler?: JsonResourceHandler;
  private serverLogger = logger.withSource('MCP_SERVER');
  public logger = logger;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-json-cache',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        },
      }
    );

    this.cacheManager = new CacheManager();
    this.queryTool = createQueryJsonTool(this.cacheManager);
    this.keysTool = createListJsonKeysTool(this.cacheManager);
    this.sourcesTool = createListSourcesTool(this.cacheManager);

    this.setupHandlers();
  }

  /**
   * MCP 요청 핸들러 설정
   */
  private setupHandlers(): void {
    // Tool 목록 핸들러
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.serverLogger.debug('Tool 목록 요청');

      return {
        tools: [
          this.queryTool.getSchema(),
          this.keysTool.getSchema(),
          this.sourcesTool.getSchema()
        ]
      };
    });

    // Tool 실행 핸들러
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.serverLogger.info('Tool 실행 요청', { tool: name, args });

      try {
        switch (name) {
          case 'query_json':
            return await this.handleQueryJson(args);
          case 'list_json_keys':
            return await this.handleListJsonKeys(args);
          case 'list_sources':
            return await this.handleListSources(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        this.serverLogger.error('Tool 실행 실패', { tool: name, error });

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // Resource 목록 핸들러
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      this.serverLogger.debug('Resource 목록 요청');

      if (!this.resourceHandler) {
        return { resources: [] };
      }

      const templates = this.resourceHandler.getResourceTemplates();
      return {
        resources: templates.map(template => ({
          uri: template.uriTemplate,
          name: template.name,
          description: template.description,
          mimeType: template.mimeType
        }))
      };
    });

    // Resource 읽기 핸들러
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      this.serverLogger.info('Resource 읽기 요청', { uri });

      if (!this.resourceHandler) {
        throw new McpError(
          ErrorCode.InternalError,
          'Resource handler not initialized'
        );
      }

      try {
        const content = await this.resourceHandler.readResource(uri);
        return {
          contents: [
            {
              uri: content.uri,
              mimeType: content.mimeType,
              text: content.text
            }
          ]
        };
      } catch (error) {
        this.serverLogger.error('Resource 읽기 실패', { uri, error });
        throw new McpError(
          ErrorCode.InternalError,
          `Resource read failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  /**
   * query_json Tool 핸들러
   */
  private async handleQueryJson(args: any) {
    const context: ErrorContext = {
      operation: 'query_json',
      source: args?.source,
      requestId: `req_${Date.now()}`,
      metadata: args
    };

    try {
      const result = await this.queryTool.execute(args);
      return {
        content: [
          {
            type: 'text',
            text: this.formatQueryResult(result)
          }
        ]
      };
    } catch (error) {
      this.serverLogger.error('쿼리 실행 실패', { error, args });
      return {
        content: [
          {
            type: 'text',
            text: '쿼리 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
          }
        ]
      };
    }
  }

  /**
   * list_json_keys Tool 핸들러
   */
  private async handleListJsonKeys(args: any) {
    const context: ErrorContext = {
      operation: 'list_json_keys',
      source: args?.source,
      requestId: `req_${Date.now()}`,
      metadata: args
    };

    try {
      const result = await this.keysTool.execute(args);
      return {
        content: [
          {
            type: 'text',
            text: this.formatKeysResult(result)
          }
        ]
      };
    } catch (error) {
      this.serverLogger.error('키 목록 조회 실패', { error, args });
      return {
        content: [
          {
            type: 'text',
            text: '키 목록 조회 중 오류가 발생했습니다.'
          }
        ]
      };
    }
  }

  /**
   * list_sources Tool 핸들러
   */
  private async handleListSources(args: any) {
    const context: ErrorContext = {
      operation: 'list_sources',
      requestId: `req_${Date.now()}`,
      metadata: args
    };

    try {
      const result = await this.sourcesTool.execute(args);
      return {
        content: [
          {
            type: 'text',
            text: this.formatSourcesResult(result)
          }
        ]
      };
    } catch (error) {
      this.serverLogger.error('소스 목록 조회 실패', { error, args });
      return {
        content: [
          {
            type: 'text',
            text: '소스 목록 조회 중 오류가 발생했습니다.'
          }
        ]
      };
    }
  }

  /**
   * 쿼리 결과 포맷팅
   */
  private formatQueryResult(result: any): string {
    if (!result.success) {
      return `❌ 조회 실패: ${result.message}`;
    }

    const lines = [
      `✅ 조회 성공`,
      `소스: ${result.source}`,
      `키: ${result.key}`,
      `값: ${JSON.stringify(result.data, null, 2)}`
    ];

    return lines.join('\n');
  }

  /**
   * 키 목록 결과 포맷팅
   */
  private formatKeysResult(result: any): string {
    if (!result.success) {
      return `❌ 조회 실패: ${result.message}`;
    }

    const lines = [
      `✅ 키 목록 (${result.total}개${result.limited ? ' - 제한됨' : ''})`,
      result.source ? `소스: ${result.source}` : '',
      result.prefix ? `접두사: ${result.prefix}` : '',
      '',
      '키 목록:'
    ];

    result.keys.forEach((key: string, index: number) => {
      lines.push(`${index + 1}. ${key}`);
    });

    return lines.filter(line => line !== '').join('\n');
  }

  /**
   * 소스 목록 결과 포맷팅
   */
  private formatSourcesResult(result: any): string {
    if (!result.success) {
      return `❌ 조회 실패: ${result.message}`;
    }

    const lines = [
      `✅ 소스 목록 (${result.summary.loaded}/${result.summary.total} 로드됨)`,
      `전체 키: ${result.summary.totalKeys}개`,
      `전체 크기: ${result.summary.totalSizeFormatted}`,
      `캐시 히트율: ${result.summary.cacheHitRate.toFixed(1)}%`,
      `가동 시간: ${result.summary.uptimeFormatted}`,
      '',
      '소스 상세 정보:'
    ];

    result.sources.forEach((source: any, index: number) => {
      const status = source.isLoaded ? '✅' : '❌';
      const primary = source.isPrimary ? ' [PRIMARY]' : '';
      const watch = source.isWatchEnabled ? ' [WATCH]' : '';

      lines.push(`${index + 1}. ${status} ${source.name}${primary}${watch}`);
      lines.push(`   경로: ${source.path}`);
      lines.push(`   키: ${source.keys}개 (${source.sizeFormatted})`);
      lines.push(`   조회: ${source.hits}회`);
      if (source.loadedAtFormatted) {
        lines.push(`   로드: ${source.loadedAtFormatted}`);
      }
      lines.push('');
    });

    return lines.filter(line => line !== '').join('\n');
  }

  /**
   * 서버 시작
   */
  public async start(): Promise<void> {
    try {
      // 로그 레벨 설정
      logger.setLevel('info');

      // 설정 로드
      const config = await configManager.loadConfig();
      this.serverLogger.info('설정 로드 완료', { sources: Object.keys(config.sources).length });

      // 캐시 로드
      await this.cacheManager.loadAll(config);
      this.serverLogger.info('캐시 로드 완료', {
        loadedSources: this.cacheManager.getLoadedSources().length,
        totalKeys: this.cacheManager.getGlobalStats().totalKeys
      });

      // Resource 핸들러 초기화
      this.resourceHandler = new JsonResourceHandler(this.cacheManager);
      this.serverLogger.info('Resource 핸들러 초기화 완료');

      // 파일 감시자 시작
      this.fileWatcher = new FileWatcher(this.cacheManager, config);
      this.fileWatcher.start();
      const watchedSources = this.fileWatcher.getWatchedSources();
      if (watchedSources.length > 0) {
        this.serverLogger.info('파일 감시 시작', {
          sources: watchedSources
        });
      }

      // 웹 서버 시작
      const webConfig = configManager.getWebConfig();
      if (webConfig.enabled) {
        this.webServer = new WebServer(this.cacheManager, webConfig);
        await this.webServer.start();

        // 웹서버에 파일 변경 이벤트 연결
        if (this.fileWatcher && this.webServer.getWebSocketManager()) {
          this.fileWatcher.addChangeListener((event) => {
            this.webServer?.getWebSocketManager()?.broadcastFileChange(
              event.source,
              event.path,
              event.type
            );
          });
        }

        this.serverLogger.info('웹 서버 시작 완료', {
          port: webConfig.port,
          host: webConfig.host,
          url: `http://${webConfig.host}:${webConfig.port}`
        });
      }

      // MCP 서버 시작
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.serverLogger.info('[MCP] MCP JSON Cache Server 시작 완료');
      this.serverLogger.info('서버 정보', {
        name: 'mcp-json-cache',
        version: '1.0.0',
        sources: this.cacheManager.getLoadedSources(),
        tools: ['query_json', 'list_json_keys', 'list_sources'],
        resources: this.resourceHandler ? 'enabled' : 'disabled',
        watcher: this.fileWatcher?.isActive() ? 'active' : 'inactive'
      });

    } catch (error) {
      this.serverLogger.error('서버 시작 실패', error);
      throw error;
    }
  }

  /**
   * 서버 종료
   */
  public async shutdown(): Promise<void> {
    this.serverLogger.info('서버 종료 시작');

    try {
      // 파일 감시자 종료
      if (this.fileWatcher) {
        await this.fileWatcher.stop();
      }

      // 웹 서버 종료
      if (this.webServer) {
        await this.webServer.shutdown();
      }

      // 캐시 정리
      this.cacheManager.shutdown();

      // 로그 정리
      logger.clearBuffer();

      this.serverLogger.info('서버 종료 완료');

    } catch (error) {
      this.serverLogger.error('서버 종료 중 오류', error);
    }
  }

  /**
   * 서버 상태 확인
   */
  public getStatus() {
    return {
      server: {
        name: 'mcp-json-cache',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      cache: this.cacheManager.getGlobalStats(),
      tools: {
        query_json: this.queryTool.getStats(),
        list_json_keys: this.keysTool.getStats(),
        list_sources: this.sourcesTool.getStats()
      }
    };
  }
}

/**
 * 메인 함수 - 서버 시작
 */
async function main() {
  const server = new MCPCacheServer();

  // Graceful shutdown 처리
  process.on('SIGINT', async () => {
    server.logger.info('SIGINT 신호 수신, 서버 종료 중...');
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    server.logger.info('SIGTERM 신호 수신, 서버 종료 중...');
    await server.shutdown();
    process.exit(0);
  });

  // 에러 핸들링
  process.on('uncaughtException', (error) => {
    server.logger.error('처리되지 않은 예외', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    server.logger.error('처리되지 않은 Promise 거부', reason);
    process.exit(1);
  });

  // 서버 시작
  try {
    await server.start();
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// 서버 시작 - 크로스플랫폼 경로 비교
const currentFile = import.meta.url;
const scriptPath = process.argv[1];
const scriptName = scriptPath.split(/[/\\]/).pop() || '';

if (currentFile.endsWith(scriptName) || scriptName.includes('index')) {
  main();
}

export { MCPCacheServer };
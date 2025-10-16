/**
 * Web Server for JSON Cache Management UI
 * Express 기반 웹 서버 및 Socket.io 연동
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { createServer as createNetServer } from 'net';
import { CacheManager } from '../cache/CacheManager.js';
import { logger } from '../utils/logger.js';
import { setupRoutes } from './routes.js';
import { setupSocket, WebSocketManager } from './socket.js';

export interface WebServerConfig {
  enabled: boolean;
  port: number;
  host: string;
}

export class WebServer {
  private app: Express;
  private httpServer: HttpServer;
  private io: SocketIOServer;
  private cacheManager: CacheManager;
  private config: WebServerConfig;
  private wsManager: WebSocketManager;
  private serverLogger = logger.withSource('WEB_SERVER');

  constructor(cacheManager: CacheManager, config: WebServerConfig) {
    this.cacheManager = cacheManager;
    this.config = config;

    // Express 앱 생성
    this.app = express();
    this.httpServer = createServer(this.app);

    // Socket.io 서버 생성
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: `http://${config.host}:${config.port}`,
        methods: ['GET', 'POST']
      }
    });

    // WebSocket 매니저 생성
    this.wsManager = new WebSocketManager(this.io, cacheManager);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocket();
  }

  /**
   * 미들웨어 설정
   */
  private setupMiddleware(): void {
    // JSON 파싱
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS 설정 (localhost만 허용)
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && origin.includes('localhost')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
      }
      next();
    });

    // 정적 파일 서빙 (public 디렉토리)
    // ES6 모듈에서 __dirname 사용하기 위해 fileURLToPath 사용
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const publicPath = join(__dirname, '../../public');
    this.app.use(express.static(publicPath));

    // 요청 로깅
    this.app.use((req, res, next) => {
      this.serverLogger.debug('HTTP 요청', {
        method: req.method,
        path: req.path,
        query: req.query
      });
      next();
    });

    // 에러 핸들링
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.serverLogger.error('웹 서버 에러', err);
      res.status(500).json({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 라우트 설정
   */
  private setupRoutes(): void {
    setupRoutes(this.app, this.cacheManager);

    // 루트 경로
    this.app.get('/', (req, res) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      res.sendFile(join(__dirname, '../../public', 'index.html'));
    });

    // 404 핸들러
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * WebSocket 설정
   */
  private setupSocket(): void {
    setupSocket(this.io, this.cacheManager, this.wsManager);
  }

  /**
   * 포트 사용 가능 여부 확인
   */
  private async isPortAvailable(port: number, host: string): Promise<boolean> {
    return new Promise((resolve) => {
      const tester = createNetServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.once('close', () => resolve(true)).close();
        })
        .listen(port, host);
    });
  }

  /**
   * 사용 가능한 포트 찾기 (시작 포트부터 +10 범위 내에서)
   */
  private async findAvailablePort(startPort: number, host: string, maxAttempts = 10): Promise<number> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const port = startPort + attempt;
      const available = await this.isPortAvailable(port, host);

      if (available) {
        if (attempt > 0) {
          this.serverLogger.info('대체 포트 발견', {
            requestedPort: startPort,
            foundPort: port,
            attempt: attempt + 1
          });
        }
        return port;
      }
    }

    throw new Error(`사용 가능한 포트를 찾을 수 없습니다 (시도 범위: ${startPort}-${startPort + maxAttempts - 1})`);
  }

  /**
   * 서버 시작
   */
  public async start(): Promise<void> {
    try {
      // 사용 가능한 포트 찾기
      const availablePort = await this.findAvailablePort(this.config.port, this.config.host);

      // 포트가 변경되었으면 설정 업데이트
      if (availablePort !== this.config.port) {
        this.serverLogger.warn('요청한 포트가 사용 중', {
          requestedPort: this.config.port,
          assignedPort: availablePort
        });
        this.config.port = availablePort;
      }

      return new Promise((resolve, reject) => {
        this.httpServer.listen(this.config.port, this.config.host, async () => {
          const url = `http://${this.config.host}:${this.config.port}`;
          this.serverLogger.info('웹 서버 시작', {
            host: this.config.host,
            port: this.config.port,
            url
          });

          // 브라우저 자동 실행
          try {
            await open(url);
            this.serverLogger.info('브라우저 자동 실행', { url });
          } catch (error) {
            this.serverLogger.warn('브라우저 자동 실행 실패', error);
            // 브라우저 실행 실패는 치명적이지 않으므로 계속 진행
          }

          resolve();
        });

        this.httpServer.on('error', (error) => {
          this.serverLogger.error('웹 서버 에러', error);
          reject(error);
        });
      });

    } catch (error) {
      this.serverLogger.error('웹 서버 시작 실패', error);
      throw error;
    }
  }

  /**
   * 서버 종료
   */
  public async shutdown(): Promise<void> {
    this.serverLogger.info('웹 서버 종료 시작');

    return new Promise((resolve) => {
      // WebSocket 연결 종료
      this.wsManager.shutdown();

      // Socket.io 종료
      this.io.close(() => {
        this.serverLogger.debug('Socket.io 종료 완료');
      });

      // HTTP 서버 종료
      this.httpServer.close(() => {
        this.serverLogger.info('웹 서버 종료 완료');
        resolve();
      });

      // 강제 종료 타임아웃 (5초)
      setTimeout(() => {
        this.serverLogger.warn('웹 서버 강제 종료');
        resolve();
      }, 5000);
    });
  }

  /**
   * WebSocket 매니저 반환 (로그 전송용)
   */
  public getWebSocketManager(): WebSocketManager {
    return this.wsManager;
  }
}

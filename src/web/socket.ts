/**
 * WebSocket Manager
 * 실시간 로그 스트리밍 및 상태 변경 알림
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { CacheManager } from '../cache/CacheManager.js';
import { logger, LogEntry } from '../utils/logger.js';

const wsLogger = logger.withSource('WEBSOCKET');

export class WebSocketManager {
  private io: SocketIOServer;
  private cacheManager: CacheManager;
  private connectedClients: Set<string> = new Set();

  constructor(io: SocketIOServer, cacheManager: CacheManager) {
    this.io = io;
    this.cacheManager = cacheManager;
  }

  /**
   * 로그 브로드캐스트
   */
  public broadcastLog(entry: LogEntry): void {
    if (this.connectedClients.size > 0) {
      this.io.emit('log:new', entry);
    }
  }

  /**
   * 상태 변경 알림
   */
  public broadcastStateChange(event: string, data: any): void {
    if (this.connectedClients.size > 0) {
      this.io.emit('state:change', { event, data, timestamp: new Date().toISOString() });
    }
  }

  /**
   * 소스 리로드 알림
   */
  public broadcastReload(source: string, success: boolean, error?: string): void {
    this.broadcastStateChange('source:reload', {
      source,
      success,
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 파일 변경 알림
   */
  public broadcastFileChange(source: string, path: string, type: 'change' | 'add' | 'unlink'): void {
    this.broadcastStateChange('file:change', {
      source,
      path,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 연결된 클라이언트 수 반환
   */
  public getClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * 종료
   */
  public shutdown(): void {
    wsLogger.info('WebSocket 매니저 종료', {
      clients: this.connectedClients.size
    });
    this.connectedClients.clear();
  }
}

/**
 * Socket.io 설정
 */
export function setupSocket(
  io: SocketIOServer,
  cacheManager: CacheManager,
  wsManager: WebSocketManager
): void {

  io.on('connection', (socket: Socket) => {
    const clientId = socket.id;
    wsManager['connectedClients'].add(clientId);

    wsLogger.info('클라이언트 연결', {
      clientId,
      totalClients: wsManager.getClientCount()
    });

    // 연결 시 현재 상태 전송
    socket.emit('state:initial', {
      sources: cacheManager.getLoadedSources(),
      stats: cacheManager.getGlobalStats(),
      timestamp: new Date().toISOString()
    });

    // 로그 요청 핸들러
    socket.on('log:request', (data: { level?: string; limit?: number }) => {
      const logs = logger.getBuffer(data.limit || 100);
      socket.emit('log:history', {
        logs,
        total: logs.length,
        timestamp: new Date().toISOString()
      });
    });

    // 로그 클리어 요청
    socket.on('log:clear', () => {
      logger.clearBuffer();
      io.emit('log:cleared', {
        timestamp: new Date().toISOString()
      });
      wsLogger.info('로그 버퍼 클리어됨', { by: clientId });
    });

    // 통계 요청 핸들러
    socket.on('stats:request', () => {
      socket.emit('stats:response', {
        global: cacheManager.getGlobalStats(),
        sources: cacheManager.getLoadedSources().map(name =>
          cacheManager.getSourceStats(name)
        ),
        timestamp: new Date().toISOString()
      });
    });

    // 소스 리로드 요청
    socket.on('source:reload', async (data: { source: string }) => {
      try {
        wsLogger.info('소스 리로드 요청', { source: data.source, by: clientId });

        await cacheManager.reloadSource(data.source);
        const stats = cacheManager.getSourceStats(data.source);

        wsManager.broadcastReload(data.source, true);

        socket.emit('source:reloaded', {
          source: data.source,
          success: true,
          stats,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        wsManager.broadcastReload(data.source, false, errorMessage);

        socket.emit('source:reloaded', {
          source: data.source,
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 연결 해제
    socket.on('disconnect', () => {
      wsManager['connectedClients'].delete(clientId);
      wsLogger.info('클라이언트 연결 해제', {
        clientId,
        totalClients: wsManager.getClientCount()
      });
    });

    // 에러 핸들링
    socket.on('error', (error) => {
      wsLogger.error('Socket 에러', { clientId, error });
    });
  });

  wsLogger.info('WebSocket 서버 설정 완료');
}

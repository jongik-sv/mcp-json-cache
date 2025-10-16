// MCP JSON Cache Manager - Frontend Application

class CacheManager {
  constructor() {
    this.socket = null;
    this.currentTab = 'dashboard';
    this.currentLogLevel = 'all';
    this.autoScroll = true;
    this.sources = [];
    this.stats = null;
    this.monacoEditor = null;

    this.init();
  }

  // 초기화
  init() {
    this.setupSocket();
    this.setupTabs();
    this.setupDashboard();
    this.setupSources();
    this.setupLogs();
    this.setupModal();
    this.loadInitialData();
  }

  // Socket.io 연결
  setupSocket() {
    this.socket = io('http://localhost:6315');

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.updateConnectionStatus(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.updateConnectionStatus(false);
    });

    // 초기 상태 수신
    this.socket.on('state:initial', (data) => {
      console.log('Initial state:', data);
      this.updateDashboard(data.stats);
    });

    // 실시간 로그
    this.socket.on('log:new', (entry) => {
      this.addLogEntry(entry);
    });

    // 로그 히스토리
    this.socket.on('log:history', (data) => {
      this.displayLogHistory(data.logs);
    });

    // 로그 클리어
    this.socket.on('log:cleared', () => {
      document.getElementById('logViewer').innerHTML = '';
    });

    // 상태 변경
    this.socket.on('state:change', (data) => {
      console.log('State change:', data);
      if (data.event === 'source:reload') {
        this.loadInitialData();
      }
    });

    // 통계 응답
    this.socket.on('stats:response', (data) => {
      this.updateDashboard(data.global);
      this.updateSourcesList(data.sources);
    });
  }

  // 연결 상태 업데이트
  updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    if (connected) {
      statusEl.textContent = '🟢 Connected';
      statusEl.classList.add('connected');
    } else {
      statusEl.textContent = '🔴 Disconnected';
      statusEl.classList.remove('connected');
    }
  }

  // 탭 설정
  setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  // 탭 전환
  switchTab(tabName) {
    // 버튼 active 상태
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 컨텐츠 active 상태
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabName);
    });

    this.currentTab = tabName;

    // 탭별 추가 로직
    if (tabName === 'logs') {
      this.socket.emit('log:request', { limit: 100 });
    } else if (tabName === 'dashboard') {
      this.socket.emit('stats:request');
    }
  }

  // 대시보드 설정
  setupDashboard() {
    const reloadAllBtn = document.getElementById('reloadAllBtn');

    reloadAllBtn.addEventListener('click', async () => {
      if (confirm('Reload all sources?')) {
        reloadAllBtn.disabled = true;
        reloadAllBtn.innerHTML = '<span>⏳</span> Reloading...';

        try {
          const response = await fetch('/api/reload-all', { method: 'POST' });
          const data = await response.json();

          if (data.success) {
            alert(`Reloaded ${data.data.success}/${data.data.total} sources`);
            this.loadInitialData();
          } else {
            alert('Reload failed: ' + data.error);
          }
        } catch (error) {
          alert('Reload error: ' + error.message);
        } finally {
          reloadAllBtn.disabled = false;
          reloadAllBtn.innerHTML = '<span>🔄</span> Reload All';
        }
      }
    });
  }

  // 소스 관리 설정
  setupSources() {
    const searchBtn = document.getElementById('searchBtn');
    const keySearch = document.getElementById('keySearch');

    // 검색 버튼
    searchBtn.addEventListener('click', () => {
      this.searchKeys();
    });

    // 엔터 키로 검색
    keySearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.searchKeys();
      }
    });
  }

  // 로그 설정
  setupLogs() {
    // 로그 레벨 필터
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentLogLevel = btn.dataset.level;
        this.filterLogs();
      });
    });

    // 자동 스크롤
    const autoScrollCheck = document.getElementById('autoScrollCheck');
    autoScrollCheck.addEventListener('change', (e) => {
      this.autoScroll = e.target.checked;
    });

    // 로그 클리어
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    clearLogsBtn.addEventListener('click', () => {
      if (confirm('Clear all logs?')) {
        this.socket.emit('log:clear');
      }
    });
  }

  // 모달 설정
  setupModal() {
    const modal = document.getElementById('valueModal');
    const closeModal = document.getElementById('closeModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const copyValueBtn = document.getElementById('copyValueBtn');

    const closeHandler = () => {
      modal.classList.remove('active');
      // Monaco Editor 정리
      if (this.monacoEditor) {
        this.monacoEditor.dispose();
        this.monacoEditor = null;
      }
    };

    closeModal.addEventListener('click', closeHandler);
    closeModalBtn.addEventListener('click', closeHandler);

    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeHandler();
      }
    });

    // 값 복사
    copyValueBtn.addEventListener('click', () => {
      let value = '';
      if (this.monacoEditor) {
        // Monaco Editor에서 값 가져오기
        value = this.monacoEditor.getValue();
      } else {
        // Fallback to text content
        value = document.getElementById('modalValue').textContent || '';
      }

      navigator.clipboard.writeText(value).then(() => {
        copyValueBtn.innerHTML = '<span>✓</span> Copied!';
        setTimeout(() => {
          copyValueBtn.innerHTML = '<span>📋</span> Copy';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
      });
    });
  }

  // 초기 데이터 로드
  async loadInitialData() {
    try {
      // 소스 목록
      const sourcesRes = await fetch('/api/sources');
      const sourcesData = await sourcesRes.json();

      if (sourcesData.success) {
        this.sources = sourcesData.data.sources;
        this.updateSourcesList(this.sources);
        this.updateSourceSelect(this.sources);
      }

      // 통계
      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();

      if (statsData.success) {
        this.stats = statsData.data;
        this.updateDashboard(this.stats);
      }

    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  // 대시보드 업데이트
  updateDashboard(stats) {
    if (!stats) return;

    document.getElementById('totalSources').textContent = stats.loadedSources || 0;
    document.getElementById('totalKeys').textContent = stats.totalKeys || 0;

    const memoryMB = ((stats.memoryUsage || 0) / 1024 / 1024).toFixed(2);
    document.getElementById('memoryUsage').textContent = memoryMB + ' MB';

    const hitRate = stats.cacheHitRate || 0;
    document.getElementById('cacheHitRate').textContent = hitRate.toFixed(1) + '%';

    // Uptime
    if (stats.uptime) {
      const hours = Math.floor(stats.uptime / 3600);
      const minutes = Math.floor((stats.uptime % 3600) / 60);
      const seconds = Math.floor(stats.uptime % 60);
      document.getElementById('serverUptime').textContent =
        `Uptime: ${hours}h ${minutes}m ${seconds}s`;
    }
  }

  // 소스 목록 업데이트
  updateSourcesList(sources) {
    const container = document.getElementById('sourcesList');

    if (!sources || sources.length === 0) {
      container.innerHTML = '<div class="no-data">No sources loaded</div>';
      return;
    }

    container.innerHTML = sources.map(source => `
      <div class="source-card">
        <div class="source-header">
          <div class="source-name">
            ${source.isLoaded ? '✅' : '❌'} ${source.name}
          </div>
          <div class="source-badges">
            ${source.isPrimary ? '<span class="badge badge-primary">PRIMARY</span>' : ''}
            ${source.isWatchEnabled ? '<span class="badge badge-success">WATCH</span>' : ''}
          </div>
        </div>
        <div class="source-path">${source.path}</div>
        <div class="source-stats">
          <div class="source-stat">
            <span class="source-stat-label">Keys:</span>
            <span class="source-stat-value">${source.keys}</span>
          </div>
          <div class="source-stat">
            <span class="source-stat-label">Size:</span>
            <span class="source-stat-value">${source.sizeFormatted || '0 B'}</span>
          </div>
          <div class="source-stat">
            <span class="source-stat-label">Hits:</span>
            <span class="source-stat-value">${source.hits || 0}</span>
          </div>
          <div class="source-stat">
            <span class="source-stat-label">Loaded:</span>
            <span class="source-stat-value">${source.loadedAtFormatted || 'Never'}</span>
          </div>
        </div>
        <div class="source-actions">
          <button class="btn btn-sm btn-primary" onclick="app.reloadSource('${source.name}')">
            <span>🔄</span> Reload
          </button>
          <button class="btn btn-sm btn-secondary" onclick="app.browseSource('${source.name}')">
            <span>👁️</span> Browse
          </button>
        </div>
      </div>
    `).join('');
  }

  // 소스 선택 업데이트
  updateSourceSelect(sources) {
    const select = document.getElementById('sourceSelect');
    const currentValue = select.value;

    select.innerHTML = '<option value="">All Sources</option>' +
      sources.map(source =>
        `<option value="${source.name}">${source.name} (${source.keys} keys)</option>`
      ).join('');

    select.value = currentValue;
  }

  // 소스 리로드
  async reloadSource(sourceName) {
    if (!confirm(`Reload source "${sourceName}"?`)) return;

    try {
      const response = await fetch(`/api/reload/${sourceName}`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        alert(`Source "${sourceName}" reloaded successfully`);
        this.loadInitialData();
      } else {
        alert('Reload failed: ' + data.error);
      }
    } catch (error) {
      alert('Reload error: ' + error.message);
    }
  }

  // 소스 브라우징
  browseSource(sourceName) {
    // 소스 탭으로 전환하고 해당 소스 선택
    this.switchTab('sources');
    document.getElementById('sourceSelect').value = sourceName;
    document.getElementById('keySearch').value = '';
    this.searchKeys();
  }

  // 키 검색
  async searchKeys() {
    const source = document.getElementById('sourceSelect').value;
    const searchTerm = document.getElementById('keySearch').value.trim();

    const searchInfo = document.getElementById('searchInfo');
    searchInfo.textContent = 'Searching...';

    try {
      let url = '/api/keys?limit=500';
      if (source) url += `&source=${encodeURIComponent(source)}`;

      // 검색어가 있으면 search 파라미터 사용, 아니면 prefix 사용
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        this.displayKeys(data.data);

        const info = [];
        if (data.data.source) info.push(`Source: ${data.data.source}`);
        if (data.data.prefix) info.push(`Search: ${data.data.prefix}`);
        if (data.data.searchType) {
          const searchTypeText = data.data.searchType === 'fuzzy' ? 'Smart Search' :
                              data.data.searchType === 'prefix' ? 'Prefix' : 'All';
          info.push(`Type: ${searchTypeText}`);
        }
        info.push(`Found: ${data.data.total} keys`);
        if (data.data.hasMore) info.push('(showing first 500)');

        searchInfo.textContent = info.join(' • ');
      } else {
        searchInfo.textContent = 'Search failed: ' + data.error;
      }
    } catch (error) {
      searchInfo.textContent = 'Search error: ' + error.message;
    }
  }

  // 키 표시
  displayKeys(data) {
    const tbody = document.getElementById('keysTableBody');
    const resultCount = document.getElementById('resultCount');

    resultCount.textContent = `${data.returned} of ${data.total} results`;

    if (data.keys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="no-data">No keys found</td></tr>';
      return;
    }

    tbody.innerHTML = data.keys.map((key, index) => `
      <tr>
        <td><code>${key}</code></td>
        <td>${data.source || '<em>multiple</em>'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="app.viewValue('${key}', '${data.source || ''}')">
            <span>👁️</span> View
          </button>
        </td>
      </tr>
    `).join('');
  }

  // 값 조회
  async viewValue(key, source) {
    try {
      let url = `/api/query?key=${encodeURIComponent(key)}`;
      if (source) url += `&source=${encodeURIComponent(source)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        this.showValueModal(data.data);
      } else {
        alert('Query failed: ' + data.error);
      }
    } catch (error) {
      alert('Query error: ' + error.message);
    }
  }

  // 값 모달 표시
  showValueModal(result) {
    document.getElementById('modalKey').textContent = result.key;
    document.getElementById('modalSource').textContent = result.source;

    // Monaco Editor 초기화
    this.initializeMonacoEditor(result.value);

    document.getElementById('valueModal').classList.add('active');
  }

  // Monaco Editor 초기화
  initializeMonacoEditor(value) {
    // Monaco Editor가 로드되었는지 확인
    if (!window.monacoLoaded) {
      // Monaco Editor가 아직 로드되지 않았다면 잠시 기다렸다가 초기화
      setTimeout(() => this.initializeMonacoEditor(value), 100);
      return;
    }

    const container = document.getElementById('modalValue');

    // 기존 에디터가 있다면 제거
    if (this.monacoEditor) {
      this.monacoEditor.dispose();
    }

    // JSON 포맷팅
    const formattedJson = JSON.stringify(value, null, 2);

    // Monaco Editor 생성
    this.monacoEditor = monaco.editor.create(container, {
      value: formattedJson,
      language: 'json',
      theme: 'vs-dark',
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      renderWhitespace: 'none',
      wordWrap: 'on',
      folding: true,
      showFoldingControls: 'always'
    });
  }

  // 로그 히스토리 표시
  displayLogHistory(logs) {
    const viewer = document.getElementById('logViewer');
    viewer.innerHTML = logs.map(log => this.createLogElement(log)).join('');
    this.scrollToBottom();
  }

  // 로그 항목 추가
  addLogEntry(entry) {
    const viewer = document.getElementById('logViewer');
    viewer.insertAdjacentHTML('beforeend', this.createLogElement(entry));

    // 오래된 로그 제거 (최대 1000개)
    const entries = viewer.querySelectorAll('.log-entry');
    if (entries.length > 1000) {
      entries[0].remove();
    }

    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  // 로그 엘리먼트 생성
  createLogElement(entry) {
    const levelClass = `log-${entry.level}`;
    const context = entry.context ? `\n${JSON.stringify(entry.context, null, 2)}` : '';

    return `
      <div class="log-entry ${levelClass}" data-level="${entry.level}">
        <span class="log-time">${entry.timestamp}</span>
        <span class="log-level">${entry.level.toUpperCase()}</span>
        <span class="log-source">${entry.source || 'SYSTEM'}</span>
        <span class="log-message">${this.escapeHtml(entry.message)}${context}</span>
      </div>
    `;
  }

  // 로그 필터링
  filterLogs() {
    const entries = document.querySelectorAll('.log-entry');

    entries.forEach(entry => {
      if (this.currentLogLevel === 'all') {
        entry.style.display = 'grid';
      } else {
        entry.style.display = entry.dataset.level === this.currentLogLevel ? 'grid' : 'none';
      }
    });
  }

  // 스크롤 하단으로
  scrollToBottom() {
    const viewer = document.getElementById('logViewer');
    viewer.scrollTop = viewer.scrollHeight;
  }

  // HTML 이스케이프
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 앱 초기화
const app = new CacheManager();

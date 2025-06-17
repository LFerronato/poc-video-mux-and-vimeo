export class VideoChunkedUploader {
  constructor() {
    this.chunkSize = 5 * 1024 * 1024; // 5MB
    this.maxRetries = 3;
    this.isPaused = false;
    this.currentOffset = 0;
    this.file = null;
    this.uploadUrl = null;
    this.videoId = null;
    this.startTime = null;
    this.totalSize = 0;
    this.cacheKey = 'video-poc.upload_cache';
    this.processingTimeout = 4 * 60 * 1000; // 4 minutos
    this.provider = null;
  }

  /**
   * Define o provider atual
   */
  setProvider(provider) {
    this.provider = provider;
    console.log(`🔄 Provider: ${provider}`);
  }

  /**
   * Sistema de Logs
   */
  log(message, type = 'info') {
    const logsContainer = document.getElementById('logsContainer');
    const logsContent = document.getElementById('logsContent');
    
    if (!logsContainer || !logsContent) return;
    
    logsContainer.classList.remove('hidden');
    
    const logEl = document.createElement('div');
    logEl.className = `flex items-start space-x-2 ${type === 'error' ? 'text-red-600' : type === 'success' ? 'text-green-600' : 'text-gray-600'}`;
    
    const time = new Date().toLocaleTimeString();
    logEl.innerHTML = `
      <span class="text-gray-400">[${time}]</span>
      <span>${message}</span>
    `;
    
    logsContent.appendChild(logEl);
    logsContent.scrollTop = logsContent.scrollHeight;
    
    console.log(`[${time}] ${message}`);
  }

  /**
   * Atualiza estados do vídeo
   */
  updateVideoState(state) {
    const statesContainer = document.getElementById('videoStates');
    if (!statesContainer) return;
    
    statesContainer.classList.remove('hidden');
    
    const states = ['uploading', 'processing', 'ready'];
    states.forEach(s => {
      const el = document.getElementById(`state${s.charAt(0).toUpperCase() + s.slice(1)}`);
      if (el) {
        el.classList.remove('text-blue-500', 'text-green-500');
        el.classList.add('text-gray-400');
        el.querySelector('div').classList.remove('bg-blue-500', 'bg-green-500');
        el.querySelector('div').classList.add('bg-gray-300');
      }
    });
    
    const currentState = document.getElementById(`state${state.charAt(0).toUpperCase() + state.slice(1)}`);
    if (currentState) {
      currentState.classList.remove('text-gray-400');
      currentState.classList.add(state === 'ready' ? 'text-green-500' : 'text-blue-500');
      currentState.querySelector('div').classList.remove('bg-gray-300');
      currentState.querySelector('div').classList.add(state === 'ready' ? 'bg-green-500' : 'bg-blue-500');
    }
  }

  /**
   * Sistema de Cache Local
   */
  saveCache() {
    const cacheData = {
      videoId: this.videoId,
      uploadUrl: this.uploadUrl,
      currentOffset: this.currentOffset,
      totalSize: this.totalSize,
      fileName: this.file?.name,
      videoName: document.getElementById('videoName')?.value,
      provider: this.provider,
      timestamp: Date.now(),
      filePath: this.file ? {
        name: this.file.name,
        size: this.file.size,
        type: this.file.type,
        lastModified: this.file.lastModified
      } : null
    };
    
    localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
  }

  loadCache() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Erro ao carregar cache:', error);
    }
    return null;
  }

  clearCache() {
    localStorage.removeItem(this.cacheKey);
  }

  /**
   * Verifica se existe upload em progresso
   */
  hasIncompleteUpload() {
    const cache = this.loadCache();
    if (!cache) return false;
    return cache.currentOffset < cache.totalSize && cache.videoId && cache.uploadUrl;
  }

  /**
   * Restaura upload do cache
   */
  async restoreFromCache(file = null) {
    const cache = this.loadCache();
    if (!cache) return false;

    if (file && cache.filePath) {
      const isSameFile = file.name === cache.filePath.name && 
                        file.size === cache.filePath.size &&
                        file.lastModified === cache.filePath.lastModified;
      
      if (!isSameFile) {
        this.clearCache();
        return false;
      }
    }

    this.videoId = cache.videoId;
    this.uploadUrl = cache.uploadUrl;
    this.currentOffset = cache.currentOffset;
    this.totalSize = cache.totalSize;
    this.file = file;
    this.provider = cache.provider || this.provider;

    if (cache.videoName) {
      const nameInput = document.getElementById('videoName');
      if (nameInput && !nameInput.value) {
        nameInput.value = cache.videoName;
      }
    }

    console.log(`🔄 Upload restaurado: ${(cache.currentOffset / 1024 / 1024).toFixed(1)}MB / ${(cache.totalSize / 1024 / 1024).toFixed(1)}MB`);
    return true;
  }

  /**
   * Interface de Status
   */
  showStatus(message, type = 'info') {
    const statusContainer = document.getElementById('statusContainer');
    const statusDiv = document.getElementById('statusDiv');
    
    if (!statusContainer || !statusDiv) return;
    
    statusContainer.classList.remove('hidden');
    statusDiv.textContent = message;
    
    statusDiv.classList.remove('bg-blue-100', 'text-blue-800', 'border-blue-200');
    statusDiv.classList.remove('bg-green-100', 'text-green-800', 'border-green-200');
    statusDiv.classList.remove('bg-red-100', 'text-red-800', 'border-red-200');
    statusDiv.classList.remove('bg-orange-100', 'text-orange-800', 'border-orange-200');
    
    switch(type) {
      case 'success':
        statusDiv.classList.add('bg-green-100', 'text-green-800', 'border', 'border-green-200');
        break;
      case 'error':
        statusDiv.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-200');
        break;
      case 'warning':
        statusDiv.classList.add('bg-orange-100', 'text-orange-800', 'border', 'border-orange-200');
        break;
      default:
        statusDiv.classList.add('bg-blue-100', 'text-blue-800', 'border', 'border-blue-200');
    }
  }

  /**
   * Atualiza progresso do upload
   */
  updateProgress(uploaded, total, speed = null) {
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const uploadedSize = document.getElementById('uploadedSize');
    const uploadSpeed = document.getElementById('uploadSpeed');
    const eta = document.getElementById('eta');
    
    if (!progressContainer || !progressFill || !progressPercentage) return;
    
    progressContainer.classList.remove('hidden');
    
    const progress = (uploaded / total) * 100;
    progressFill.style.width = `${progress}%`;
    progressPercentage.textContent = `${progress.toFixed(1)}%`;
    
    if (uploadedSize) {
      uploadedSize.textContent = this.formatSize(uploaded);
    }
    
    if (uploadSpeed && speed !== null) {
      uploadSpeed.textContent = `${speed.toFixed(1)} MB/s`;
    }
    
    if (eta && speed !== null && speed > 0) {
      const remaining = (total - uploaded) / (1024 * 1024 * speed);
      eta.textContent = this.formatTime(remaining);
    }
  }

  /**
   * Cria upload via API
   */
  async createUploadViaAPI(file, videoName) {
    try {
      const response = await fetch(`http://localhost:3333/videos/link?provider=${this.provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: videoName,
          description: `Upload de ${file.name}`,
          size: file.size,
          corsOrigin: window.location.origin,
          provider: this.provider
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Erro ao criar upload: ${error.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao criar upload:', error);
      throw error;
    }
  }

  /**
   * Upload de um chunk
   */
  async uploadChunk(file, offset, chunkSize) {
    const chunk = file.slice(offset, offset + chunkSize);
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        const method = this.provider === 'vimeo' ? 'PATCH' : 'PUT';
        
        const getContentType = (filename) => {
          const ext = filename.toLowerCase().split('.').pop();
          const mimeTypes = {
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska',
            'webm': 'video/webm',
            'flv': 'video/x-flv',
            'm4v': 'video/x-m4v',
            '3gp': 'video/3gpp',
            'ts': 'video/mp2t',
          };
          return mimeTypes[ext] || 'video/mp4';
        };
        
        const headers = {
          'Content-Type': getContentType(this.file.name),
          'Content-Length': chunk.size.toString()
        };
        
        if (this.provider === 'vimeo') {
          headers['Content-Type'] = 'application/offset+octet-stream';
          headers['Upload-Offset'] = offset.toString();
          headers['Tus-Resumable'] = '1.0.0';
        }
        
        const response = await fetch(this.uploadUrl, {
          method: method,
          headers: headers,
          body: chunk
        });

        if (!response.ok) {
          throw new Error(`Erro no upload do chunk: ${response.status} ${response.statusText}`);
        }

        const newOffset = response.headers.get('Upload-Offset');
        return newOffset ? parseInt(newOffset, 10) - offset : chunk.size;
      } catch (error) {
        retries++;
        if (retries === this.maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }

  /**
   * Upload do arquivo
   */
  async uploadFile(file, videoName) {
    try {
      this.file = file;
      this.totalSize = file.size;
      this.startTime = Date.now();
      this.isPaused = false;
      
      this.updateVideoState('uploading');
      
      const upload = await this.createUploadViaAPI(file, videoName);
      this.videoId = upload.uploadId;
      this.uploadUrl = upload.uploadUrl;
      
      this.saveCache();
      
      if (this.provider === 'mux') {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const speed = event.loaded / ((Date.now() - this.startTime) / 1000);
              this.updateProgress(event.loaded, event.total, speed);
              this.currentOffset = event.loaded;
            }
          });
          
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              this.currentOffset = this.totalSize;
              this.updateProgress(this.currentOffset, this.totalSize);
              resolve();
            } else {
              reject(new Error(`Erro no upload: ${xhr.status} ${xhr.statusText}`));
            }
          });
          
          xhr.addEventListener('error', () => {
            reject(new Error('Erro de rede no upload'));
          });
          
          const getContentType = (filename) => {
            const ext = filename.toLowerCase().split('.').pop();
            const mimeTypes = {
              'mp4': 'video/mp4',
              'mov': 'video/quicktime',
              'avi': 'video/x-msvideo',
              'mkv': 'video/x-matroska',
              'webm': 'video/webm',
              'flv': 'video/x-flv',
              'm4v': 'video/x-m4v',
              '3gp': 'video/3gpp',
              'ts': 'video/mp2t',
            };
            return mimeTypes[ext] || 'video/mp4';
          };
          
          xhr.open('PUT', this.uploadUrl);
          xhr.setRequestHeader('Content-Type', getContentType(file.name));
          xhr.setRequestHeader('Content-Length', file.size.toString());
          xhr.send(file);
        });
        
      } else {
        while (this.currentOffset < this.totalSize && !this.isPaused) {
          const chunkSize = Math.min(this.chunkSize, this.totalSize - this.currentOffset);
          
          const uploaded = await this.uploadChunk(file, this.currentOffset, chunkSize);
          this.currentOffset += uploaded;
          
          const elapsedTime = (Date.now() - this.startTime) / 1000;
          const speed = this.currentOffset / (1024 * 1024 * elapsedTime);
          this.updateProgress(this.currentOffset, this.totalSize, speed);
          
          this.saveCache();
        }
      }
      
      if (this.isPaused) {
        this.log('⏸️ Upload pausado', 'warning');
        return null;
      }
      
      this.log('✅ Upload concluído! Aguardando processamento...', 'success');
      this.updateVideoState('processing');
      
      let status;
      const startWait = Date.now();
      
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        status = await this.checkVideoStatus(this.videoId);
        
        if (Date.now() - startWait > this.processingTimeout) {
          throw new Error('Timeout ao aguardar processamento do vídeo');
        }
      } while (status.status === 'uploading' || status.status === 'processing');
      
      if (status.error) {
        throw new Error(`Erro no processamento: ${status.error.message}`);
      }
      
      this.updateVideoState('ready');
      this.log('🎉 Vídeo pronto!', 'success');
      this.clearCache();
      
      if (status.asset) {
        return {
          videoId: status.asset.videoId,
          uploadId: this.videoId,
          link: status.asset.link
        };
      } else {
        return {
          videoId: this.videoId,
          uploadId: this.videoId,
          link: null
        };
      }
      
    } catch (error) {
      this.log(`❌ Erro no upload: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Verifica status do vídeo
   */
  async checkVideoStatus(videoId) {
    try {
      const response = await fetch(`http://localhost:3333/videos/${videoId}/status?provider=${this.provider}`);
      if (!response.ok) {
        throw new Error(`Erro ao verificar status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      throw error;
    }
  }

  /**
   * Pausa o upload
   */
  pause() {
    if (this.isPaused) return;
    this.isPaused = true;
    this.log('⏸️ Upload pausado', 'warning');
    
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    
    if (pauseBtn) pauseBtn.classList.add('hidden');
    if (resumeBtn) resumeBtn.classList.remove('hidden');
  }

  /**
   * Retoma o upload
   */
  async resume() {
    if (!this.isPaused) return;
    
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    
    if (pauseBtn) pauseBtn.classList.remove('hidden');
    if (resumeBtn) resumeBtn.classList.add('hidden');
    
    this.isPaused = false;
    this.log('▶️ Upload retomado', 'info');
    
    if (this.file) {
      try {
        await this.uploadFile(this.file, document.getElementById('videoName')?.value);
      } catch (error) {
        console.error('Erro ao retomar upload:', error);
      }
    }
  }

  /**
   * Mostra status da conexão
   */
  showConnectionStatus(isOnline) {
    const connectionStatus = document.getElementById('connectionStatus');
    const connectionText = document.getElementById('connectionText');
    
    if (!connectionStatus || !connectionText) return;
    
    connectionStatus.classList.remove('hidden', 'bg-green-500', 'bg-red-500');
    connectionStatus.classList.add(isOnline ? 'bg-green-500' : 'bg-red-500');
    
    connectionText.textContent = isOnline ? '🌐 Online' : '📡 Offline';
  }

  /**
   * Mostra informações do cache na interface
   */
  showCacheInfo() {
    const cache = this.loadCache();
    if (!cache) return;

    const cacheInfo = document.getElementById('cacheInfo');
    if (!cacheInfo) return;

    cacheInfo.classList.remove('hidden');

    const progress = ((cache.currentOffset || 0) / cache.totalSize * 100).toFixed(1);
    const formattedSize = this.formatSize(cache.totalSize);
    const formattedOffset = this.formatSize(cache.currentOffset || 0);

    cacheInfo.innerHTML = `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <h4 class="font-medium text-blue-800">🔄 Upload em Andamento</h4>
          <button id="clearCacheBtn" class="text-sm text-red-600 hover:text-red-700">
            Limpar Cache
          </button>
        </div>
        <div class="text-sm text-blue-700 space-y-1">
          <p><strong>Arquivo:</strong> ${cache.fileName}</p>
          <p><strong>Progresso:</strong> ${formattedOffset} de ${formattedSize} (${progress}%)</p>
          <p><strong>Provider:</strong> ${cache.provider || 'vimeo'}</p>
        </div>
        <div class="mt-3">
          <button id="continueUploadBtn" class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
            Continuar Upload
          </button>
        </div>
      </div>
    `;

    const clearBtn = document.getElementById('clearCacheBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearCache();
        cacheInfo.classList.add('hidden');
      });
    }
  }

  /**
   * Formata tamanho em bytes para string legível
   */
  formatSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Formata tempo em segundos para string legível
   */
  formatTime(seconds) {
    if (!isFinite(seconds)) return '--:--';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
import { VideoChunkedUploader } from './upload-chunked.js';
import VimeoViewer from './vimeo/vimeo.viewer.js';
import MuxViewer from './mux/mux.viewer.js';

class VideoPOC {
  constructor() {
    // Inicializa os componentes
    this.uploader = new VideoChunkedUploader();
    this.vimeoViewer = new VimeoViewer('playerContainer');
    this.muxViewer = new MuxViewer('playerContainer');
    
    // Estado
    this.currentVideoId = null;
    this.currentProvider = null;

    // Inicializa a interface
    this.initializeUI();
  }

  /**
   * Inicializa a interface e event listeners
   */
  initializeUI() {
    this.uploader.showCacheInfo();

    this.setupUploadArea();
    this.setupFileInput();
    this.setupForm();
    this.setupControlButtons();
    this.setupCacheButtons();
    this.setupConnectionMonitoring();
    this.setupPlayerControls();
    this.setupProviderSelection();
  }

  /**
   * Configura a seleção de provider
   */
  setupProviderSelection() {
    const providerSelect = document.getElementById('providerSelect');
    if (!providerSelect) return;

    providerSelect.addEventListener('change', (event) => {
      this.currentProvider = event.target.value;
      this.updateProviderUI();
      this.uploader.setProvider(event.target.value);
      
      localStorage.setItem('video-poc.provider', this.currentProvider);
    });

    // Define provider inicial
    this.currentProvider = localStorage.getItem('video-poc.provider') || 'vimeo';
    
    // Atualiza o select para refletir o valor salvo
    providerSelect.value = this.currentProvider;
    
    // Define o provider no uploader
    this.uploader.setProvider(this.currentProvider);
    
    this.updateProviderUI();
  }

  /**
   * Atualiza UI baseado no provider selecionado
   */
  updateProviderUI() {
    const vimeoSection = document.getElementById('vimeoSection');
    const muxSection = document.getElementById('muxSection');

    if (vimeoSection) {
      if (this.currentProvider === 'vimeo') {
        vimeoSection.classList.remove('hidden');
      } else {
        vimeoSection.classList.add('hidden');
      }
    }
    if (muxSection) {
      if (this.currentProvider === 'mux') {
        muxSection.classList.remove('hidden');
      } else {
        muxSection.classList.add('hidden');
      }
    }
  }

  /**
   * Configura a área de upload (drag & drop)
   */
  setupUploadArea() {
    const uploadArea = document.getElementById('uploadArea');
    const videoFileInput = document.getElementById('videoFileInput');

    if (!uploadArea || !videoFileInput) return;

    // Click para selecionar arquivo
    uploadArea.addEventListener('click', () => videoFileInput.click());

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('border-blue-400');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('border-blue-400');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('border-blue-400');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });
  }

  /**
   * Configura o input de arquivo
   */
  setupFileInput() {
    const videoFileInput = document.getElementById('videoFileInput');
    if (!videoFileInput) return;

    videoFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileSelect(e.target.files[0]);
      }
    });
  }

  /**
   * Configura o formulário de upload
   */
  setupForm() {
    const form = document.getElementById('uploadForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const file = document.getElementById('videoFileInput')?.files[0];
      const videoName = document.getElementById('videoName')?.value;

      if (!file || !videoName?.trim()) {
        alert('Por favor, selecione um arquivo e digite um nome.');
        return;
      }

      // Mostra progresso e esconde botão de upload
      const progressContainer = document.getElementById('progressContainer');
      const uploadBtn = document.getElementById('uploadBtn');
      const pauseBtn = document.getElementById('pauseBtn');

      if (progressContainer) progressContainer.classList.remove('hidden');
      if (uploadBtn) uploadBtn.classList.add('hidden');
      if (pauseBtn) pauseBtn.classList.remove('hidden');

      try {
        // Define o provider no uploader antes do upload
        this.uploader.setProvider(this.currentProvider);
        
        // Faz o upload
        const result = await this.uploader.uploadFile(file, videoName);

        if (result && result.videoId) {
          this.currentVideoId = result.videoId;
          
          // Alimenta o input com o ID do provider correto
          const videoIdInput = document.getElementById(`videoIdInput${this.currentProvider.charAt(0).toUpperCase() + this.currentProvider.slice(1)}`);
          if (videoIdInput) {
            videoIdInput.value = result.videoId;
          }

          // Inicializa o player correto
          if (this.currentProvider === 'vimeo') {
            await this.vimeoViewer.initPlayer(result.videoId);
          } else {
            await this.muxViewer.initPlayer(result.videoId);
          }
        }

      } catch (error) {
        console.error('Erro no upload:', error);
        if (uploadBtn) uploadBtn.classList.remove('hidden');
        if (pauseBtn) pauseBtn.classList.add('hidden');
        const resumeBtn = document.getElementById('resumeBtn');
        if (resumeBtn) resumeBtn.classList.add('hidden');
      }
    });
  }

  /**
   * Configura os botões de controle (pausar/retomar)
   */
  setupControlButtons() {
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.uploader.pause();
      });
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        this.uploader.resume();
      });
    }
  }

  /**
   * Configura os botões de cache
   */
  setupCacheButtons() {
    document.addEventListener('click', async (e) => {
      if (e.target.id === 'continueUploadBtn') {
        const cache = this.uploader.loadCache();
        if (cache?.videoName) {
          const nameInput = document.getElementById('videoName');
          if (nameInput) nameInput.value = cache.videoName;
        }
        this.uploader.log('🔄 Preparando para continuar upload...', 'info');

        // Precisa do arquivo para continuar
        const fileInput = document.getElementById('videoFileInput');
        if (!fileInput?.files[0]) {
          this.uploader.log('📁 Selecione o arquivo novamente para continuar...', 'warning');

          // Listener temporário para quando arquivo for selecionado
          const continueUpload = async (e) => {
            const selectedFile = e.target.files[0];
            if (!selectedFile) return;

            // Remove listener temporário
            fileInput.removeEventListener('change', continueUpload);

            // Valida arquivo
            if (cache.filePath && selectedFile.size !== cache.filePath.size) {
              this.uploader.log('❌ Arquivo diferente! Tamanho não confere.', 'error');
              return;
            }

            // Continua upload
            try {
              // Configura o provider no uploader
              this.uploader.setProvider(cache.provider || this.currentProvider);
              
              const result = await this.uploader.uploadFile(selectedFile, cache.videoName);
              if (result?.videoId) {
                // Alimenta o input com o ID do provider correto
                const videoIdInput = document.getElementById(`videoIdInput${this.currentProvider.charAt(0).toUpperCase() + this.currentProvider.slice(1)}`);
                if (videoIdInput) {
                  videoIdInput.value = result.videoId;
                }

                // Inicializa o player correto
                if (this.currentProvider === 'vimeo') {
                  await this.vimeoViewer.initPlayer(result.videoId);
                } else {
                  await this.muxViewer.initPlayer(result.videoId);
                }
              }
            } catch (error) {
              console.error('Erro ao continuar upload:', error);
              this.uploader.log('❌ Erro ao continuar upload: ' + error.message, 'error');
            }
          };

          fileInput.addEventListener('change', continueUpload);
          fileInput.click();
        }
      }
    });
  }

  /**
   * Configura os controles do player
   */
  setupPlayerControls() {
    // Vimeo Player
    const loadPlayerBtnVimeo = document.getElementById('loadPlayerBtnVimeo');
    const videoIdInputVimeo = document.getElementById('videoIdInputVimeo');

    if (loadPlayerBtnVimeo && videoIdInputVimeo) {
      loadPlayerBtnVimeo.addEventListener('click', async () => {
        const videoId = videoIdInputVimeo.value.trim();
        if (videoId) {
          try {
            await this.vimeoViewer.initPlayer(videoId);
          } catch (error) {
            console.error('Erro ao carregar player Vimeo:', error);
          }
        }
      });
    }

    // Mux Player
    const loadPlayerBtnMux = document.getElementById('loadPlayerBtnMux');
    const videoIdInputMux = document.getElementById('videoIdInputMux');

    if (loadPlayerBtnMux && videoIdInputMux) {
      loadPlayerBtnMux.addEventListener('click', async () => {
        const videoId = videoIdInputMux.value.trim();
        if (videoId) {
          try {
            await this.muxViewer.initPlayer(videoId);
          } catch (error) {
            console.error('Erro ao carregar player Mux:', error);
          }
        }
      });
    }
  }

  /**
   * Configura monitoramento de conexão
   */
  setupConnectionMonitoring() {
    window.addEventListener('online', () => {
      this.uploader.showConnectionStatus(true);
    });

    window.addEventListener('offline', () => {
      this.uploader.showConnectionStatus(false);
    });

    this.uploader.showConnectionStatus(navigator.onLine);
  }

  /**
   * Manipula seleção de arquivo
   */
  handleFileSelect(file) {
    if (!file.type.startsWith('video/')) {
      alert('Por favor, selecione um arquivo de vídeo válido.');
      return;
    }

    // Atualiza UI
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const chunkCount = document.getElementById('chunkCount');
    const uploadBtn = document.getElementById('uploadBtn');

    if (fileInfo) fileInfo.classList.remove('hidden');
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = this.uploader.formatSize(file.size);
    if (chunkCount) {
      const chunks = Math.ceil(file.size / this.uploader.chunkSize);
      chunkCount.textContent = `${chunks} (${this.uploader.formatSize(this.uploader.chunkSize)} cada)`;
    }
    if (uploadBtn) uploadBtn.disabled = false;

    // Verifica se tem upload incompleto
    if (this.uploader.hasIncompleteUpload()) {
      const cache = this.uploader.loadCache();
      if (cache?.filePath?.size === file.size) {
        this.uploader.log('⚠️ Upload incompleto encontrado!', 'warning');
        this.uploader.showCacheInfo();
      }
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.videoPOC = new VideoPOC();
}); 
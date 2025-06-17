/**
 * MuxViewer - Gerencia o player de vídeo do MUX
 */
class MuxViewer {
  constructor() {
    this.player = null;
    this.playerContainer = document.getElementById('playerContainer');
  }

  /**
   * Inicializa o player nativo HTML5
   * @param {string} videoId - ID do vídeo no MUX
   */
  async initPlayer(videoId) {
    if (!videoId) return;

    try {
      const videoData = await this.getVideoUrl(videoId);
      
      this.playerContainer.innerHTML = `
        <video 
          id="custom-video-player"
          controls 
          class="w-full h-full rounded-lg"
          preload="metadata"
          playsinline
        >
          Seu navegador não suporta o elemento de vídeo.
        </video>
      `;

      const video = this.playerContainer.querySelector('video');
      this.player = video;

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoData.files[0].url;
      } else {
        await this.loadHlsJs();
        
        if (window.Hls && window.Hls.isSupported()) {
          const hls = new window.Hls();
          hls.loadSource(videoData.files[0].url);
          hls.attachMedia(video);
          
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            console.log('[MuxViewer] HLS manifest carregado');
          });
          
          hls.on(window.Hls.Events.ERROR, (event, data) => {
            console.error('[MuxViewer] Erro HLS:', data);
          });
        } else {
          throw new Error('HLS não suportado neste navegador');
        }
      }

      video.addEventListener('play', () => console.log('▶️ Vídeo iniciado'));
      video.addEventListener('pause', () => console.log('⏸️ Vídeo pausado'));
      video.addEventListener('ended', () => console.log('🏁 Vídeo finalizado'));
      video.addEventListener('error', (error) => {
        console.error('❌ Erro no player:', error);
      });

    } catch (error) {
      console.error('Erro ao carregar vídeo:', error);
    }
  }

  /**
   * Busca URL direta do vídeo via API local
   */
  async getVideoUrl(videoId) {
    const providerSelect = document.getElementById('providerSelect');
    const provider = providerSelect ? providerSelect.value : 'mux';
    
    const response = await fetch(`http://localhost:3333/videos/${videoId}/url?provider=${provider}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erro ao buscar URL: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.files || data.files.length === 0) {
      throw new Error(`Vídeo ainda em processamento (status: ${data.status || 'desconhecido'}). Aguarde alguns minutos e tente novamente.`);
    }
    
    return data;
  }

  /**
   * Destrói o player atual
   */
  destroyPlayer() {
    if (this.player) {
      this.player.pause();
      this.player.src = '';
      this.player = null;
      this.playerContainer.innerHTML = '';
    }
  }

  /**
   * Carrega a biblioteca hls.js
   */
  async loadHlsJs() {
    if (window.Hls) return;
    
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

export default MuxViewer;

/**
 * VimeoViewer - Gerencia o player de vídeo do Vimeo
 */
class VimeoViewer {
  constructor() {
    this.player = null;
    this.playerContainer = document.getElementById('playerContainer');
  }

  /**
   * Inicializa o player nativo HTML5
   * @param {string} videoId - ID do vídeo no Vimeo
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

      video.src = videoData.url;

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
    const provider = providerSelect ? providerSelect.value : 'vimeo';
    
    const response = await fetch(`http://localhost:3333/videos/${videoId}/url?provider=${provider}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erro ao buscar URL: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.url) {
      throw new Error(`Vídeo ainda em processamento (status: ${data.status || 'desconhecido'}). Aguarde alguns minutos e tente novamente.`);
    }
    
    return data;
  }

  /**
   * Fallback para player do Vimeo
   */
  async initVimeoPlayer(videoId) {
    if (!window.Vimeo) {
      await this.loadPlayerScript();
    }

    this.playerContainer.innerHTML = '';
    this.player = new Vimeo.Player(this.playerContainer, {
      id: videoId,
      width: '100%',
      responsive: true,
      autopause: false,
      autoplay: false,
      title: false,
      byline: false,
      portrait: false
    });

    this.player.on('play', () => console.log('▶️ Vídeo iniciado'));
    this.player.on('pause', () => console.log('⏸️ Vídeo pausado'));
    this.player.on('ended', () => console.log('🏁 Vídeo finalizado'));
    this.player.on('error', (error) => console.error('❌ Erro no player:', error));
  }

  /**
   * Carrega o script do player do Vimeo
   */
  loadPlayerScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Destrói o player atual
   */
  destroyPlayer() {
    if (this.player) {
      if (typeof this.player.destroy === 'function') {
        this.player.destroy();
      } else {
        this.player.pause();
        this.player.src = '';
      }
      this.player = null;
      this.playerContainer.innerHTML = '';
    }
  }
}

export default VimeoViewer;

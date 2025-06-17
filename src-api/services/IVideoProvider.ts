export interface UploadOptions {
  filename: string;
  title?: string;
  description?: string;
}

export interface UploadResult {
  videoId: string;
  embedHtml: string;
  link: string;
}

export interface DirectUploadOptions {
  title: string;
  description: string;
  corsOrigin?: string;
  timeout?: number;
  size?: number;
  folder?: string;
}

export interface DirectUploadResult {
  uploadId: string;
  uploadUrl: string;
  instructions: {
    method: string;
    headers: Record<string, string>;
    note: string;
  };
  timeout: number;
  status: string;
  provider: string;
}

export interface UploadStatus {
  uploadId: string;
  status: string;
  details?: any;
  timeout?: number;
  asset?: {
    videoId: string;
    status: string;
    duration?: number;
    embedHtml: string;
    link: string;
  };
  error?: {
    message?: string;
    type?: string;
  };
  provider: string;
}

export interface VideoAsset {
  id: string;
  title?: string;
  description?: string;
  duration?: number;
  status: string;
  createdAt: string;
  embedHtml?: string;
  link?: string;
  provider: string;
}

export interface ListVideosResult {
  videos: VideoAsset[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
  };
  provider: string;
}

/**
 * Interface principal que todos os services de vídeo devem implementar
 */
export interface IVideoProvider {
  /**
   * Upload de vídeo via buffer (consome banda do servidor)
   */
  uploadVideo(fileBuffer: Buffer, options: UploadOptions): Promise<UploadResult>;

  /**
   * Lista todos os vídeos/assets
   */
  listVideos(): Promise<ListVideosResult>;

  /**
   * Gera URL para upload direto (economiza banda do servidor)
   * Opcional - nem todos os provedores suportam
   */
  createDirectUpload(options: DirectUploadOptions): Promise<DirectUploadResult>;

  /**
   * Verifica status de um upload direto
   * Opcional - apenas para provedores que suportam upload direto
   */
  getUploadStatus(uploadId: string): Promise<UploadStatus>;

  /**
   * Busca informações de um vídeo específico
   * Opcional - para funcionalidades avançadas
   */
  getVideo(videoId: string): Promise<VideoAsset>;

  /**
   * Deleta um vídeo
   * Opcional - para funcionalidades avançadas
   */
  deleteVideo(videoId: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Busca URLs diretas do vídeo para player nativo
   */
  getVideoUrls(videoId: string): Promise<{ files: Array<{ url: string; quality: string; width: number; height: number; type: string }> }>;
}

/**
 * Enum para identificar os provedores suportados
 */
export enum VideoProviderEnum {
  MUX = 'mux',
  VIMEO = 'vimeo'
}

/**
 * Factory para criar instâncias dos services
 */
export class VideoServiceFactory {
  static create(provider: VideoProviderEnum | string): IVideoProvider {
    switch (provider) {
      case VideoProviderEnum.MUX:
      case 'mux':
        const { MuxService } = require('./mux');
        return new MuxService();

      case VideoProviderEnum.VIMEO:
      case 'vimeo':
        const { VimeoService } = require('./vimeo');
        return new VimeoService();

      default:
        throw new Error(`Provedor de vídeo não suportado: ${provider}`);
    }
  }

  static getSupportedProviders(): VideoProviderEnum[] {
    return [VideoProviderEnum.MUX, VideoProviderEnum.VIMEO];
  }
} 
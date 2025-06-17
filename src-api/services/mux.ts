import {
  IVideoProvider,
  UploadOptions,
  UploadResult,
  DirectUploadOptions,
  DirectUploadResult,
  UploadStatus,
  ListVideosResult,
  VideoAsset,
  VideoProviderEnum
} from './IVideoProvider';
import { VideoServiceError } from '../middleware/errorHandler';

const muxTokenId = process.env.MUX_TOKEN_ID!;
const muxTokenSecret = process.env.MUX_TOKEN_SECRET!;

const credentials = Buffer.from(`${muxTokenId}:${muxTokenSecret}`).toString('base64');

function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
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
  return mimeTypes[ext || ''] || 'video/mp4';
}

export class MuxService implements IVideoProvider {
  async uploadVideo(fileBuffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    const contentType = getContentType(options.filename);

    const createUploadResponse = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cors_origin: '*',
        new_asset_settings: {
          playback_policy: ['public'],
          passthrough: options.title,
          meta: {
            title: options.title,
            description: options.description
          }
        }
      })
    });

    if (!createUploadResponse.ok) {
      const errorText = await createUploadResponse.text();
      throw new VideoServiceError(
        `Erro ao criar upload (${createUploadResponse.status}): ${errorText}`,
        createUploadResponse.status,
        VideoProviderEnum.MUX
      );
    }

    const uploadData = await createUploadResponse.json();
    const uploadUrl = uploadData.data.url;
    let assetId = uploadData.data.asset_id;

    if (!assetId) {
      throw new VideoServiceError('Asset ID não encontrado na resposta do MUX', 500, VideoProviderEnum.MUX);
    }

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString()
      }
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new VideoServiceError(
        `Erro no upload (${uploadResponse.status}): ${errorText}`,
        uploadResponse.status,
        VideoProviderEnum.MUX
      );
    }

    // Aguarda um pouco para o upload ser processado
    await new Promise(r => setTimeout(r, 3000));

    // Verifica o status do upload primeiro
    const uploadStatusResponse = await fetch(`https://api.mux.com/video/v1/uploads/${uploadData.data.id}`, {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    if (uploadStatusResponse.ok) {
      const uploadStatus = await uploadStatusResponse.json();
      
      if (uploadStatus.data.asset_id) {
        assetId = uploadStatus.data.asset_id;
      }
    }

    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      
      const statusResponse = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      if (statusResponse.ok) {
        const asset = await statusResponse.json();
        if (asset.data.status === 'ready') {
          const playbackId = asset.data.playback_ids?.[0]?.id;
          const embedUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : '';
          
          return {
            videoId: assetId,
            embedHtml: playbackId ? `<video id="video" controls><source src="https://stream.mux.com/${playbackId}.m3u8" type="application/x-mpegURL"></video>` : '',
            link: embedUrl
          };
        }
        if (asset.data.status === 'errored') {
          throw new VideoServiceError('Erro ao processar vídeo no Mux', 500, VideoProviderEnum.MUX);
        }
      }
      attempts++;
    }

    throw new VideoServiceError('Timeout no processamento do vídeo', 408, VideoProviderEnum.MUX);
  }

  async createDirectUpload(options: DirectUploadOptions): Promise<DirectUploadResult> {
    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cors_origin: options.corsOrigin || '*',
        new_asset_settings: {
          playback_policy: ['public'],
          passthrough: options.title,
          meta: {
            title: options.title,
            description: options.description
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao criar upload (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.MUX
      );
    }

    const data = await response.json();

    return {
      uploadId: data.data.id,
      uploadUrl: data.data.url,
      instructions: {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4'
        },
        note: 'Faça PUT do arquivo diretamente para uploadUrl'
      },
      timeout: options.timeout || 3600,
      status: 'created',
      provider: VideoProviderEnum.MUX
    };
  }

  async getUploadStatus(uploadId: string): Promise<UploadStatus> {
    // Primeiro verifica o status do upload
    const uploadResponse = await fetch(`https://api.mux.com/video/v1/uploads/${uploadId}`, {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new VideoServiceError(
        `Erro ao buscar status do upload (${uploadResponse.status}): ${errorText}`,
        uploadResponse.status,
        VideoProviderEnum.MUX
      );
    }

    const uploadData = await uploadResponse.json();
    
    const status: UploadStatus = {
      uploadId: uploadData.data.id,
      status: uploadData.data.status,
      provider: VideoProviderEnum.MUX,
      details: uploadData.data
    };

    // Se o upload foi processado e tem um asset_id, busca o asset
    if (uploadData.data.asset_id) {
      const assetResponse = await fetch(`https://api.mux.com/video/v1/assets/${uploadData.data.asset_id}`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });

      if (assetResponse.ok) {
        const asset = await assetResponse.json();
        
        if (asset.data.status === 'ready') {
          const playbackId = asset.data.playback_ids?.[0]?.id;
          const embedUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : '';
          
          status.asset = {
            videoId: asset.data.id,
            status: asset.data.status,
            duration: asset.data.duration,
            embedHtml: playbackId ? `<video id="video" controls><source src="https://stream.mux.com/${playbackId}.m3u8" type="application/x-mpegURL"></video>` : '',
            link: embedUrl
          };
        }
      }
    }

    return status;
  }

  async listVideos(): Promise<ListVideosResult> {
    const response = await fetch('https://api.mux.com/video/v1/assets?limit=100', {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao listar vídeos (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.MUX
      );
    }

    const data = await response.json();

    const videos: VideoAsset[] = data.data.map((asset: any) => {
      const playbackId = asset.playback_ids?.[0]?.id;
      const embedUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined;
      
      return {
        id: asset.id,
        title: asset.master?.accessibility?.title || `Asset ${asset.id}`,
        description: asset.master?.accessibility?.description || '',
        duration: asset.duration,
        status: asset.status,
        createdAt: asset.created_at,
        embedHtml: playbackId ? `<video id="video" controls><source src="https://stream.mux.com/${playbackId}.m3u8" type="application/x-mpegURL"></video>` : '',
        link: embedUrl,
        provider: VideoProviderEnum.MUX
      };
    });

    return {
      videos,
      pagination: {
        total: data.total_count,
        page: 1,
        limit: 100,
        hasNext: data.data.length === 100
      },
      provider: VideoProviderEnum.MUX
    };
  }

  async getVideo(videoId: string): Promise<VideoAsset> {
    const response = await fetch(`https://api.mux.com/video/v1/assets/${videoId}`, {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao buscar vídeo (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.MUX
      );
    }

    const asset = await response.json();
    const playbackId = asset.data.playback_ids?.[0]?.id;
    const embedUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined;
    
    return {
      id: asset.data.id,
      title: asset.data.master?.accessibility?.title || `Asset ${asset.data.id}`,
      description: asset.data.master?.accessibility?.description || '',
      duration: asset.data.duration,
      status: asset.data.status,
      createdAt: asset.data.created_at,
      embedHtml: playbackId ? `<video id="video" controls><source src="https://stream.mux.com/${playbackId}.m3u8" type="application/x-mpegURL"></video>` : '',
      link: embedUrl,
      provider: VideoProviderEnum.MUX
    };
  }

  async deleteVideo(videoId: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`https://api.mux.com/video/v1/assets/${videoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao deletar vídeo (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.MUX
      );
    }

    return {
      success: true,
      message: `Vídeo ${videoId} deletado com sucesso`
    };
  }

  async getVideoUrls(videoId: string): Promise<{ files: Array<{ url: string; quality: string; width: number; height: number; type: string }> }> {
    const response = await fetch(`https://api.mux.com/video/v1/assets/${videoId}`, {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao buscar URLs do vídeo (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.MUX
      );
    }

    const asset = await response.json();
    const playbackId = asset.data.playback_ids?.[0]?.id;
    
    if (!playbackId) {
      throw new VideoServiceError('Playback ID não encontrado', 404, VideoProviderEnum.MUX);
    }

    const files = [{
      url: `https://stream.mux.com/${playbackId}.m3u8`,
      quality: 'auto',
      width: asset.data.aspect_ratio ? Math.round(asset.data.aspect_ratio * 100) : 1920,
      height: 1080,
      type: 'application/x-mpegURL'
    }];

    return { files };
  }
} 
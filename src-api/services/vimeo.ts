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

const vimeoToken = process.env.VIMEO_ACCESS_TOKEN!;

const VIMEO_DEFAULT_FOLDER = '25641614';

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

export class VimeoService implements IVideoProvider {
  async uploadVideo(fileBuffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    const contentType = getContentType(options.filename);

    const createUploadResponse = await fetch('https://api.vimeo.com/me/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      },
      body: JSON.stringify({
        upload: {
          approach: 'tus',
          size: fileBuffer.length
        },
        name: options.title || options.filename,
        description: options.description || `Upload de ${options.filename}`,
        folder_uri: `/${VIMEO_DEFAULT_FOLDER}`
      })
    });

    if (!createUploadResponse.ok) {
      const errorText = await createUploadResponse.text();
      throw new VideoServiceError(
        `Erro ao criar upload (${createUploadResponse.status}): ${errorText}`,
        createUploadResponse.status,
        VideoProviderEnum.VIMEO
      );
    }

    const uploadData = await createUploadResponse.json();

    if (!uploadData.upload?.upload_link) {
      throw new VideoServiceError('Upload link não encontrado', 500, VideoProviderEnum.VIMEO);
    }

    const uploadResponse = await fetch(uploadData.upload.upload_link, {
      method: 'PATCH',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Content-Length': fileBuffer.length.toString(),
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0'
      }
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new VideoServiceError(
        `Erro no upload (${uploadResponse.status}): ${errorText}`,
        uploadResponse.status,
        VideoProviderEnum.VIMEO
      );
    }

    const videoId = uploadData.uri.split('/').pop();
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      
      const statusResponse = await fetch(`https://api.vimeo.com/videos/${videoId}?fields=uri,status,link`, {
        headers: {
          'Authorization': `Bearer ${vimeoToken}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      });

      if (statusResponse.ok) {
        const videoData = await statusResponse.json();
        if (videoData.status === 'available') {
          return {
            videoId: videoId,
            embedHtml: `<iframe src="https://player.vimeo.com/video/${videoId}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
            link: videoData.link
          };
        }
        if (videoData.status === 'error') {
          throw new VideoServiceError('Erro ao processar vídeo no Vimeo', 500, VideoProviderEnum.VIMEO);
        }
      }
      attempts++;
    }

    throw new VideoServiceError('Timeout no processamento do vídeo', 408, VideoProviderEnum.VIMEO);
  }

  async createDirectUpload(options: DirectUploadOptions): Promise<DirectUploadResult> {
    const folder = options.folder || VIMEO_DEFAULT_FOLDER;
    const requestBody: any = {
      upload: {
        approach: 'tus',
        size: options.size || 0
      },
      name: options.title,
      description: options.description,
      folder_uri: `/${folder}`
    };

    const response = await fetch('https://api.vimeo.com/me/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao criar upload (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.VIMEO
      );
    }

    const data = await response.json();

    return {
      uploadId: data.uri.split('/').pop(),
      uploadUrl: data.upload.upload_link,
      instructions: {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/offset+octet-stream',
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': '0'
        },
        note: 'Faça PATCH do arquivo diretamente para uploadUrl usando protocolo TUS'
      },
      timeout: options.timeout || 3600,
      status: 'created',
      provider: VideoProviderEnum.VIMEO
    };
  }

  async getUploadStatus(uploadId: string): Promise<UploadStatus> {
    const response = await fetch(`https://api.vimeo.com/videos/${uploadId}?fields=uri,status,duration,link,upload`, {
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao buscar status (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.VIMEO
      );
    }

    const video = await response.json();
    
    const status: UploadStatus = {
      uploadId: video.uri.split('/').pop(),
      status: video.status,
      provider: VideoProviderEnum.VIMEO,
      details: video
    };

    if (video.status === 'available') {
      const videoId = video.uri.split('/').pop();
      status.asset = {
        videoId: videoId,
        status: video.status,
        duration: video.duration,
        embedHtml: `<iframe src="https://player.vimeo.com/video/${videoId}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
        link: video.link
      };
    }

    return status;
  }

  async listVideos(): Promise<ListVideosResult> {
    const fieldsParam = 'uri,name,description,duration,status,created_time,link';
    const response = await fetch(`https://api.vimeo.com/me/videos?per_page=100&fields=${fieldsParam}`, {
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao listar vídeos (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.VIMEO
      );
    }

    const data = await response.json();

    const videos: VideoAsset[] = data.data.map((video: any) => {
      const videoId = video.uri.split('/').pop();
      return {
        id: videoId,
        title: video.name,
        description: video.description,
        duration: video.duration,
        status: video.status,
        createdAt: video.created_time,
        embedHtml: `<iframe src="https://player.vimeo.com/video/${videoId}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
        link: video.link,
        provider: VideoProviderEnum.VIMEO
      };
    });

    return {
      videos,
      pagination: {
        total: data.total,
        page: data.page,
        limit: data.per_page,
        hasNext: data.paging?.next !== null
      },
      provider: VideoProviderEnum.VIMEO
    };
  }

  async getVideo(videoId: string): Promise<VideoAsset> {
    const fieldsParam = 'uri,name,description,duration,status,created_time,link';
    const response = await fetch(`https://api.vimeo.com/videos/${videoId}?fields=${fieldsParam}`, {
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao buscar vídeo (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.VIMEO
      );
    }

    const video = await response.json();
    const videoIdFromUri = video.uri.split('/').pop();
    
    return {
      id: videoIdFromUri,
      title: video.name,
      description: video.description,
      duration: video.duration,
      status: video.status,
      createdAt: video.created_time,
      embedHtml: `<iframe src="https://player.vimeo.com/video/${videoIdFromUri}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`,
      link: video.link,
      provider: VideoProviderEnum.VIMEO
    };
  }

  async deleteVideo(videoId: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao deletar vídeo (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.VIMEO
      );
    }

    return {
      success: true,
      message: `Vídeo ${videoId} deletado com sucesso`
    };
  }

  async getVideoUrls(videoId: string): Promise<{ files: Array<{ url: string; quality: string; width: number; height: number; type: string }> }> {
    const response = await fetch(`https://api.vimeo.com/videos/${videoId}?fields=files`, {
      headers: {
        'Authorization': `Bearer ${vimeoToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new VideoServiceError(
        `Erro ao buscar URLs do vídeo (${response.status}): ${errorText}`,
        response.status,
        VideoProviderEnum.VIMEO
      );
    }

    const data = await response.json();
    const files = data.files || [];
    
    const videoFiles = files
      .filter((file: any) => file.link && file.quality)
      .map((file: any) => ({
        url: file.link,
        quality: file.quality,
        width: file.width || 0,
        height: file.height || 0,
        type: file.type || 'video/mp4'
      }));

    return {
      files: videoFiles
    };
  }
} 
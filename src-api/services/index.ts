import { MuxService } from './mux';
import { IVideoProvider, UploadOptions, UploadResult } from './IVideoProvider';

// const PROVIDER = process.env.VIDEO_PROVIDER || 'vimeo';
// const videoHoster: IVideoProvider = PROVIDER === 'mux' ? new MuxService() : null;
const videoHoster: IVideoProvider = new MuxService();

export async function uploadVideo(fileBuffer: Buffer, options: UploadOptions): Promise<UploadResult> {
  return videoHoster.uploadVideo(fileBuffer, options);
}

export * from './IVideoProvider'; 
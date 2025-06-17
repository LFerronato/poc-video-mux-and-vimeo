import express from 'express';
import multer from 'multer';
import { VideoServiceFactory } from '../services/IVideoProvider';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024 }
});

router.get('/', asyncHandler(async (req, res) => {
  const provider = req.query.provider as string || 'vimeo';
  const videoService = VideoServiceFactory.create(provider);
  const result = await videoService.listVideos();

  res.json({
    videos: result.videos,
    pagination: result.pagination,
    provider: result.provider
  });
}));

router.post('/', upload.single('video'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo de vídeo obrigatório' });
  }

  const { originalname, buffer, mimetype, size } = req.file;
  const { title, description } = req.body;
  const provider = req.query.provider as string || 'vimeo';
  const videoService = VideoServiceFactory.create(provider);

  if (!mimetype.startsWith('video/')) {
    return res.status(400).json({ error: 'Arquivo deve ser um vídeo' });
  }

  const result = await videoService.uploadVideo(buffer, {
    filename: originalname,
    title: title || originalname.split('.')[0],
    description: description || `Upload de ${originalname}`,
  });

  res.json({ ...result, provider });
}));

router.post('/link', asyncHandler(async (req, res) => {
  const { title, description, size, corsOrigin, provider } = req.body;
  const providerParam = req.query.provider as string || provider || 'vimeo';

  if (!title) {
    return res.status(400).json({ error: 'Título é obrigatório' });
  }

  const videoService = VideoServiceFactory.create(providerParam);

  const uploadData = await videoService.createDirectUpload({
    title,
    description: description || `Upload de vídeo`,
    corsOrigin: corsOrigin || 'http://localhost:8080',
    timeout: 3600,
    size: size || 0
  });

  res.json({
    uploadId: uploadData.uploadId,
    uploadUrl: uploadData.uploadUrl,
    instructions: uploadData.instructions,
    timeout: uploadData.timeout,
    status: uploadData.status,
    provider: uploadData.provider
  });
}));

router.get('/:videoId/status', asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const provider = req.query.provider as string || 'vimeo';

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID é obrigatório' });
  }

  const videoService = VideoServiceFactory.create(provider);
  const status = await videoService.getUploadStatus(videoId);

  res.json({
    uploadId: status.uploadId,
    status: status.status,
    asset: status.asset,
    error: status.error,
    provider: status.provider
  });
}));

router.get('/:videoId/url', asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const provider = req.query.provider as string || 'vimeo';

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID é obrigatório' });
  }

  const videoService = VideoServiceFactory.create(provider);
  
  if (provider === 'mux') {
    // Para MUX, tenta buscar URLs diretamente primeiro (caso seja asset ID)
    try {
      const urls = await videoService.getVideoUrls(videoId);
      res.json({
        files: urls.files,
        status: 'ready'
      });
    } catch (error) {
      // Se falhar, tenta como upload ID
      const status = await videoService.getUploadStatus(videoId);
      
      if (status.asset) {
        const urls = await videoService.getVideoUrls(status.asset.videoId);
        res.json({
          files: urls.files,
          status: status.status
        });
      } else {
        res.json({
          files: [],
          status: status.status
        });
      }
    }
  } else {
    const urls = await videoService.getVideoUrls(videoId);
    const status = await videoService.getUploadStatus(videoId);

    const bestQuality = urls.files.find(f => f.quality === 'hd') || urls.files[0];
    res.json({
      url: bestQuality?.url,
      status: status.status,
      files: urls.files
    });
  }
}));

router.get('/:videoId', asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const provider = req.query.provider as string || 'vimeo';

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID é obrigatório' });
  }

  const videoService = VideoServiceFactory.create(provider);
  const video = await videoService.getVideo(videoId);

  res.json(video);
}));

router.delete('/:videoId', asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const provider = req.query.provider as string || 'vimeo';

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID é obrigatório' });
  }

  const videoService = VideoServiceFactory.create(provider);
  const result = await videoService.deleteVideo(videoId);

  res.json(result);
}));

router.get('/providers', (req, res) => {
  const providers = VideoServiceFactory.getSupportedProviders();
  const currentProvider = req.query.provider as string || 'vimeo';
  res.json({
    current: currentProvider,
    supported: providers,
    note: 'Use provider query param para alternar'
  });
});

export default router; 
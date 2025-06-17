import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  provider?: string;
  isOperational?: boolean;
}

export class VideoServiceError extends Error implements AppError {
  statusCode: number;
  provider?: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, provider?: string) {
    super(message);
    this.name = 'VideoServiceError';
    this.statusCode = statusCode;
    this.provider = provider;
    this.isOperational = true;
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof VideoServiceError) {
    res.status(error.statusCode).json({
      error: error.message,
      provider: error.provider,
      statusCode: error.statusCode
    });
    return;
  }

  console.error('Erro não tratado:', error);
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    statusCode: 500
  });
};

// Middleware para capturar erros assíncronos
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}; 
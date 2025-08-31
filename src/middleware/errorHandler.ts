import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  // Prisma errors
  if (error.code === 'P2002') {
    return res.status(400).json({
      message: 'A record with this value already exists',
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      message: 'Record not found',
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Invalid token',
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: error.message,
      details: error.details,
    });
  }

  // Default error
  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
  });
};
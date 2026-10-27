import { AppError } from './errorHandler.js';

// 404 handler — passed to Express as `app.use(notFound)`
export const notFound = (req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

export default notFound;
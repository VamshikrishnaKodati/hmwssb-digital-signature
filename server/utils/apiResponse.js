export const success = (res, { data = null, message = 'Success', statusCode = 200, meta = {} } = {}) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  if (Object.keys(meta).length > 0) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const created = (res, { data = null, message = 'Created successfully' } = {}) => {
  return success(res, { data, message, statusCode: 201 });
};

export const paginated = (res, { data, total, page, limit, message = 'Success' }) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      hasNext: Number(page) * Number(limit) < total,
      hasPrev: Number(page) > 1,
    },
  });
};

export const error = (res, { message = 'Internal server error', statusCode = 500, code = 'INTERNAL_ERROR', details = null } = {}) => {
  const response = { success: false, message, code };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
};

export const notFound = (res, message = 'Resource not found') => {
  return error(res, { message, statusCode: 404, code: 'NOT_FOUND' });
};

export const badRequest = (res, message = 'Bad request', details = null) => {
  return error(res, { message, statusCode: 400, code: 'BAD_REQUEST', details });
};

export const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, { message, statusCode: 401, code: 'UNAUTHORIZED' });
};

export const forbidden = (res, message = 'Forbidden') => {
  return error(res, { message, statusCode: 403, code: 'FORBIDDEN' });
};

export const conflict = (res, message = 'Resource already exists') => {
  return error(res, { message, statusCode: 409, code: 'CONFLICT' });
};

export const tooManyRequests = (res, message = 'Too many requests') => {
  return error(res, { message, statusCode: 429, code: 'RATE_LIMITED' });
};

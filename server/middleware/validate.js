import { badRequest } from '../utils/apiResponse.js';

export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return badRequest(res, 'Validation failed', details);
    }

    if (property === 'query') {
      Object.assign(req.query, value);
    } else {
      req[property] = value;
    }
    next();
  };
};

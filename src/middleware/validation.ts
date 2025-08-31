import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details.map((detail) => detail.message),
      });
    }
    next();
  };
};

export const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  transaction: Joi.object({
    description: Joi.string().min(1).max(255).required(),
    amount: Joi.number().positive().required(),
    type: Joi.string().valid('income', 'expense').required(),
    category: Joi.string().min(1).max(50).required(),
    date: Joi.date().iso().required(),
  }),

  updateRole: Joi.object({
    role: Joi.string().valid('admin', 'user', 'read_only').required(),
  }),
};
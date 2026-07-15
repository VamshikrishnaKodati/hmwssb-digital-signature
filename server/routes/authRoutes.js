import express from 'express';
import { login, getProfile, listUsers, createUser, updateUserStatus, deleteUser } from '../controllers/authController.js';
import { authMiddleware, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, createUserSchema, updateUserStatusSchema } from '../validations/schemas.js';

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.get('/profile', authMiddleware, getProfile);
router.get('/users', authMiddleware, authorize('admin'), listUsers);
router.post('/users', authMiddleware, authorize('admin'), validate(createUserSchema), createUser);
router.patch('/users/:id/status', authMiddleware, authorize('admin'), validate(updateUserStatusSchema), updateUserStatus);
router.delete('/users/:id', authMiddleware, authorize('admin'), deleteUser);

export default router;

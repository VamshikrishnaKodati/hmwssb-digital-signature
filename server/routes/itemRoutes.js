import express from 'express';
import { searchItems, getAllItems, getItemById, createItem, updateItem, deleteItem } from '../controllers/itemController.js';
import { authMiddleware, authorize } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { createItemSchema, updateItemSchema } from '../validations/schemas.js';

const router = express.Router();

router.get('/search', authMiddleware, searchItems);
router.get('/', authMiddleware, getAllItems);
router.get('/:id', authMiddleware, getItemById);
router.post('/', authMiddleware, authorize('admin'), validate(createItemSchema), createItem);
router.put('/:id', authMiddleware, authorize('admin'), validate(updateItemSchema), updateItem);
router.delete('/:id', authMiddleware, authorize('admin'), deleteItem);

export default router;

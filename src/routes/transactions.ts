import express from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import { setCache, getCache, deleteCache } from '../config/redis.js';
import prisma from '../config/database.js';

const router = express.Router();

// Get transactions with pagination and search
router.get('/', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', category = '' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    const cacheKey = `transactions:${req.user!.id}:${page}:${limit}:${search}:${category}`;
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const where: any = {
      userId: req.user!.id,
    };

    if (search) {
      where.description = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    if (category) {
      where.category = category as string;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { date: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    const result = {
      transactions: transactions.map(transaction => ({
        ...transaction,
        type: transaction.type.toLowerCase(),
      })),
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
    };

    // Cache for 5 minutes
    await setCache(cacheKey, result, 300);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Create transaction
router.post(
  '/',
  authenticateToken,
  requireRole(['admin', 'user']),
  validateRequest(schemas.transaction),
  async (req: AuthRequest, res, next) => {
    try {
      const { description, amount, type, category, date } = req.body;

      const transaction = await prisma.transaction.create({
        data: {
          description,
          amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
          type: type.toUpperCase(),
          category,
          date: new Date(date),
          userId: req.user!.id,
        },
      });

      // Invalidate cache
      await deleteCache(`transactions:${req.user!.id}:*`);
      await deleteCache(`analytics:${req.user!.id}:*`);

      res.status(201).json({
        ...transaction,
        type: transaction.type.toLowerCase(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update transaction
router.put(
  '/:id',
  authenticateToken,
  requireRole(['admin', 'user']),
  validateRequest(schemas.transaction),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { description, amount, type, category, date } = req.body;

      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          id,
          userId: req.user!.id,
        },
      });

      if (!existingTransaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const transaction = await prisma.transaction.update({
        where: { id },
        data: {
          description,
          amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
          type: type.toUpperCase(),
          category,
          date: new Date(date),
        },
      });

      // Invalidate cache
      await deleteCache(`transactions:${req.user!.id}:*`);
      await deleteCache(`analytics:${req.user!.id}:*`);

      res.json({
        ...transaction,
        type: transaction.type.toLowerCase(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete transaction
router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin', 'user']),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;

      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          id,
          userId: req.user!.id,
        },
      });

      if (!existingTransaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      await prisma.transaction.delete({
        where: { id },
      });

      // Invalidate cache
      await deleteCache(`transactions:${req.user!.id}:*`);
      await deleteCache(`analytics:${req.user!.id}:*`);

      res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Get categories
router.get('/categories', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const cacheKey = 'categories';
    const cachedCategories = await getCache(cacheKey);
    
    if (cachedCategories) {
      return res.json(cachedCategories);
    }

    const categories = [
      'Food & Dining',
      'Transportation',
      'Entertainment',
      'Shopping',
      'Bills & Utilities',
      'Healthcare',
      'Education',
      'Travel',
      'Groceries',
      'Rent',
      'Salary',
      'Freelance',
      'Investment',
      'Gift',
      'Other',
    ];

    // Cache for 1 hour
    await setCache(cacheKey, categories, 3600);

    res.json(categories);
  } catch (error) {
    next(error);
  }
});

export default router;
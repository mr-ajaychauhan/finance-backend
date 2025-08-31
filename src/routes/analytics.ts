import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { setCache, getCache } from '../config/redis.js';
import prisma from '../config/database.js';

const router = express.Router();

// Get dashboard data
router.get('/dashboard', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const cacheKey = `dashboard:${req.user!.id}`;
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const userId = req.user!.id;
    const currentDate = new Date();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

    // Get all transactions for the current year
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startOfYear,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = Math.abs(transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0));

    const balance = totalIncome - totalExpenses;

    // Monthly data
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = new Date(currentDate.getFullYear(), i, 1);
      const monthName = month.toLocaleDateString('en-US', { month: 'short' });
      
      const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === i;
      });

      const income = monthTransactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(monthTransactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0));

      return {
        month: monthName,
        income,
        expenses,
      };
    });

    // Category data
    const categoryMap = new Map();
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];

    transactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        const current = categoryMap.get(t.category) || 0;
        categoryMap.set(t.category, current + Math.abs(t.amount));
      });

    const categoryData = Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const result = {
      totalIncome,
      totalExpenses,
      balance,
      monthlyData,
      categoryData,
      recentTransactions: transactions.slice(0, 10).map(t => ({
        ...t,
        type: t.type.toLowerCase(),
      })),
    };

    // Cache for 15 minutes
    await setCache(cacheKey, result, 900);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get monthly trends
router.get('/trends/:year', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const year = parseInt(req.params.year);
    const cacheKey = `trends:${req.user!.id}:${year}`;
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user!.id,
        date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    });

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const month = new Date(year, i, 1);
      const monthName = month.toLocaleDateString('en-US', { month: 'short' });
      
      const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === i;
      });

      const income = monthTransactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      const expenses = Math.abs(monthTransactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0));

      return {
        month: monthName,
        income,
        expenses,
        net: income - expenses,
      };
    });

    // Cache for 1 hour
    await setCache(cacheKey, monthlyData, 3600);

    res.json(monthlyData);
  } catch (error) {
    next(error);
  }
});

// Get category breakdown
router.get('/categories/:period', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const period = req.params.period;
    const cacheKey = `categories:${req.user!.id}:${period}`;
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    let dateFilter: Date;
    const currentDate = new Date();

    switch (period) {
      case 'month':
        dateFilter = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        break;
      case 'quarter':
        const quarterStart = Math.floor(currentDate.getMonth() / 3) * 3;
        dateFilter = new Date(currentDate.getFullYear(), quarterStart, 1);
        break;
      case 'year':
        dateFilter = new Date(currentDate.getFullYear(), 0, 1);
        break;
      default:
        dateFilter = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user!.id,
        type: 'EXPENSE',
        date: {
          gte: dateFilter,
        },
      },
    });

    const categoryMap = new Map();
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
    ];

    transactions.forEach(t => {
      const current = categoryMap.get(t.category) || 0;
      categoryMap.set(t.category, current + Math.abs(t.amount));
    });

    const categoryData = Array.from(categoryMap.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);

    // Cache for 30 minutes
    await setCache(cacheKey, categoryData, 1800);

    res.json(categoryData);
  } catch (error) {
    next(error);
  }
});

export default router;
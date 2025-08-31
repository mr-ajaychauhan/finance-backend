import express from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { validateRequest, schemas } from '../middleware/validation.js';
import prisma from '../config/database.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedUsers = users.map(user => ({
      ...user,
      role: user.role.toLowerCase(),
    }));

    res.json(formattedUsers);
  } catch (error) {
    next(error);
  }
});

// Update user role (admin only)
router.put(
  '/:id/role',
  authenticateToken,
  requireRole(['admin']),
  validateRequest(schemas.updateRole),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      const user = await prisma.user.update({
        where: { id },
        data: { role: role.toUpperCase() },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      res.json({
        ...user,
        role: user.role.toLowerCase(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user!.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';

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

const sampleTransactions = [
  { description: 'Monthly Salary', amount: 5000, type: 'INCOME', category: 'Salary' },
  { description: 'Grocery Shopping', amount: -120, type: 'EXPENSE', category: 'Groceries' },
  { description: 'Gas Station', amount: -45, type: 'EXPENSE', category: 'Transportation' },
  { description: 'Netflix Subscription', amount: -15, type: 'EXPENSE', category: 'Entertainment' },
  { description: 'Freelance Project', amount: 800, type: 'INCOME', category: 'Freelance' },
  { description: 'Electricity Bill', amount: -95, type: 'EXPENSE', category: 'Bills & Utilities' },
  { description: 'Coffee Shop', amount: -25, type: 'EXPENSE', category: 'Food & Dining' },
  { description: 'Investment Dividend', amount: 150, type: 'INCOME', category: 'Investment' },
];

async function seed() {
  try {
    console.log('Starting database seed...');

    // Create demo users
    const hashedPassword = await bcrypt.hash('password123', 12);

    const users = await Promise.all([
      prisma.user.upsert({
        where: { email: 'admin@demo.com' },
        update: {},
        create: {
          name: 'Admin User',
          email: 'admin@demo.com',
          password: hashedPassword,
          role: 'ADMIN',
        },
      }),
      prisma.user.upsert({
        where: { email: 'user@demo.com' },
        update: {},
        create: {
          name: 'Regular User',
          email: 'user@demo.com',
          password: hashedPassword,
          role: 'USER',
        },
      }),
      prisma.user.upsert({
        where: { email: 'readonly@demo.com' },
        update: {},
        create: {
          name: 'Read Only User',
          email: 'readonly@demo.com',
          password: hashedPassword,
          role: 'READ_ONLY',
        },
      }),
    ]);

    console.log('Created demo users');

    // Create sample transactions for each user
    for (const user of users) {
      const userTransactions = sampleTransactions.map((transaction, index) => ({
        ...transaction,
        type: transaction.type as any, // Cast to enum type if TransactionType is not imported
        userId: user.id,
        date: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)), // Spread over last few days
      }));

      await prisma.transaction.createMany({
        data: userTransactions,
        skipDuplicates: true,
      });
    }

    console.log('Created sample transactions');
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

const createDiscussionSchema = z.object({
  startingNumber: z.number(),
});

// Get all discussions with their operations tree
router.get('/', async (req, res) => {
  try {
    const discussions = await prisma.discussion.findMany({
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
        operations: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
              },
            },
            childOperations: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Build tree structure
    const discussionsWithTree = discussions.map((discussion) => {
      const operationsMap = new Map();
      const rootOperations: any[] = [];

      // First pass: create all operation nodes
      discussion.operations.forEach((op) => {
        operationsMap.set(op.id, {
          ...op,
          childOperations: [],
        });
      });

      // Second pass: build tree structure
      discussion.operations.forEach((op) => {
        const node = operationsMap.get(op.id);
        if (op.parentOperationId) {
          const parent = operationsMap.get(op.parentOperationId);
          if (parent) {
            parent.childOperations.push(node);
          }
        } else {
          rootOperations.push(node);
        }
      });

      return {
        ...discussion,
        operations: rootOperations,
      };
    });

    res.json(discussionsWithTree);
  } catch (error) {
    console.error('Get discussions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single discussion
router.get('/:id', async (req, res) => {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
        operations: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
              },
            },
            childOperations: true,
          },
        },
      },
    });

    if (!discussion) {
      return res.status(404).json({ error: 'Discussion not found' });
    }

    // Build tree structure
    const operationsMap = new Map();
    const rootOperations: any[] = [];

    discussion.operations.forEach((op) => {
      operationsMap.set(op.id, {
        ...op,
        childOperations: [],
      });
    });

    discussion.operations.forEach((op) => {
      const node = operationsMap.get(op.id);
      if (op.parentOperationId) {
        const parent = operationsMap.get(op.parentOperationId);
        if (parent) {
          parent.childOperations.push(node);
        }
      } else {
        rootOperations.push(node);
      }
    });

    res.json({
      ...discussion,
      operations: rootOperations,
    });
  } catch (error) {
    console.error('Get discussion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create discussion (authenticated only)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { startingNumber } = createDiscussionSchema.parse(req.body);

    const discussion = await prisma.discussion.create({
      data: {
        startingNumber,
        authorId: req.userId!,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Add empty operations array for consistency with frontend
    res.status(201).json({
      ...discussion,
      operations: [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create discussion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


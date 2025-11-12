import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

const createOperationSchema = z.object({
  type: z.enum(['add', 'subtract', 'multiply', 'divide']),
  rightOperand: z.number(),
  discussionId: z.string().optional(),
  parentOperationId: z.string().optional(),
});

// Calculate result based on operation type
function calculateResult(
  leftOperand: number,
  type: string,
  rightOperand: number
): number {
  switch (type) {
    case 'add':
      return leftOperand + rightOperand;
    case 'subtract':
      return leftOperand - rightOperand;
    case 'multiply':
      return leftOperand * rightOperand;
    case 'divide':
      if (rightOperand === 0) {
        throw new Error('Division by zero is not allowed');
      }
      return leftOperand / rightOperand;
    default:
      throw new Error('Invalid operation type');
  }
}

// Create operation (authenticated only)
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { type, rightOperand, discussionId, parentOperationId } =
      createOperationSchema.parse(req.body);

    // Validate that either discussionId or parentOperationId is provided
    if (!discussionId && !parentOperationId) {
      return res.status(400).json({
        error: 'Either discussionId or parentOperationId must be provided',
      });
    }

    let leftOperand: number;

    if (parentOperationId) {
      // Get parent operation result
      const parentOperation = await prisma.operation.findUnique({
        where: { id: parentOperationId },
      });

      if (!parentOperation) {
        return res.status(404).json({ error: 'Parent operation not found' });
      }

      leftOperand = parentOperation.result;
    } else if (discussionId) {
      // Get discussion starting number
      const discussion = await prisma.discussion.findUnique({
        where: { id: discussionId },
      });

      if (!discussion) {
        return res.status(404).json({ error: 'Discussion not found' });
      }

      leftOperand = discussion.startingNumber;
    } else {
      return res.status(400).json({
        error: 'Either discussionId or parentOperationId must be provided',
      });
    }

    // Calculate result
    const result = calculateResult(leftOperand, type, rightOperand);

    // Create operation
    const operation = await prisma.operation.create({
      data: {
        type,
        leftOperand,
        rightOperand,
        result,
        authorId: req.userId!,
        discussionId: discussionId || null,
        parentOperationId: parentOperationId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
        discussion: true,
        parentOperation: true,
      },
    });

    res.status(201).json(operation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    if (error instanceof Error && error.message === 'Division by zero is not allowed') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create operation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


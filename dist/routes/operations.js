"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const createOperationSchema = zod_1.z.object({
    type: zod_1.z.enum(['add', 'subtract', 'multiply', 'divide']),
    rightOperand: zod_1.z.number(),
    discussionId: zod_1.z.string().optional(),
    parentOperationId: zod_1.z.string().optional(),
});
// Calculate result based on operation type
function calculateResult(leftOperand, type, rightOperand) {
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
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { type, rightOperand, discussionId, parentOperationId } = createOperationSchema.parse(req.body);
        // Validate that either discussionId or parentOperationId is provided
        if (!discussionId && !parentOperationId) {
            return res.status(400).json({
                error: 'Either discussionId or parentOperationId must be provided',
            });
        }
        let leftOperand;
        if (parentOperationId) {
            // Get parent operation result
            const parentOperation = await prisma.operation.findUnique({
                where: { id: parentOperationId },
            });
            if (!parentOperation) {
                return res.status(404).json({ error: 'Parent operation not found' });
            }
            leftOperand = parentOperation.result;
        }
        else if (discussionId) {
            // Get discussion starting number
            const discussion = await prisma.discussion.findUnique({
                where: { id: discussionId },
            });
            if (!discussion) {
                return res.status(404).json({ error: 'Discussion not found' });
            }
            leftOperand = discussion.startingNumber;
        }
        else {
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
                authorId: req.userId,
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        if (error instanceof Error && error.message === 'Division by zero is not allowed') {
            return res.status(400).json({ error: error.message });
        }
        console.error('Create operation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;

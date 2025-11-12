"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(50),
    password: zod_1.z.string().min(6),
});
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(50),
    password: zod_1.z.string().min(6),
});
// Register
router.post('/register', async (req, res) => {
    try {
        const { username, password } = registerSchema.parse(req.body);
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { username },
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
            },
        });
        // Generate tokens
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = loginSchema.parse(req.body);
        // Find user
        const user = await prisma.user.findUnique({
            where: { username },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Generate tokens
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
        res.json({ accessToken });
    }
    catch (error) {
        console.error('Refresh token error:', error);
        res.status(403).json({ error: 'Invalid refresh token' });
    }
});
exports.default = router;

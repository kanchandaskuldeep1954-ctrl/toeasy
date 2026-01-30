import { z } from 'zod';

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email format'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
    }),
});

export const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'Name is too short'),
        email: z.string().email('Invalid email format'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        role: z.enum(['user', 'admin']).optional(),
    }),
});

export const querySchema = z.object({
    body: z.object({
        query_text: z.string().min(1, 'Query text is required'),
        type: z.enum(['sql', 'natural']).optional(),
    }),
    params: z.object({
        workspaceId: z.string().uuid().optional().or(z.string()), // Allow UUID or string ID
        datasetId: z.string().uuid().optional().or(z.string()),
    })
});

export const cleaningProcessSchema = z.object({
    body: z.object({
        datasetId: z.string().min(1),
        operations: z.array(z.object({
            type: z.string(),
            column: z.string().optional(),
            params: z.record(z.string(), z.any()).optional()
        })).optional(),
        script: z.string().optional(), // For custom scripts
    })
});

export const safeEvalSchema = z.object({
    body: z.object({
        expression: z.string().max(1000, 'Expression too long'),
        context: z.record(z.string(), z.any()).optional()
    })
});

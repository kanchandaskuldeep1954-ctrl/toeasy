/**
 * Workspace Access Middleware (RBAC)
 * Checks if the authenticated user has the required permission level for a workspace.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { query } from '../db.js';

type RequiredRole = 'viewer' | 'editor' | 'admin';

export function checkWorkspaceAccess(requiredRole: RequiredRole = 'viewer') {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            // Workspace ID can be in params or body
            const workspaceId = req.params.workspaceId || req.params.id || req.body.workspaceId;
            const userId = req.user?.id;

            if (!workspaceId) {
                return res.status(400).json({ error: 'Workspace ID is required for permission check' });
            }

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // 1. Check if user is the Owner (always has access)
            const ownerCheck = await query(
                'SELECT user_id FROM workspaces WHERE id = $1',
                [workspaceId]
            );

            if (ownerCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Workspace not found' });
            }

            if (ownerCheck.rows[0].user_id === userId) {
                // Owner has full access, bypass role check
                return next();
            }

            // 2. Check Workspace Members table
            const memberCheck = await query(
                'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
                [workspaceId, userId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ error: 'You do not have access to this workspace' });
            }

            const userRole = memberCheck.rows[0].role;
            const roleHierarchy: Record<string, number> = {
                'viewer': 0,
                'editor': 1,
                'admin': 2
            };

            const userLevel = roleHierarchy[userRole];
            const requiredLevel = roleHierarchy[requiredRole];

            if (userLevel === undefined || userLevel < requiredLevel) {
                return res.status(403).json({
                    error: `Insufficient permissions. Required: ${requiredRole}, Current: ${userRole}`
                });
            }

            // Grant access
            next();

        } catch (err) {
            console.error('Check workspace access error:', err);
            res.status(500).json({ error: 'Internal permission check error' });
        }
    };
}

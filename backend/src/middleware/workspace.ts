import { query } from '../db.js';
import { AuthRequest } from './auth.js';

/**
 * Verify workspace ownership middleware
 * Ensures the logged-in user owns the workspace they are trying to access
 */
export const verifyWorkspaceOwnership = async (req: AuthRequest, res: any, next: Function) => {
    try {
        const { workspaceId } = req.params;

        // If workspaceId is not in params, it might be in the parent router or not applicable
        // But usually we expect it if this middleware is applied to a route with :workspaceId
        if (!workspaceId) {
            return next();
        }

        const result = await query(
            'SELECT user_id FROM workspaces WHERE id = $1',
            [workspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Safety check for user ID type alignment
        const ownerId = result.rows[0].user_id;
        const currentUserId = req.user?.id;

        if (ownerId.toString() !== currentUserId?.toString()) {
            console.warn(`Unauthorized access attempt: User ${currentUserId} tried to access Workspace ${workspaceId} (owned by ${ownerId})`);
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        next();
    } catch (err) {
        console.error('Workspace verification error:', err);
        res.status(500).json({ error: 'Internal server error during verification' });
    }
};

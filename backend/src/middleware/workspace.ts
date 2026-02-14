import { query } from '../db.js';
import { AuthRequest } from './auth.js';

/**
 * Verify workspace ownership middleware
 * Ensures the logged-in user owns the workspace they are trying to access
 */
export const verifyWorkspaceOwnership = async (req: AuthRequest, res: any, next: Function) => {
    try {
        const { workspaceId } = req.params;
        if (!workspaceId) return next();

        let targetWorkspaceId = workspaceId;

        // Resolve 'default' workspace
        if (targetWorkspaceId === 'default') {
            const defaultWs = await query(
                'SELECT id FROM workspaces WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
                [req.user!.id]
            );
            if (defaultWs.rows.length === 0) {
                return res.status(404).json({ error: 'Default workspace not found' });
            }
            targetWorkspaceId = defaultWs.rows[0].id;
            // Ensure downstream handlers use the resolved ID.
            req.params.workspaceId = targetWorkspaceId;
        }

        const result = await query(
            'SELECT user_id FROM workspaces WHERE id = $1',
            [targetWorkspaceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Workspace not found' });
        }

        // Safety check for user ID type alignment
        const ownerId = result.rows[0].user_id;
        const currentUserId = req.user?.id;

        if (ownerId.toString() !== currentUserId?.toString()) {
            console.warn(`Unauthorized access attempt: User ${currentUserId} (type: ${typeof currentUserId}) tried to access Workspace ${workspaceId} (owned by ${ownerId}, type: ${typeof ownerId})`);
            return res.status(403).json({
                error: 'Unauthorized access to workspace',
                message: 'You do not have permission to access this workspace.',
                details: { requested: workspaceId, owner: ownerId, current: currentUserId }
            });
        }

        next();
    } catch (err) {
        console.error('Workspace verification error:', err);
        res.status(500).json({ error: 'Internal server error during verification' });
    }
};

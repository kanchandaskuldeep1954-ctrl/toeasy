/**
 * Invites Routes
 * Handles sending, retrieving, and accepting workspace invitations.
 */

import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';
// import { sendEmail } from '../services/emailService.js'; // TODO: Implement/Import real email service

const router = Router();

function generateInviteToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Send an invite
 * POST /api/invites
 * Body: { workspaceId, email, role }
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { workspaceId, email, role = 'viewer' } = req.body;

        if (!workspaceId || !email) {
            return res.status(400).json({ error: 'Workspace ID and email are required' });
        }

        // 1. Check if requester is owner or admin of the workspace
        // For MVP Day 1, checking if they are the owner is the safest bet until full RBAC middleware is ready.
        // But let's establish the check against workspace_members too for future proofing.
        const ownerCheck = await query(
            'SELECT user_id FROM workspaces WHERE id = $1',
            [workspaceId]
        );

        const memberCheck = await query(
            'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
            [workspaceId, req.user!.id]
        );

        const isOwner = ownerCheck.rows[0]?.user_id === req.user!.id;
        const isAdmin = memberCheck.rows[0]?.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Only admins can invite members' });
        }

        // 2. Check if user is already a member
        const existingMember = await query(
            `SELECT wm.id FROM workspace_members wm
             JOIN users u ON wm.user_id = u.id
             WHERE wm.workspace_id = $1 AND u.email = $2`,
            [workspaceId, email]
        );

        if (existingMember.rows.length > 0) {
            return res.status(400).json({ error: 'User is already a member of this workspace' });
        }

        // 3. Create Invitation
        const token = generateInviteToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        await query(
            `INSERT INTO invitations (workspace_id, email, role, token, invited_by, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (token) DO NOTHING`, // Token collision is rare but possible
            [workspaceId, email, role, token, req.user!.id, expiresAt]
        );

        // 4. Send Email (Mock for MVP functionality, assuming email service hookup later)
        // In a real impl, we'd call emailService.sendInvite(email, token, workspaceName);
        console.log(`[MOCK EMAIL] Invite sent to ${email} with token: ${token}`);

        // TODO: Actually send email
        // await sendEmail({
        //    to: email,
        //    subject: "You've been invited to join a workspace",
        //    html: `<p>Click here to join: <a href="${process.env.FRONTEND_URL}/signup?invite=${token}">Join Workspace</a></p>`
        // });

        res.json({ success: true, message: 'Invite sent', token }); // Returning token for easy testing/dev

    } catch (err) {
        console.error('Send invite error:', err);
        res.status(500).json({ error: 'Failed to send invite' });
    }
});

/**
 * Get invite details (Public)
 * GET /api/invites/:token
 */
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const result = await query(
            `SELECT i.email, i.role, w.name as workspace_name, u.full_name as inviter_name
             FROM invitations i
             JOIN workspaces w ON i.workspace_id = w.id
             LEFT JOIN users u ON i.invited_by = u.id
             WHERE i.token = $1 AND i.status = 'pending' AND i.expires_at > NOW()`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invite not found or expired' });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error('Get invite error:', err);
        res.status(500).json({ error: 'Failed to retrieve invite' });
    }
});

/**
 * Accept invite
 * POST /api/invites/:token/accept
 * Requires Auth (User must be logged in to accept)
 */
router.post('/:token/accept', authenticateToken, async (req: AuthRequest, res) => {
    try {
        const { token } = req.params;
        const userId = req.user!.id;

        // 1. Validate Invite
        const inviteResult = await query(
            `SELECT id, workspace_id, email, role, status, expires_at 
             FROM invitations 
             WHERE token = $1`,
            [token]
        );

        if (inviteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invite not found' });
        }

        const invite = inviteResult.rows[0];

        if (invite.status !== 'pending') {
            return res.status(400).json({ error: 'Invite is no longer valid' });
        }

        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite has expired' });
        }

        // 2. Verify email match?
        // In strict mode, we'd check if req.user.email === invite.email.
        // For MVP flexible adoption, we might allow accepting with any email, 
        // OR warn them. Let's enforce strictly for security.
        // Note: req.user.email might come from token.

        // Let's check DB for user email to be sure
        const userRes = await query('SELECT email FROM users WHERE id = $1', [userId]);
        const userEmail = userRes.rows[0]?.email;

        if (userEmail !== invite.email) {
            // Optional: allow mismatch if creating a new account vs existing? 
            // For now, let's warn.
            // Actually, usually invites are specific to an email.
            return res.status(403).json({ error: `This invite is for ${invite.email}, not ${userEmail}` });
        }

        // 3. Add to Workspace Members
        await query(
            `INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
            // If already member, update role? Or just ignore. Let's update role.
            [invite.workspace_id, userId, invite.role, invite.invited_by]
        );

        // 4. Update Invite Status
        await query(
            `UPDATE invitations SET status = 'accepted' WHERE id = $1`,
            [invite.id]
        );

        res.json({ success: true, message: 'Joined workspace successfully', workspaceId: invite.workspace_id });

    } catch (err) {
        console.error('Accept invite error:', err);
        res.status(500).json({ error: 'Failed to accept invite' });
    }
});

export default router;

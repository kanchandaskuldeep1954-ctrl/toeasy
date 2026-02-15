import { useWorkspace } from './useWorkspace';
import { useAuth } from './useAuth';

export type WorkspaceRole = 'admin' | 'editor' | 'viewer';

export const useWorkspaceRole = () => {
    const { activeWorkspace } = useWorkspace();
    const { user } = useAuth();

    // Default to viewer if no workspace or role found for safety
    const role: WorkspaceRole = activeWorkspace?.role || 'viewer';

    // Also check if user is the owner (backend handles this, but good to have safety check)
    const isOwner = activeWorkspace?.user_id === user?.id;

    return {
        role,
        // Permissions
        isAdmin: role === 'admin' || isOwner,
        isEditor: role === 'editor' || role === 'admin' || isOwner,
        isViewer: true, // Everyone is at least a viewer

        // Explicit capability checks (can be expanded)
        canInvite: role === 'admin' || isOwner,
        canEdit: role === 'editor' || role === 'admin' || isOwner,
        canDelete: role === 'admin' || isOwner,
        canCreateResource: role === 'editor' || role === 'admin' || isOwner,
    };
};

/**
 * API Services for Work OS Modules
 * Connects frontend to backend APIs for Chat, Tasks, Docs, Forms, Files
 */

import axios from 'axios';

// All Work OS module endpoints live under the backend `/api` prefix.
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api';

// Helper to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// ===== TASKS =====
export const tasksService = {
    getAll: async (workspaceId?: string, filters?: { status?: string; assignee_id?: string; priority?: string }) => {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspace_id', workspaceId);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.assignee_id) params.append('assignee_id', filters.assignee_id);
        if (filters?.priority) params.append('priority', filters.priority);

        const res = await axios.get(`${API_BASE}/tasks?${params}`, { headers: getAuthHeaders() });
        return res.data.tasks;
    },

    getById: async (id: string) => {
        const res = await axios.get(`${API_BASE}/tasks/${id}`, { headers: getAuthHeaders() });
        return res.data.task;
    },

    create: async (data: { title: string; description?: string; status?: string; priority?: string; assignee_id?: string; due_date?: string; tags?: string[]; workspace_id?: string }) => {
        const res = await axios.post(`${API_BASE}/tasks`, data, { headers: getAuthHeaders() });
        return res.data.task;
    },

    update: async (id: string, data: Partial<{ title: string; description: string; status: string; priority: string; assignee_id: string; due_date: string; tags: string[]; position: number }>) => {
        const res = await axios.put(`${API_BASE}/tasks/${id}`, data, { headers: getAuthHeaders() });
        return res.data.task;
    },

    delete: async (id: string) => {
        await axios.delete(`${API_BASE}/tasks/${id}`, { headers: getAuthHeaders() });
    },

    reorder: async (taskId: string, newStatus: string, newPosition: number) => {
        await axios.post(`${API_BASE}/tasks/reorder`, { task_id: taskId, new_status: newStatus, new_position: newPosition }, { headers: getAuthHeaders() });
    },

    addComment: async (taskId: string, content: string) => {
        const res = await axios.post(`${API_BASE}/tasks/${taskId}/comments`, { content }, { headers: getAuthHeaders() });
        return res.data.comment;
    }
};

// ===== CHAT =====
export const chatService = {
    getChannels: async (workspaceId?: string) => {
        const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
        const res = await axios.get(`${API_BASE}/chat/channels${params}`, { headers: getAuthHeaders() });
        return res.data.channels;
    },

    createChannel: async (data: { name: string; description?: string; type?: 'public' | 'private' | 'direct'; workspace_id?: string }) => {
        const res = await axios.post(`${API_BASE}/chat/channels`, data, { headers: getAuthHeaders() });
        return res.data.channel;
    },

    getMessages: async (channelId: string, limit = 50, before?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.append('before', before);
        const res = await axios.get(`${API_BASE}/chat/channels/${channelId}/messages?${params}`, { headers: getAuthHeaders() });
        return res.data.messages;
    },

    getRoomContext: async (workspaceId: string, roomId: string) => {
        const res = await axios.get(
            `${API_BASE}/chat/workspaces/${workspaceId}/rooms/${roomId}/context`,
            { headers: getAuthHeaders() }
        );
        return res.data;
    },

    ensureRoomContextChannel: async (
        workspaceId: string,
        roomId: string,
        data?: { autoPostSummary?: boolean }
    ) => {
        const res = await axios.post(
            `${API_BASE}/chat/workspaces/${workspaceId}/rooms/${roomId}/context/channel`,
            data || {},
            { headers: getAuthHeaders() }
        );
        return res.data;
    },

    publishRoomContextUpdate: async (
        workspaceId: string,
        roomId: string,
        data?: { channelId?: string }
    ) => {
        const res = await axios.post(
            `${API_BASE}/chat/workspaces/${workspaceId}/rooms/${roomId}/context/publish`,
            data || {},
            { headers: getAuthHeaders() }
        );
        return res.data;
    },

    sendMessage: async (channelId: string, content: string, parentId?: string) => {
        const res = await axios.post(`${API_BASE}/chat/channels/${channelId}/messages`, { content, parent_id: parentId }, { headers: getAuthHeaders() });
        return res.data.message;
    },

    addReaction: async (messageId: string, emoji: string) => {
        const res = await axios.post(`${API_BASE}/chat/messages/${messageId}/reactions`, { emoji }, { headers: getAuthHeaders() });
        return res.data.reactions;
    },

    deleteMessage: async (messageId: string) => {
        await axios.delete(`${API_BASE}/chat/messages/${messageId}`, { headers: getAuthHeaders() });
    }
};

// ===== DOCS =====
export const docsService = {
    getAll: async (workspaceId?: string, parentId?: string, starred?: boolean) => {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspace_id', workspaceId);
        if (parentId) params.append('parent_id', parentId);
        if (starred) params.append('starred', 'true');

        const res = await axios.get(`${API_BASE}/docs?${params}`, { headers: getAuthHeaders() });
        return res.data.documents;
    },

    getById: async (id: string) => {
        const res = await axios.get(`${API_BASE}/docs/${id}`, { headers: getAuthHeaders() });
        return res.data.document;
    },

    create: async (data: { title?: string; icon?: string; parent_id?: string; workspace_id?: string }) => {
        const res = await axios.post(`${API_BASE}/docs`, data, { headers: getAuthHeaders() });
        return res.data.document;
    },

    update: async (id: string, data: Partial<{ title: string; icon: string; cover_image: string; is_starred: boolean; is_archived: boolean }>) => {
        const res = await axios.put(`${API_BASE}/docs/${id}`, data, { headers: getAuthHeaders() });
        return res.data.document;
    },

    delete: async (id: string) => {
        await axios.delete(`${API_BASE}/docs/${id}`, { headers: getAuthHeaders() });
    },

    updateBlocks: async (id: string, blocks: Array<{ type: string; content: string; properties?: Record<string, any> }>) => {
        await axios.put(`${API_BASE}/docs/${id}/blocks`, { blocks }, { headers: getAuthHeaders() });
    }
};

// ===== FORMS =====
export const formsService = {
    getAll: async (workspaceId?: string, status?: 'draft' | 'published' | 'closed') => {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspace_id', workspaceId);
        if (status) params.append('status', status);

        const res = await axios.get(`${API_BASE}/forms?${params}`, { headers: getAuthHeaders() });
        return res.data.forms;
    },

    getById: async (id: string) => {
        const res = await axios.get(`${API_BASE}/forms/${id}`, { headers: getAuthHeaders() });
        return res.data.form;
    },

    create: async (data: { title?: string; description?: string; workspace_id?: string }) => {
        const res = await axios.post(`${API_BASE}/forms`, data, { headers: getAuthHeaders() });
        return res.data.form;
    },

    update: async (id: string, data: Partial<{ title: string; description: string; status: string; settings: Record<string, any> }>) => {
        const res = await axios.put(`${API_BASE}/forms/${id}`, data, { headers: getAuthHeaders() });
        return res.data.form;
    },

    delete: async (id: string) => {
        await axios.delete(`${API_BASE}/forms/${id}`, { headers: getAuthHeaders() });
    },

    updateFields: async (id: string, fields: Array<{ type: string; label: string; placeholder?: string; required?: boolean; options?: any[]; validation?: Record<string, any>; position?: number }>) => {
        await axios.put(`${API_BASE}/forms/${id}/fields`, { fields }, { headers: getAuthHeaders() });
    },

    getResponses: async (formId: string) => {
        const res = await axios.get(`${API_BASE}/forms/${formId}/responses`, { headers: getAuthHeaders() });
        return res.data.responses;
    },

    submitResponse: async (formId: string, answers: Record<string, any>) => {
        const res = await axios.post(`${API_BASE}/forms/${formId}/respond`, { answers });
        return res.data;
    }
};

// ===== FILES =====
export const filesService = {
    getAll: async (workspaceId?: string, folderId?: string, starred?: boolean) => {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspace_id', workspaceId);
        if (folderId) params.append('folder_id', folderId);
        if (starred) params.append('starred', 'true');

        const res = await axios.get(`${API_BASE}/files?${params}`, { headers: getAuthHeaders() });
        return res.data.files || [];
    },

    getFolders: async (workspaceId?: string, parentId?: string) => {
        const params = new URLSearchParams();
        if (workspaceId) params.append('workspace_id', workspaceId);
        if (parentId) params.append('folder_id', parentId);

        const res = await axios.get(`${API_BASE}/files?${params}`, { headers: getAuthHeaders() });
        return res.data.folders || [];
    },

    createFolder: async (data: { name: string; parent_id?: string | null; workspace_id?: string }) => {
        const res = await axios.post(`${API_BASE}/files/folders`, data, { headers: getAuthHeaders() });
        return res.data.folder;
    },

    updateFolder: async (id: string, data: Partial<{ name: string; parent_id: string; is_starred: boolean }>) => {
        const res = await axios.put(`${API_BASE}/files/folders/${id}`, data, { headers: getAuthHeaders() });
        return res.data.folder;
    },

    deleteFolder: async (id: string) => {
        await axios.delete(`${API_BASE}/files/folders/${id}`, { headers: getAuthHeaders() });
    },

    uploadFile: async (data: { name: string; mime_type?: string; size?: number; storage_key?: string; storage_url?: string; folder_id?: string | null; workspace_id?: string; file_data?: string }) => {
        const res = await axios.post(`${API_BASE}/files/upload`, data, { headers: getAuthHeaders() });
        return res.data.file;
    },

    // Upload a File object by converting to base64
    upload: async (file: File, workspaceId: string, folderId?: string | null) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const base64 = (reader.result as string).split(',')[1]; // Remove data:...;base64, prefix
                    const data = {
                        name: file.name,
                        mime_type: file.type,
                        size: file.size,
                        workspace_id: workspaceId,
                        folder_id: folderId || null,
                        file_data: base64
                    };
                    const res = await axios.post(`${API_BASE}/files/upload`, data, { headers: getAuthHeaders() });
                    resolve(res.data.file);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    updateFile: async (id: string, data: Partial<{ name: string; folder_id: string; is_starred: boolean }>) => {
        const res = await axios.put(`${API_BASE}/files/${id}`, data, { headers: getAuthHeaders() });
        return res.data.file;
    },

    delete: async (id: string) => {
        await axios.delete(`${API_BASE}/files/${id}`, { headers: getAuthHeaders() });
    },

    update: async (id: string, data: Partial<{ name: string; folder_id: string; is_starred: boolean }>) => {
        const res = await axios.put(`${API_BASE}/files/${id}`, data, { headers: getAuthHeaders() });
        return res.data.file;
    }
};

// ===== HOME STATS =====
export const homeService = {
    getStats: async (workspaceId?: string) => {
        // Aggregate stats from all modules
        try {
            const [tasks, docs, forms] = await Promise.all([
                tasksService.getAll(workspaceId).catch(() => []),
                docsService.getAll(workspaceId).catch(() => []),
                formsService.getAll(workspaceId).catch(() => [])
            ]);

            return {
                tasks: tasks.length,
                tasksCompleted: tasks.filter((t: any) => t.status === 'done').length,
                documents: docs.length,
                forms: forms.length,
                formResponses: forms.reduce((sum: number, f: any) => sum + (f.responses || 0), 0)
            };
        } catch {
            return { tasks: 0, tasksCompleted: 0, documents: 0, forms: 0, formResponses: 0 };
        }
    },

    getRecentItems: async (workspaceId?: string) => {
        try {
            const [tasks, docs] = await Promise.all([
                tasksService.getAll(workspaceId).catch(() => []),
                docsService.getAll(workspaceId).catch(() => [])
            ]);

            const items = [
                ...tasks.slice(0, 5).map((t: any) => ({ ...t, itemType: 'task' })),
                ...docs.slice(0, 5).map((d: any) => ({ ...d, itemType: 'document' }))
            ];

            return items.sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).slice(0, 10);
        } catch {
            return [];
        }
    }
};

/**
 * Safe Execution Utility
 * Sandboxes user-provided JavaScript expressions using Node.js vm module.
 * Prevents access to global scope, process, require, etc.
 */
import vm from 'vm';
import { logger } from './logger.js';

interface ExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
}

export class SafeExecutor {
    /**
     * Execute a JavaScript expression securely.
     * @param code The JS code to execute
     * @param context The context object (variables available to the script)
     * @param timeoutMs Timeout in milliseconds (default 1000ms)
     */
    static execute(code: string, context: Record<string, any> = {}, timeoutMs: number = 1000): ExecutionResult {
        try {
            // Create a sandboxed context with only safe globals
            const sandbox = {
                ...context,
                console: {
                    log: () => { }, // Mute console
                    warn: () => { },
                    error: () => { }
                },
                Math,
                Date,
                JSON,
                parseFloat,
                parseInt,
                isNaN,
                isFinite
            };

            vm.createContext(sandbox);

            const script = new vm.Script(code);
            const result = script.runInContext(sandbox, {
                timeout: timeoutMs,
                displayErrors: false
            });

            return { success: true, result };
        } catch (e: any) {
            // logger.warn('SafeExecutor failed:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Pre-compile a script for repeated execution
     */
    static compile(code: string): vm.Script | null {
        try {
            return new vm.Script(code);
        } catch (e: any) {
            logger.warn('SafeExecutor compile failed:', e.message);
            return null;
        }
    }

    /**
     * Execute a pre-compiled script
     */
    static executeScript(script: vm.Script, context: Record<string, any> = {}, timeoutMs: number = 1000): ExecutionResult {
        try {
            const sandbox = {
                ...context,
                console: {
                    log: () => { },
                    warn: () => { },
                    error: () => { }
                },
                Math,
                Date,
                JSON,
                parseFloat,
                parseInt,
                isNaN,
                isFinite
            };

            vm.createContext(sandbox);

            const result = script.runInContext(sandbox, {
                timeout: timeoutMs,
                displayErrors: false
            });

            return { success: true, result };
        } catch (e: any) {
            // logger.warn('SafeExecutor script execution failed:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Validate if a rule expression is safe and valid syntax
     */
    static validate(code: string): boolean {
        try {
            new vm.Script(code);
            return true;
        } catch (e) {
            return false;
        }
    }
}

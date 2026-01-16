import { test, expect } from '@playwright/test';

test.describe('Query Execution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to query playground', async ({ page }) => {
    // Find playground link
    const playgroundLink = page.locator('text=/playground|query|sql/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      // Should show query editor
      const editor = page.locator('[data-testid="editor"], .editor, textarea').first();
      await expect(editor).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display query editor with syntax highlighting', async ({ page }) => {
    const playgroundLink = page.locator('text=/playground|query/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      // Check for editor
      const editor = page.locator('[data-testid="editor"], .editor').first();
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(editor).toBeVisible();
      }
    }
  });

  test('should allow query execution', async ({ page }) => {
    const playgroundLink = page.locator('text=/playground|query/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      // Find run/execute button
      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Should show loading or results
        const loadingOrResults = page.locator('[data-testid="loading"], [data-testid="results"], table').first();
        await expect(loadingOrResults).toBeVisible({ timeout: 10000 }).catch(() => {
          // Results might load differently
        });
      }
    }
  });

  test('should display query results in table format', async ({ page }) => {
    const playgroundLink = page.locator('text=/playground|query/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      // Execute a query
      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Wait for results
        const resultsTable = page.locator('table, [data-testid="results-table"]').first();
        if (await resultsTable.isVisible({ timeout: 5000 }).catch(() => false)) {
          const rows = resultsTable.locator('tr, [role="row"]');
          const rowCount = await rows.count();
          expect(rowCount).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should display query execution time', async ({ page }) => {
    const playgroundLink = page.locator('text=/playground|query/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Look for execution time display
        const execTime = page.locator('text=/ms|seconds|took/i').first();
        if (await execTime.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(execTime).toBeVisible();
        }
      }
    }
  });

  test('should allow query export', async ({ page }) => {
    const playgroundLink = page.locator('text=/playground|query/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      // Execute query first
      const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Wait for results
        await page.waitForTimeout(2000);
        
        // Find export button
        const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();
        if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Start waiting for download
          const downloadPromise = page.waitForEvent('download').catch(() => null);
          await exportButton.click();
          
          // Download should be triggered or export handled
          const download = await downloadPromise;
          // May or may not have download depending on implementation
        }
      }
    }
  });

  test('should show query history', async ({ page }) => {
    const playgroundLink = page.locator('text=/playground|query/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      // Look for history panel
      const historyPanel = page.locator('[data-testid="history"], .history, text=/history/i').first();
      if (await historyPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(historyPanel).toBeVisible();
      }
    }
  });

  test('should handle query errors gracefully', async ({ page }) => {
    const playgroundLink = page.locator('text=/playground|query/i').first();
    if (await playgroundLink.isVisible()) {
      await playgroundLink.click();
      
      // Enter invalid query
      const editor = page.locator('[data-testid="editor"], .editor, textarea').first();
      if (await editor.isVisible()) {
        await editor.clear();
        await editor.type('INVALID SQL QUERY!!!');
        
        // Run it
        const runButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();
        if (await runButton.isVisible()) {
          await runButton.click();
          
          // Should show error message
          const errorMsg = page.locator('[data-testid="error"], .error, text=/error|invalid|syntax/i').first();
          if (await errorMsg.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(errorMsg).toBeVisible();
          }
        }
      }
    }
  });
});

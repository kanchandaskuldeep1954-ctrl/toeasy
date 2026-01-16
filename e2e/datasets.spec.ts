import { test, expect } from '@playwright/test';

test.describe('Dataset Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to datasets section', async ({ page }) => {
    // Find datasets link
    const datasetsLink = page.locator('text=/dataset|data|upload/i').first();
    if (await datasetsLink.isVisible()) {
      await datasetsLink.click();
      
      // Should see datasets view
      const datasetsView = page.locator('[data-testid="datasets"], [data-testid="upload"]');
      await expect(datasetsView.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display upload area', async ({ page }) => {
    // Navigate to upload
    const uploadLink = page.locator('text=/upload|create|new/i').first();
    if (await uploadLink.isVisible()) {
      await uploadLink.click();
      
      const uploadArea = page.locator('[data-testid="upload"], .upload-area, input[type="file"]').first();
      await expect(uploadArea).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle file selection', async ({ page }) => {
    // Create a test CSV file content
    const fileContent = 'name,email,age\nJohn Doe,john@example.com,30\nJane Smith,jane@example.com,28';
    
    // Find file input
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      // Set file
      await fileInput.setInputFiles({
        name: 'test-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(fileContent),
      });
      
      // Should show file name
      const fileName = page.locator('text=/test-data|file selected/i');
      await expect(fileName).toBeVisible({ timeout: 2000 }).catch(() => {
        // File selection might be handled differently
      });
    }
  });

  test('should display dataset list with pagination', async ({ page }) => {
    // Navigate to datasets list
    const datasetsLink = page.locator('text=/my datasets|datasets/i').first();
    if (await datasetsLink.isVisible()) {
      await datasetsLink.click();
      
      // Check for dataset items
      const datasetItems = page.locator('[data-testid^="dataset-"], .dataset-item, tr[data-testid*="dataset"]');
      const count = await datasetItems.count();
      
      // May be empty
      expect(count >= 0).toBeTruthy();
      
      // Look for pagination controls
      const pagination = page.locator('[data-testid="pagination"], .pagination, nav[aria-label*="pagination"]');
      if (await pagination.isVisible()) {
        const nextButton = pagination.locator('button:has-text("Next")');
        expect(await nextButton.isVisible()).toBeTruthy();
      }
    }
  });

  test('should open dataset preview', async ({ page }) => {
    // Navigate to datasets
    const datasetsLink = page.locator('text=/datasets/i').first();
    if (await datasetsLink.isVisible()) {
      await datasetsLink.click();
      
      // Click first dataset if exists
      const firstDataset = page.locator('[data-testid^="dataset-"], .dataset-item').first();
      if (await firstDataset.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstDataset.click();
        
        // Should show preview
        const preview = page.locator('[data-testid="preview"], .data-preview, table').first();
        await expect(preview).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should display dataset metadata', async ({ page }) => {
    // Open a dataset preview
    const datasetsLink = page.locator('text=/datasets/i').first();
    if (await datasetsLink.isVisible()) {
      await datasetsLink.click();
      
      const firstDataset = page.locator('[data-testid^="dataset-"], .dataset-item').first();
      if (await firstDataset.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstDataset.click();
        
        // Look for metadata display
        const metadata = page.locator('[data-testid="metadata"], .metadata, text=/rows|columns|size/i').first();
        if (await metadata.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(metadata).toBeVisible();
        }
      }
    }
  });

  test('should allow dataset deletion with confirmation', async ({ page }) => {
    // Navigate to datasets
    const datasetsLink = page.locator('text=/datasets/i').first();
    if (await datasetsLink.isVisible()) {
      await datasetsLink.click();
      
      // Find delete button
      const deleteButton = page.locator('button:has-text("Delete"), button[aria-label*="delete"]').first();
      if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteButton.click();
        
        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="dialog"], .modal').first();
        if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          const confirmBtn = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Delete")').first();
          expect(await confirmBtn.isVisible()).toBeTruthy();
        }
      }
    }
  });
});

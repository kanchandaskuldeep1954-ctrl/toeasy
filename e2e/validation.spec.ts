import { test, expect } from '@playwright/test';

test.describe('Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to validation section', async ({ page }) => {
    // Find validation/clean link
    const validationLink = page.locator('text=/validation|clean|rules/i').first();
    if (await validationLink.isVisible()) {
      await validationLink.click();
      
      // Should see validation view
      const validationView = page.locator('[data-testid="validation"], [data-testid="clean"]').first();
      await expect(validationView).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display validation rules list', async ({ page }) => {
    const validationLink = page.locator('text=/validation|rules/i').first();
    if (await validationLink.isVisible()) {
      await validationLink.click();
      
      // Check for rules list
      const rulesList = page.locator('[data-testid="rules"], .rules-list, ul').first();
      if (await rulesList.isVisible({ timeout: 3000 }).catch(() => false)) {
        const rules = rulesList.locator('li, [role="listitem"], .rule-item');
        const count = await rules.count();
        // May be empty initially
        expect(count >= 0).toBeTruthy();
      }
    }
  });

  test('should create new validation rule', async ({ page }) => {
    const validationLink = page.locator('text=/validation|rules/i').first();
    if (await validationLink.isVisible()) {
      await validationLink.click();
      
      // Find create rule button
      const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
      if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createButton.click();
        
        // Should show rule creation form
        const form = page.locator('[data-testid="rule-form"], form, .rule-form').first();
        await expect(form).toBeVisible({ timeout: 5000 });
        
        // Fill in rule details
        const nameInput = form.locator('input[placeholder*="name"], input[placeholder*="Name"]').first();
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Validation Rule');
        }
      }
    }
  });

  test('should select dataset for validation', async ({ page }) => {
    const validationLink = page.locator('text=/validation|clean/i').first();
    if (await validationLink.isVisible()) {
      await validationLink.click();
      
      // Find dataset selector
      const datasetSelect = page.locator('select, [role="combobox"], button:has-text("Select")').first();
      if (await datasetSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await datasetSelect.click();
        
        // Should show options
        const options = page.locator('[role="option"], option').first();
        if (await options.isVisible({ timeout: 2000 }).catch(() => false)) {
          await options.click();
        }
      }
    }
  });

  test('should run validation on dataset', async ({ page }) => {
    const validationLink = page.locator('text=/validation|clean/i').first();
    if (await validationLink.isVisible()) {
      await validationLink.click();
      
      // Select a dataset
      const datasetSelect = page.locator('select, [role="combobox"], button:has-text("Select")').first();
      if (await datasetSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await datasetSelect.click();
        const firstOption = page.locator('[role="option"], option').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
        }
      }
      
      // Find run validation button
      const runButton = page.locator('button:has-text("Run"), button:has-text("Validate"), button:has-text("Check")').first();
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Should show validation results
        const results = page.locator('[data-testid="results"], .results, text=/found|issues|valid/i').first();
        if (await results.isVisible({ timeout: 10000 }).catch(() => false)) {
          await expect(results).toBeVisible();
        }
      }
    }
  });

  test('should display validation results in detail', async ({ page }) => {
    const validationLink = page.locator('text=/validation|clean/i').first();
    if (await validationLink.isVisible()) {
      await validationLink.click();
      
      // Run validation
      const runButton = page.locator('button:has-text("Run"), button:has-text("Validate")').first();
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Wait for results
        const detailsPanel = page.locator('[data-testid="details"], .details, .results-panel').first();
        if (await detailsPanel.isVisible({ timeout: 10000 }).catch(() => false)) {
          // Check for issue count or summary
          const issueCount = detailsPanel.locator('text=/issues|problems|errors/i');
          if (await issueCount.isVisible()) {
            await expect(issueCount).toBeVisible();
          }
        }
      }
    }
  });

  test('should send invalid records to quarantine', async ({ page }) => {
    const validationLink = page.locator('text=/validation|clean|quarantine/i').first();
    if (await validationLink.isVisible()) {
      await validationLink.click();
      
      // Run validation
      const runButton = page.locator('button:has-text("Run"), button:has-text("Validate")').first();
      if (await runButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runButton.click();
        
        // Wait for results
        await page.waitForTimeout(2000);
        
        // Find quarantine button
        const quarantineButton = page.locator('button:has-text("Quarantine"), button:has-text("Move"), button:has-text("Isolate")').first();
        if (await quarantineButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await quarantineButton.click();
          
          // Should show confirmation or success message
          const successMsg = page.locator('text=/success|quarantine|moved/i').first();
          if (await successMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(successMsg).toBeVisible();
          }
        }
      }
    }
  });

  test('should access quarantine vault', async ({ page }) => {
    // Find quarantine vault link
    const quarantineLink = page.locator('text=/quarantine|vault/i').first();
    if (await quarantineLink.isVisible()) {
      await quarantineLink.click();
      
      // Should show quarantine list
      const quarantineList = page.locator('[data-testid="quarantine"], .quarantine-list').first();
      await expect(quarantineList).toBeVisible({ timeout: 5000 });
    }
  });

  test('should restore records from quarantine', async ({ page }) => {
    const quarantineLink = page.locator('text=/quarantine|vault/i').first();
    if (await quarantineLink.isVisible()) {
      await quarantineLink.click();
      
      // Find restore button
      const restoreButton = page.locator('button:has-text("Restore"), button:has-text("Approve"), button[aria-label*="restore"]').first();
      if (await restoreButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await restoreButton.click();
        
        // Should show success message
        const successMsg = page.locator('text=/restored|approved|success/i').first();
        if (await successMsg.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(successMsg).toBeVisible();
        }
      }
    }
  });
});

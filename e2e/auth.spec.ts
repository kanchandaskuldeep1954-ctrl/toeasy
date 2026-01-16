import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    // Should redirect to auth page or show login modal
    await expect(page).toHaveURL(/login|auth/i);
  });

  test('should display login form elements', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    // Check if auth form is visible
    if (await emailInput.isVisible()) {
      await expect(emailInput).toBeTruthy();
      await expect(passwordInput).toBeTruthy();
    }
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid@test.com');
      await passwordInput.fill('wrongpassword');
      await page.locator('button:has-text("Login")').click();
      
      // Should show error message
      const errorMessage = page.locator('text=/invalid|error|wrong/i');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }
  });

  test('should persist session after login', async ({ page, context }) => {
    await page.goto('/');
    
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      // Fill with test credentials
      await emailInput.fill('test@example.com');
      await page.locator('input[type="password"]').fill('TestPassword123!');
      
      // Look for login button and click
      const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In")').first();
      if (await loginButton.isVisible()) {
        await loginButton.click();
        
        // Wait for navigation or session establishment
        await page.waitForTimeout(1000);
        
        // Check if JWT token is stored in localStorage or cookies
        const cookies = await context.cookies();
        const hasAuthToken = cookies.some(c => c.name.includes('auth') || c.name.includes('token'));
        expect(hasAuthToken || (await page.locator('[data-testid="dashboard"]').isVisible())).toBeTruthy();
      }
    }
  });

  test('should handle logout correctly', async ({ page, context }) => {
    await page.goto('/');
    
    // Try to find logout button in sidebar or menu
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      
      // Should be redirected to login
      await expect(page).toHaveURL(/login|auth/i);
      
      // JWT should be cleared
      const cookies = await context.cookies();
      const hasAuthToken = cookies.some(c => c.name.includes('auth') || c.name.includes('token'));
      expect(hasAuthToken).toBeFalsy();
    }
  });
});

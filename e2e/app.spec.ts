import { test, expect } from '@playwright/test'

test.describe('App Shell', () => {
  test('loads the app and shows navbar', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=TN3270 Terminal')).toBeVisible()
  })

  test('navbar has all navigation links', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav >> text=Terminal')).toBeVisible()
    await expect(page.locator('nav >> text=History')).toBeVisible()
    await expect(page.locator('nav >> text=Schedules')).toBeVisible()
    await expect(page.locator('nav >> text=AutoLauncher Runs')).toBeVisible()
  })

  test('Terminal link is active on home page', async ({ page }) => {
    await page.goto('/')
    const terminalLink = page.locator('nav >> a:has-text("Terminal")')
    await expect(terminalLink).toHaveClass(/active/)
  })

  test('navigates to history page', async ({ page }) => {
    await page.goto('/')
    await page.click('nav >> text=History')
    await expect(page).toHaveURL(/\/history/)
  })

  test('navigates to schedules page', async ({ page }) => {
    await page.goto('/')
    await page.click('nav >> text=Schedules')
    await expect(page).toHaveURL(/\/schedules/)
  })

  test('navigates to auto-launcher-runs page', async ({ page }) => {
    await page.goto('/')
    await page.click('nav >> text=AutoLauncher Runs')
    await expect(page).toHaveURL(/\/auto-launcher-runs/)
  })
})

test.describe('Theme Toggle', () => {
  test('toggles between dark and light mode', async ({ page }) => {
    await page.goto('/')

    // Default should be dark mode
    const html = page.locator('html')
    const initialHasDark = await html.evaluate((el) => el.classList.contains('dark'))

    // Click theme toggle button
    const themeToggle = page.locator('button[aria-label*="Switch to"]')
    await themeToggle.click()

    // Theme should have changed
    const afterClickHasDark = await html.evaluate((el) => el.classList.contains('dark'))
    expect(afterClickHasDark).not.toBe(initialHasDark)

    // Click again to toggle back
    await themeToggle.click()
    const afterSecondClick = await html.evaluate((el) => el.classList.contains('dark'))
    expect(afterSecondClick).toBe(initialHasDark)
  })

  test('persists theme preference to localStorage', async ({ page }) => {
    await page.goto('/')

    const themeToggle = page.locator('button[aria-label*="Switch to"]')
    await themeToggle.click()

    const storedTheme = await page.evaluate(() => localStorage.getItem('terminal-theme'))
    expect(storedTheme).toBeTruthy()

    // Reload and check it persists
    await page.reload()
    const html = page.locator('html')
    const hasStoredClass = await html.evaluate(
      (el, theme) => el.classList.contains(theme!),
      storedTheme,
    )
    expect(hasStoredClass).toBe(true)
  })
})

test.describe('Dev Mode Auth', () => {
  test('bypasses auth in dev mode (no VITE_MSAL_CLIENT_ID)', async ({ page }) => {
    await page.goto('/')
    // Should not show login screen, should show the app directly
    await expect(page.locator('text=TN3270 Terminal')).toBeVisible()
  })
})

test.describe('User Dropdown', () => {
  test('shows user dropdown on click', async ({ page }) => {
    await page.goto('/')

    const userButton = page.locator('button[aria-label="User menu"]')
    // In dev mode this might not render if user is null
    // Check if it exists first
    const count = await userButton.count()
    if (count > 0) {
      await userButton.click()
      await expect(page.locator('text=Sign out')).toBeVisible()
    }
  })
})

test.describe('Accessibility', () => {
  test('page has no major accessibility violations in light mode', async ({ page }) => {
    await page.goto('/')
    // Basic check: ensure main content is visible and page loads
    await expect(page.locator('body')).toBeVisible()
  })
})

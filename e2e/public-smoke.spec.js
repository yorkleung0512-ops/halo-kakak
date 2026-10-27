import { expect, test } from '@playwright/test'

test.describe('public smoke', () => {
  test('SignIn loads brand and bilingual CTA', async ({ page }) => {
    await page.goto('/signin')
    await expect(page.getByRole('heading', { name: 'Halo Kakak' })).toBeVisible()
    await expect(page.getByRole('button', { name: '發送登入連結' })).toBeVisible()
    await expect(page.getByRole('link', { name: '私隱' })).toBeVisible()
  })

  test('Legal privacy / terms / pics load', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: '私隱政策' })).toBeVisible()

    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: '服務條款' })).toBeVisible()

    await page.goto('/pics')
    await expect(
      page.getByRole('heading', { name: /個人資料收集聲明/ }),
    ).toBeVisible()
  })

  test('junk invite token soft-gate on SignIn', async ({ page }) => {
    await page.goto('/signin?invite=test')
    await expect(page.getByRole('alert')).toContainText(/邀請連結無效|tidak valid/i)
  })

  test('junk invite path shows invalid invite screen', async ({ page }) => {
    await page.goto('/invite/test')
    await expect(page.getByRole('heading', { name: '邀請無效' })).toBeVisible()
    await expect(page.getByRole('button', { name: /返回登入/ })).toBeVisible()
  })
})

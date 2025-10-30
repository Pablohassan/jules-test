from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:5173/new")
    page.fill('input[name="keywords"]', "AI Agents")
    page.click('button[type="submit"]')
    page.wait_for_url("http://localhost:5173/runs")
    page.screenshot(path="jules-scratch/verification/new-run.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)

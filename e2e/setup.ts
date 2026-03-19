import { Before, BeforeAll, AfterAll, After, setDefaultTimeout } from "@cucumber/cucumber"
import debug from "debug"
import * as playwright from "@playwright/test"
import { getLatestLinkSentTo, getE2EHostMode, getLoginBaseURL, getUserEmail } from "./step_definitions/fns"
import { FiderWorld } from "./world"

setDefaultTimeout(10 * 1000) // 10 seconds for CI environments

let browser: playwright.Browser
let tenantName: string
type BrowserName = "chromium" | "firefox" | "webkit"

BeforeAll({ timeout: 30 * 1000 }, async function () {
  const name = (process.env.BROWSER || "chromium") as BrowserName
  browser = await playwright[name].launch({
    headless: process.env.HEADED !== "true",
    slowMo: process.env.HEADED === "true" ? 100 : 10,
  })

  if (!tenantName) {
    const now = new Date().getTime()
    tenantName = `feedback${now}`
    await createNewSite()
  }
})

AfterAll(async function () {
  await browser.close()
})

Before(async function (this: FiderWorld) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  })

  this.page = await context.newPage()
  this.tenantName = tenantName
  this.log = debug("e2e")
})

After(async function (this: FiderWorld) {
  await this.page.close()
})

async function createNewSite() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  const adminEmail = getUserEmail(tenantName, "admin")
  const hostMode = getE2EHostMode()
  const signUpURL = `${getLoginBaseURL()}/signup`

  // Create site if needed
  await page.goto(signUpURL)
  if (hostMode === "single") {
    const hasSignUpForm = await page
      .locator("#p-signup")
      .isVisible()
      .catch(() => false)
    if (!hasSignUpForm) {
      await page.close()
      return
    }
  }
  await page.goto(signUpURL)
  await page.fill("#input-name", "admin")
  await page.fill("#input-email", adminEmail)
  await page.fill("#input-tenantName", tenantName)
  if (hostMode === "multi") {
    await page.fill("#input-subdomain", tenantName)
  }
  await page.check("#input-legalAgreement")
  await page.click(".c-button--primary")
  // Activate site
  //Activate site
  const activationLink = await getLatestLinkSentTo(adminEmail)
  await page.goto(activationLink)
  await page.close()
}

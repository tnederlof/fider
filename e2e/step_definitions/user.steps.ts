import { Given } from "@cucumber/cucumber"
import { FiderWorld } from "e2e/world"
import { getE2EHostMode, getLatestCodeSentTo, getUserEmail, isAuthenticated, isAuthenticatedAsUser, setAuthCookie } from "./fns"

Given("I sign in as {string}", async function (this: FiderWorld, userName: string) {
  // In single-host mode, bypass email auth by setting a JWT cookie directly
  if (getE2EHostMode() === "single") {
    const userEmail = getUserEmail(this.tenantName, userName)
    await setAuthCookie(this.page, 1, userName, userEmail)
    await this.page.reload()
    return
  }

  if (await isAuthenticatedAsUser(this.page, userName)) {
    return
  }

  if (await isAuthenticated(this.page)) {
    await this.page.click(".c-menu-user .c-dropdown__handle")
    await this.page.click("a[href='/signout']")
  }

  const userEmail = getUserEmail(this.tenantName, userName)
  await this.page.getByRole("button", { name: "Sign in" }).click()
  await this.page.fill(".c-signin-control #input-email", userEmail)
  await this.page.click(".c-signin-control .c-button--primary")

  // Get the code from email and enter it
  const code = await getLatestCodeSentTo(userEmail)
  await this.page.fill("#input-code", code)
  await this.page.getByRole("button", { name: "submit" }).click()

  // Wait for navigation after successful code verification
  await this.page.waitForLoadState("networkidle")
})

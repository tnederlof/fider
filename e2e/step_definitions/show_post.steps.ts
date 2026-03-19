import { Then, Given } from "@cucumber/cucumber"
import { FiderWorld } from "../world"
import { expect } from "@playwright/test"

Then("I should be on the show post page", async function (this: FiderWorld) {
  const container = await this.page.$$(".p-show-post")
  expect(container).toBeDefined()
})

Then("I should see {string} as the post title", async function (this: FiderWorld, title: string) {
  const postTitle = await this.page.innerText(".p-show-post__title")
  expect(postTitle).toBe(title)
})

Then("I should see {int} vote\\(s)", async function (this: FiderWorld, voteCount: number) {
  // Look for the vote count number within the post detail view
  await expect(this.page.locator(".p-show-post .text-2xl").filter({ hasText: voteCount.toString() })).toBeVisible()
})

Given("I click respond", async function (this: FiderWorld) {
  await this.page.getByRole("button", { name: "Respond" }).click()
})

Given("I choose {string} as the response status", async function (this: FiderWorld, status: string) {
  await this.page.selectOption("#input-status", status)
})

Given("I submit the response modal", async function (this: FiderWorld) {
  const modal = this.page.locator(".c-response-form")
  await expect(modal).toBeVisible()

  // Start listening for Sentry request BEFORE clicking submit,
  // so we don't miss the event.
  this.sentryResponsePromise = this.page.waitForResponse((resp) => resp.url().includes("sentry.io"), { timeout: 15000 })

  await this.page.getByRole("button", { name: "Submit" }).click()
})

Then("I should see the error page", async function (this: FiderWorld) {
  // Wait for Sentry to capture and send the error event.
  const sentryResponsePromise = this.sentryResponsePromise
  expect(sentryResponsePromise).toBeDefined()
  if (!sentryResponsePromise) {
    throw new Error("Expected a Sentry response promise to be set before checking the error page")
  }

  const sentryResponse = await sentryResponsePromise
  expect(sentryResponse.ok()).toBeTruthy()
})

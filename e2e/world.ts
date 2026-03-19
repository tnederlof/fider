import { World as CucumberWorld } from "@cucumber/cucumber"
import { Page, Response } from "@playwright/test"

export interface FiderWorld extends CucumberWorld {
  tenantName: string
  page: Page
  log: (msg: string) => void
  sentryResponsePromise?: Promise<Response>
}

import { Page } from "@playwright/test"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "hsjl]W;&ZcHxT&FK;s%bgIQF:#ch=~#Al4:5]N;7V<qPZ3e9lT4'%;go;LIkc%k"

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createAuthToken(userId: number, userName: string, userEmail: string): string {
  return jwt.sign(
    {
      "user/id": userId,
      "user/name": userName,
      "user/email": userEmail,
      origin: "ui",
    },
    JWT_SECRET,
    { expiresIn: "365d" }
  )
}

export async function setAuthCookie(page: Page, userId: number, userName: string, userEmail: string): Promise<void> {
  const token = createAuthToken(userId, userName, userEmail)
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000"
  const url = new URL(baseURL)
  await page.context().addCookies([
    {
      name: "auth",
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
    },
  ])
}

export function getE2EHostMode(): "single" | "multi" {
  return process.env.E2E_HOST_MODE === "single" ? "single" : "multi"
}

export function getLoginBaseURL(): string {
  return process.env.E2E_LOGIN_BASE_URL || "https://login.dev.fider.io:3000"
}

export function getAppBaseURL(tenantName: string): string {
  if (getE2EHostMode() === "single") {
    return process.env.E2E_BASE_URL || "http://localhost:3000"
  }

  const template = process.env.E2E_BASE_URL_TEMPLATE
  if (template) {
    return template.replace("{tenant}", tenantName)
  }

  return `https://${tenantName}.dev.fider.io:3000`
}

export function getUserEmail(tenantName: string, userName: string): string {
  if (getE2EHostMode() === "single") {
    return process.env.E2E_ADMIN_EMAIL || `${userName}@fider.io`
  }

  return `${userName}-${tenantName}@fider.io`
}

export function getAnonymousUserEmail(tenantName: string): string {
  if (getE2EHostMode() === "single") {
    return process.env.E2E_USER_EMAIL || "user@fider.io"
  }

  return `$user-${tenantName}@fider.io`
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  const serverData = JSON.parse(await page.innerText("#server-data"))
  return serverData.user !== undefined
}

// On E2E test, every user is created as {userName}-{tenantName}
export async function isAuthenticatedAsUser(page: Page, userName: string): Promise<boolean> {
  const serverData = JSON.parse(await page.innerText("#server-data"))
  if (!serverData.user) {
    return false
  }

  const expectedEmail = getUserEmail("unused", userName)
  return serverData.email === expectedEmail || serverData.email.startsWith(userName)
}

export async function getLatestLinkSentTo(address: string): Promise<string> {
  await delay(1000)

  const response = await fetch(`http://localhost:8025/api/v2/search?kind=to&query=${address}`)
  const responseBody = await response.json()
  const emailHtml = responseBody.items[0].Content.Body
  const reg = /https?:\/\/[^/]+\/(.*)verify\?k=.+?(?=['"])/gim
  const result = reg.exec(emailHtml)
  if (!result) {
    throw new Error("Could not find a link in email content.")
  }

  return result[0]
}

export async function getLatestCodeSentTo(address: string): Promise<string> {
  await delay(1000)

  const response = await fetch(`http://localhost:8025/api/v2/search?kind=to&query=${address}`)
  const responseBody = await response.json()
  const emailHtml = responseBody.items[0].Content.Body
  // Look for 6-digit code in the email
  const reg = /\b\d{6}\b/
  const result = reg.exec(emailHtml)
  if (!result) {
    throw new Error("Could not find a 6-digit code in email content.")
  }

  return result[0]
}

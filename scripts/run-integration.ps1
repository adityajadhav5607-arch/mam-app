$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
  throw "Run from project root"
}

npx playwright test tests/api.chat.spec.ts tests/ui.chat.spec.ts

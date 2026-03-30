---
name: App Flow
description: Full page/route flow for pipntick.trade
---

# App Flow

> 🌐 = Public page &nbsp;|&nbsp; 🔒 = Authenticated &nbsp;|&nbsp; ⚠️ = Auth utility

```mermaid
flowchart TD
    %% =========================
    %% Root / Landing
    %% =========================
    Home[🌐 Home / Landing Page]

    %% =========================
    %% User Authentication
    %% =========================
    Home --> Login[🌐 Login Page]
    Home --> Register[🌐 Register Page]

    %% Forgot Password / Username flows
    Login --> ForgotPassword[⚠️ Forgot Password Page]
    Login --> ForgotUsername[⚠️ Forgot Username Page]
    ForgotPassword --> ResetPassword[⚠️ Reset Password Page]
    ForgotUsername --> UsernameRecovery[⚠️ Username Recovery Confirmation]

    %% =========================
    %% Pre-Dashboard / Trading Account Check
    %% =========================
    Login --> TradingAccountCheck[🔒 Check Trading Account<br/>No account → Add/Create Account<br/>1 account → Use account<br/>>1 account → Use default account]
    Register --> TradingAccountCheck

    AddOrCreateAccount[🔒 Add / Create Trading Account Page]

    TradingAccountCheck -->|No accounts| AddOrCreateAccount
    TradingAccountCheck -->|1 account| Dashboard[🔒 Dashboard / Main Page]
    TradingAccountCheck -->|>1 account| Dashboard

    AddOrCreateAccount --> Dashboard

    %% =========================
    %% Trade Management
    %% =========================
    Dashboard --> AddTrade[🔒 Add Trade Page]
    AddTrade --> ManualEntry[🔒 Manual Trade Entry Form]
    AddTrade --> CSVImport[🔒 Import Trades via CSV]
    AddTrade --> ScreenshotUpload[🔒 Upload Trade Screenshot]
    AddTrade --> MT4Sync[🔒 MT4 / MT5 EA Live Sync]

    %% =========================
    %% Analytics & Calendar
    %% =========================
    Dashboard --> Calendar[🔒 Trading Calendar Page]
    Calendar --> CalendarLegend[🔒 Legend: Green = Profit, Red = Loss]

    Dashboard --> Performance[🔒 Performance Analytics Page]
    Performance --> TimeRange[🔒 Select Time Range]
    TimeRange --> WeeklyView[🔒 Weekly View]
    TimeRange --> MonthlyView[🔒 Monthly View]
    TimeRange --> YearlyView[🔒 Yearly View]

    Performance --> TradeAnalysis[🔒 Select Trade for AI Analysis]
    TradeAnalysis --> AIReport[🔒 View AI Report + Trade Chart]

    %% =========================
    %% Market News & Economic Calendar (Public)
    %% =========================
    Home --> MarketNews[🌐 Market News & Economic Calendar]
    Dashboard --> MarketNews
    MarketNews --> EconomicEvents[🌐 View Economic Events]
    EconomicEvents --> FilterEvents[🌐 Filter by Country/Currency/Impact]
```

## Route Map

| Route | Access | Page |
|-------|--------|------|
| `/` | Public | Landing page |
| `/login` | Public | Login |
| `/register` | Public | Register |
| `/forgot-password` | Public | Forgot password |
| `/forgot-username` | Public | Forgot username |
| `/reset-password` | Public | Reset password |
| `/news` | Public | Market news & economic calendar |
| `/dashboard` | Auth | Main dashboard |
| `/accounts/new` | Auth | Add / create trading account |
| `/trades/new` | Auth | Add trade (manual, CSV, screenshot, MT4) |
| `/calendar` | Auth | Trading calendar |
| `/performance` | Auth | Performance analytics |
| `/performance/:tradeId/analysis` | Auth | AI report + trade chart |

# CLAUDE.md

## Project
ZASS — REST API backend serving a Flutter mobile frontend.

## App Context
See .claude/APP_CONTEXT.md for full domain map, route list,
and business rules. Read it alongside this file.


## Claude Instructions
- All code comments and variable names: English
- All responses and explanations to the developer: English
- Prioritize readable, clear code over clever or complex solutions
- If two approaches exist, always choose the one a junior dev can understand
- Never sacrifice clarity for brevity

## Stack
- Node.js 20 LTS
- Express.js
- TypeScript (strict)
- Zod — validation only, no class-validator
- Prisma ORM + PostgreSQL via Neon (serverless)
- JWT auth — Bearer token via Authorization header (no cookies, Flutter client)

## Folder Structure & Layer Responsibilities

src/
├── config/       Env validation (Zod), db client, cors, external services
├── constants/    Enums, static values, error codes — no functions
├── controllers/  Thin handlers — extract input, call service, send response
├── lib/          Stateful internal libs — jwt.ts, logger.ts, AppError.ts
├── middlewares/  validate.ts, auth.ts, error.ts — one concern per file
├── routes/       Wire path + middleware + controller only — no logic
├── schemas/      Zod schemas + inferred types — one file per domain
├── services/     All business logic — one file per domain
├── utils/        Pure stateless helper functions — no Express, no DB
└── types.d.ts    Express.Request augmentation


## Neon + Prisma Setup

Neon is a serverless PostgreSQL provider. It requires two separate
connection strings — one pooled (for the app), one direct (for migrations).

## Absolute Layer Rules

### Controllers
- Extract validated input, call one service method, send response
- Never contain business logic or DB queries
- Never catch errors — let them bubble to error middleware
- Max 30 lines per handler — if longer, move logic to service

### Services
- Own all business logic
- Never import Request, Response, or NextFunction
- Throw AppError for expected failures
- Return plain typed objects only
- Input is ALWAYS typed with the inferred type from the domain Zod schema
  (e.g. `register(input: RegisterInput)`) — never with an inline/duplicated shape
- Trust that input: validation already happened in the validate() middleware via
  the schema. Services do NOT re-validate field shapes (format, length, required).
  They only check business rules the schema cannot know (uniqueness, existence,
  ownership, state) and throw AppError for those.
- The Zod schema is the single source of truth for input shape — if the input
  shape needs to change, change the schema, never re-declare it in the service

### Schemas
- Always export both the Zod schema AND the inferred type
- Use z.coerce.number() for route params (Express gives strings)
- Never inline schemas in routes or controllers
- Schemas are the ONLY place input validation lives — every service input type is
  inferred from here, so the schema is the single source of truth for input shape

### Routes
- Only: path + middleware stack + controller reference
- Always: validate() middleware before controller on mutating routes
- Always: authenticate middleware on protected routes

### Middlewares
- validate.ts — Zod safeParse, passes ZodError to next()
- auth.ts — Bearer token extraction + verifyAccessToken
- error.ts — ALWAYS last in app.ts, handles AppError + ZodError + unknown

### Prisma
- DB client lives in config/database.ts — single instance, imported everywhere
- Never instantiate PrismaClient outside config/database.ts
- Schema lives in prisma/schema.prisma
- Migrations: always use prisma migrate dev --name <description>
- Never use prisma db push in production
- Always use transactions for operations that touch multiple tables
- Seed file lives in prisma/seed.ts

## Error Handling

### AppError
Located at lib/AppError.ts — always import from there, never redefine.

### Rules
- Services throw AppError for operational errors (400, 401, 403, 404, 409)
- Unknown errors propagate as plain Error — error middleware handles them
- Controllers never catch — zero try/catch in controllers
- Error middleware is the single place responses are sent for errors

### Response shape — enforced on every route
// Success
{ success: true, data: T }
// Error
{ success: false, error: { message: string, code: string, fields?: Record<string, string[]> } }

## Auth — Bearer Token
- Flutter sends: Authorization: Bearer <accessToken>
- Access token: short-lived (15m)
- Refresh token: long-lived (30d), stored in DB (Token table in Prisma)
- Refresh endpoint: POST /auth/refresh — accepts { refreshToken: string } in body
- On access token expiry: Flutter calls /auth/refresh, gets new access token
- Revocation: delete Token row from DB on logout

## Prisma Conventions
- Model names: PascalCase singular (Task, User, Token)
- Field names: camelCase
- All models have: id, createdAt, updatedAt
- Soft delete pattern: deletedAt DateTime? — never hard delete user data
- Relations: always define both sides
- Indexes: add @@index on every foreign key field

## TypeScript Rules
- strict: true — no exceptions
- No any — use unknown and narrow
- Infer types from Zod schemas — never duplicate manually
- Prefer type over interface for data shapes
- interface only for things that get implemented or extended

## Naming Conventions
- Files: kebab-case (task.service.ts)
- Classes: PascalCase (AppError)
- Functions: camelCase (createTask)
- Zod schemas: camelCase + Schema (createTaskSchema)
- Inferred types: PascalCase (CreateTaskInput)
- Constants: SCREAMING_SNAKE_CASE
- Routes: kebab-case plural (/api/tasks)
- Env vars: SCREAMING_SNAKE_CASE

## Code Habits
- No console.log — use lib/logger.ts
- No floating promises — always await or explicitly handle
- Wrap async Express handlers with asyncHandler (utils/asyncHandler.ts)
- No dead code committed — delete it
- No magic numbers — use constants/
- No hardcoded secrets — always config/env.ts
- One domain concern per service file — never merge Task + User logic

## What Claude Must Never Do
- Add business logic to controllers
- Re-validate input shape inside a service, or type a service input with anything
  other than the inferred type from its Zod schema — validation comes from the
  schema, services only enforce business rules
- Import Express types into services
- Use `any` without an explicit justification comment
- Inline Zod schemas in route or controller files
- Catch errors inside controllers
- Create PrismaClient instances outside config/database.ts
- Use prisma db push instead of migrations
- Return inconsistent response shapes
- Create files outside the defined folder structure without asking first
- Generate a migration — always tell me to run it myself
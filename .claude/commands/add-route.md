<!-- .claude/commands/add-route.md -->
# Add Route

Create a complete route for the domain: $ARGUMENTS

Generate in this exact order:
1. schemas/$ARGUMENTS.schema.ts — Zod schemas + inferred types
2. services/$ARGUMENTS.service.ts — business logic, Prisma calls
3. controllers/$ARGUMENTS.controller.ts — thin handlers only
4. routes/$ARGUMENTS.routes.ts — wired with authenticate + validate + asyncHandler

Follow every rule in CLAUDE.md exactly.
Do not generate a Prisma migration — tell me to run it.
After generating, show me the route registration line
I need to add to app.ts.
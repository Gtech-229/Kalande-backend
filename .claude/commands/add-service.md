<!-- .claude/commands/add-service.md -->
# Add Service Method

Add a new method to services/$ARGUMENTS.service.ts

Rules:
- No Express imports
- Throw AppError for operational failures
- Use Prisma transaction if touching more than one table
- Export the new inferred input type from schemas/ if a new payload shape is needed
- Show me if any schema changes are required
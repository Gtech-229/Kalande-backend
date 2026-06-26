<!-- .claude/commands/add-schema.md -->
# Add Schema

Add a new Zod schema to schemas/$ARGUMENTS.schema.ts

Rules:
- Export both the schema and the inferred type
- Use z.coerce.number() for any id or numeric param
- Add .min() / .max() / .email() constraints where semantically appropriate
- Never use z.any()
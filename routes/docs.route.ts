import { Router } from "express";
import path from "node:path";

/**
 * API docs — serves the OpenAPI spec and a Swagger UI page (CLAUDE.md: routes
 * wire path + handler; this is static infra, like the /health endpoint).
 *
 * Swagger UI is loaded from a CDN, so there is NO npm dependency. The spec is
 * read from disk at request time, relative to the process working directory
 * (the app dir), so it works both in dev (project root) and prod (/srv/zass).
 *
 * Public by design so the frontend team can browse it. To restrict it, gate
 * these routes behind authenticate/authorize, or skip mounting in production.
 */
const router = Router();

const SWAGGER_JSON_PATH = path.join(process.cwd(), "docs", "swagger.json");

// Raw OpenAPI spec — consumed by the Swagger UI page below and by tooling
// (Postman import, Dart client generation, etc.).
router.get("/swagger.json", (_req, res) => {
  res.sendFile(SWAGGER_JSON_PATH);
});

// Swagger UI shell, pinned to a major version from the CDN.
const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ZASS API — Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/docs/swagger.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
      });
    </script>
  </body>
</html>`;

router.get("/", (_req, res) => {
  res.type("html").send(SWAGGER_UI_HTML);
});

export default router;

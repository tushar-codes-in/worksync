import { Router } from 'express';
import { getOpenApiSpec } from './openapi';

export function buildDocsRouter() {
  const r = Router();
  const spec = getOpenApiSpec();

  r.get('/docs.json', (_req, res) => {
    res.json(spec);
  });

  r.get('/docs', (_req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SYNC API Docs</title>

  <link rel="stylesheet"
    href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />

  <style>
    body {
      margin: 0;
      background: #fafafa;
    }
  </style>
</head>

<body>
  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js"></script>

  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/docs.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
        persistAuthorization: true
      });
    };
  </script>
</body>
</html>
`);
  });

  return r;
}
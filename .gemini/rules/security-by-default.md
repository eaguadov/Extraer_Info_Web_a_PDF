---
name: security-by-default
description: Pautas obligatorias de seguridad para aplicaciones Node.js, Playwright, descargas de archivos y logs.
---

# Directrices de Seguridad por Defecto en Node.js y Playwright

Al programar o auditar aplicaciones web con Node.js y automatización de navegadores, se deben seguir estrictamente estas reglas:

## 1. Cadena de Suministro Segura (pnpm)
* Usar siempre **`pnpm`** en lugar de `npm` o `yarn` para la instalación de dependencias, reduciendo el riesgo de malware en la instalación.
* Declarar la propiedad `"packageManager": "pnpm@X.Y.Z"` en el `package.json` de todos los proyectos.
* Actualizar scripts de inicialización (`.bat`, `.sh`) para utilizar comandos de pnpm (`pnpm install`, `pnpm exec`).

## 2. Mitigación de SSRF (Server-Side Request Forgery)
* Toda URL externa procesada por el servidor debe ser validada.
* Resolver su DNS (`dns.resolve` / `dns.lookup`) antes de iniciar conexiones de red o navegar con Playwright.
* Bloquear hosts locales (`localhost`, `.local`, `loopback`) y rangos de IPs privadas/reservadas (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`).

## 3. Blindaje XSS en PDF / Automatización Estática
* Al procesar documentos HTML estáticos o compilar plantillas locales a PDF usando navegadores headless (Playwright), configurar el contexto desactivando Javascript:
  ```javascript
  const context = await browser.newContext({ javaScriptEnabled: false });
  ```
  Esto bloquea la ejecución de vectores XSS maliciosos embebidos en el contenido.

## 4. Prevención de Path Traversal
* Al construir rutas de descarga o lectura de archivos desde parámetros del cliente, aplicar siempre **`path.basename(paramName)`** para neutralizar saltos de directorio.

## 5. Prevención de Fugas de Credenciales en Logs
* Sanitizar textos de error y logs antes de escribirlos. Enmascarar parámetros del tipo `key=...` y cadenas que coincidan con el patrón de tokens de APIs como Google Studio (`AIzaSy...`).

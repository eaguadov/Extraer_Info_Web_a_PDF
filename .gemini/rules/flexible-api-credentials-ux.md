---
name: flexible-api-credentials-ux
description: Regla de diseño para gestionar de forma segura y cómoda las credenciales de APIs (como Gemini) en la interfaz.
---

# Gestión Flexible de Credenciales de API y Diseño UX

Al desarrollar aplicaciones web que consumen servicios externos autenticados (APIs), se deben seguir estas pautas de diseño:

## 1. Diseño del Backend (Doble Vía)
* El backend debe soportar de forma nativa la obtención de credenciales desde dos orígenes, priorizando la del cliente:
  ```javascript
  const keyToUse = requestBody.apiKey || process.env.API_KEY_NAME;
  ```
* Se debe proveer un endpoint ligero (ej: `GET /api/check-config`) que devuelva un booleano indicando si el servidor ya tiene la variable de entorno configurada (`hasKey: true/false`). Nunca se debe exponer la clave real.

## 2. Adaptación de la Interfaz (UX Simplificada)
* Al cargar la sección de configuración de la API en el frontend, consultar el endpoint `/api/check-config`.
* **Si la clave ya existe en el servidor**:
  * Cambiar el placeholder del campo de texto a `(Opcional) Clave configurada en el servidor...`.
  * Mostrar un mensaje claro de éxito: `🟢 El servidor ya dispone de una credencial configurada y activa.`
  * Permitir que el botón de prueba o el formulario se envíen vacíos, asumiendo la del servidor sin lanzar errores de validación de campos obligatorios en el cliente.
* **Si la clave no existe en el servidor**:
  * Mantener el campo como obligatorio y solicitar el ingreso manual del usuario.

## 3. Seguridad
* Las credenciales locales se deben almacenar en archivos `.env` y estar siempre listadas en `.gitignore`.

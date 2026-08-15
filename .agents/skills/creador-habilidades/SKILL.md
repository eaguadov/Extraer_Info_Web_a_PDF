---
name: creador-habilidades
description: >-
  Habilidad para guiar la creación, estructuración e instalación
  de nuevas habilidades locales (skills) escritas en español
  dentro del workspace.
---

# Creador de Habilidades locales (Skills) en Español

## Overview
Esta habilidad capacita al agente para diseñar y escribir nuevas habilidades de usuario (skills) de forma estandarizada y en idioma español. Permite ampliar las capacidades de Antigravity en el espacio de trabajo local estructurando instrucciones (`SKILL.md`) y scripts auxiliares.

---

## Workflow para Crear una Nueva Habilidad

Cuando el usuario te solicite crear una nueva habilidad (por ejemplo, diciendo: *"crea una habilidad para..."* o *"diseña un skill que..."*), debes seguir estrictamente los siguientes pasos:

### Paso 1: Brainstorming y Definición
Mantén un diálogo interactivo con el usuario (sin abrumarle con demasiadas preguntas a la vez) para definir:
1.  **Nombre y Objetivo**: Qué hará la habilidad (debe ser un nombre descriptivo en minúsculas y separado por guiones, ej: `traductor-archivos`).
2.  **Entradas y Salidas**: Qué datos de entrada consume y qué resultados produce.
3.  **Tipo de Habilidad**:
    *   *Solo instrucciones*: Si únicamente requiere coordinar herramientas o guiar pasos lógicos.
    *   *Basada en scripts*: Si requiere scripts de código (Python, Node.js) para conectarse a APIs, procesar archivos, etc.
4.  **Dependencias**: Si requiere interactuar con otras habilidades del sistema.

### Paso 2: Diseño de la Habilidad
Crea un plan de diseño rápido (o coméntaselo en el chat) detallando la estructura de archivos que vas a crear:
```text
.agents/skills/<nombre-habilidad>/
  ├── SKILL.md                 # Archivo de instrucciones maestro
  └── scripts/                 # (Opcional) Scripts si requiere código
```

### Paso 3: Implementación y Creación
1.  **Crear el directorio**: Crea la carpeta de la habilidad en el workspace bajo las rutas locales:
    *   `.gemini/skills/<nombre-habilidad>/`
    *   Y por compatibilidad en `.agents/skills/<nombre-habilidad>/`
2.  **Crear SKILL.md**: Escribe el archivo con el siguiente formato exacto:
    ```markdown
    ---
    name: <nombre-de-la-habilidad>
    description: <breve descripción del propósito>
    ---

    # Nombre de la Habilidad (Título)

    ## Overview
    Breve descripción del objetivo de la habilidad.

    ## Quick Start
    Ejemplo minimalista de uso rápido.

    ## Workflow (o Utility Scripts)
    Pasos detallados a seguir por el agente cuando se active la habilidad, o lista de subcomandos si incluye scripts.

    ## Common Mistakes
    Lista de 2 o 3 errores comunes a evitar al usar la habilidad.
    ```
3.  **Crear Scripts (Opcional)**: Si la habilidad requiere código ejecutable, crea el script en el subdirectorio `scripts/` (e.g. `scripts/main.js` o `scripts/main.py`), asegúrate de documentarlo y añadirlo a las instrucciones del `SKILL.md`.

### Paso 4: Validación y Demostración
Explícale al usuario que la habilidad ha sido instalada y realiza una prueba simulada o real de activación para confirmar su correcto funcionamiento.

---

## Common Mistakes
*   **Nombres incorrectos**: Usar nombres con mayúsculas o espacios en el campo `name:` del frontmatter. Debe ser siempre minúsculas con guiones.
*   **Falta de claridad en el workflow**: Redactar instrucciones ambiguas que el agente de IA no pueda seguir de forma sistemática.
*   **Omitir dependencias**: No listar dependencias críticas o software requerido en la sección de overview.

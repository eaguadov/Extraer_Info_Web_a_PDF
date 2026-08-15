---
name: read-best-practices
description: Obliga al agente a comprobar el archivo de buenas prácticas local al iniciar el trabajo.
---

# Regla de Consulta Obligatoria de Buenas Prácticas

## Comportamiento del Agente
Cada vez que el usuario inicie una sesión o solicite realizar cambios en un proyecto situado dentro de la ruta `C:\Proyectos Antigravity\`, el agente debe:

1. **Leer el archivo global de directrices**: Consultar de forma preventiva el archivo `C:\Proyectos Antigravity\BEST_PRACTICES.md` utilizando la herramienta de lectura adecuada.
2. **Aplicar las restricciones técnicas y metodológicas**: 
   - Inicializar Git si el proyecto no lo tiene.
   - Trabajar exclusivamente en ramas `test/*` y no realizar merges a `master`/`main` sin consentimiento.
   - Etiquetar versiones estables de forma semántica (`vX.Y`).
   - Respetar los límites y estrategias de batching especificados para el uso de modelos (como Gemini 1.5 Flash).
3. **No asumir configuraciones por defecto** si están explícitamente reguladas en dicho documento.

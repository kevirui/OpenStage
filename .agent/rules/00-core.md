---
trigger: always_on
---

# Reglas centrales del agente

## Prioridad del proyecto

El objetivo principal es construir un MVP de hackatón funcional.

Priorizar siempre:

1. Requisitos del MVP
2. Confiabilidad
3. Simplicidad
4. Que se pueda demostrar
5. Documentación
6. Funcionalidades opcionales

No sacrificar el MVP para implementar funcionalidad opcional.

## Antes de escribir código

Siempre:

1. Inspeccionar la implementación existente.
2. Entender la arquitectura relevante.
3. Revisar los tipos/interfaces que ya existen.
4. Reutilizar las abstracciones existentes cuando corresponda.
5. Hacer el cambio más chico que sea razonable.

## Evitar sobreingeniería

No introducir:

* frameworks innecesarios
* dependencias innecesarias
* microservicios
* Kubernetes
* Redis
* inyección de dependencias compleja
* buses de eventos
* CQRS
* patrones de diseño elaborados

salvo que haya un requisito concreto que los justifique.

## Fuente de verdad

`PROJECT_CONTEXT.md` define el producto y la arquitectura buscados.

Si algún detalle de implementación entra en conflicto con el contexto del proyecto, preservar los requisitos centrales del producto y explicar el conflicto antes de hacer cambios arquitectónicos importantes.

## Disciplina de cambios

No reescribir código no relacionado.

No modificar archivos ajenos a la tarea actual salvo que sea necesario.

Después de implementar:

* correr el chequeo de tipos
* correr el linter
* correr los tests si existen

Reportar los errores en lugar de esconderlos.

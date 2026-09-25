---
trigger: always_on
---

# Reglas del frontend

El frontend es responsable de la presentación y la interacción con la persona usuaria.

No debe contener:

* llamadas a la API de Gemini
* lógica de IA específica del proveedor
* lógica de negocio de procesamiento de audio
* credenciales del servidor

## Interfaz del público

Priorizar la legibilidad.

El público debe entender de inmediato:

* qué sesión está viendo
* en qué idioma la está viendo
* cuál es el último subtítulo
* si la conexión está activa

## Interfaz de admin

Priorizar la visibilidad operativa.

Mostrar:

* sesión
* estado
* idioma
* estado de conexión
* latencia cuando esté disponible
* cantidad de subtítulos cuando esté disponible

## Estilos

Mantener el sistema visual simple.

No dedicar tiempo significativo de desarrollo al pulido visual antes de que funcione el pipeline del MVP.

La accesibilidad y la legibilidad son más importantes que la UI decorativa.

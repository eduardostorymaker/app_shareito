# Shareito · Identidad de marca

**Shareito** = *share* (compartir) + *-ito*, el diminutivo cariñoso del español: un gasto compartido entre gente que se tiene confianza.

**Lema:** *Cuentas claras, amistades largas.*

## Logotipo

Billetera dibujada en línea, con el broche en rosa. Archivos finales en [`logo-c/`](logo-c/), combinación **1 · Índigo y rosa**:

| Archivo | Uso |
|---|---|
| `c1-indigo-rosa.svg` | Símbolo en color sobre fondo claro |
| `c1-indigo-rosa-fondo-oscuro.svg` | Símbolo sobre fondo oscuro (trazo blanco) |
| `c1-indigo-rosa-icono-app.svg` | Icono de app (fondo índigo) |
| `c1-indigo-rosa-favicon.svg` | Icono a 32 px o menos (trazo más grueso) |

En la app, el logotipo está en [`components/brand/logo.tsx`](../components/brand/logo.tsx) (`ShareitoMark`, `ShareitoWordmark`, `ShareitoLogo`, `ShareitoAppIcon`). Los iconos de la PWA (`public/icon-192.png`, `public/icon-512.png`, `app/apple-icon.png`, `app/icon.svg`) se generan desde el mismo dibujo.

Reglas:

- **Trazo:** 2,6 sobre 48 en tamaños grandes; 3,2 en 32 px o menos, para que no desaparezca.
- **Nombre:** siempre en minúsculas, `share` en tinta e `ito` en índigo, Plus Jakarta Sans ExtraBold.
- **Espacio libre:** al menos la altura del broche alrededor del símbolo.
- **No** rotar, deformar, añadir sombras ni degradados, ni cambiar el rosa del broche por otro color.

Las demás exploraciones ([`logo-opciones/`](logo-opciones/) y las combinaciones 2 a 4 de `logo-c/`) quedan como archivo de referencia.

## Color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| Primario | `#5038E0` | `#8F80FF` | Botones, enlaces, navegación activa, trazo del logotipo |
| Texto sobre primario | `#FFFFFF` | `#16123A` | |
| Tinta | `#16123A` | `#ECEAF7` | Texto |
| Fondo | `#F7F6FD` | `#100E22` | Fondo de pantalla |
| Superficie | `#FFFFFF` | `#1B1834` | Tarjetas, diálogos |
| Acento rosa | `#FF7EB6` | `#FF7EB6` | **Solo** el broche del logotipo e ilustraciones |

Contrastes: texto blanco sobre primario 7,04 : 1; primario oscuro sobre fondo oscuro 6,05 : 1 (WCAG AA en ambos).

**Colores de estado** (independientes de la marca, siempre con texto o icono): verde = te deben, rojo = debes, ámbar = aviso. El rosa no se usa nunca en importes, para no confundirlo con el rojo de "debes".

**Gráficos:** serie 1 `#5038E0` / `#8576FA` (oscuro), serie 2 `#EB6834` / `#D95926`. Validadas para daltonismo.

## Tipografía

- **Plus Jakarta Sans** (600–800): titulares, nombre de marca y cifras destacadas.
- **Inter**: texto, formularios y tablas (con cifras tabulares donde los números se alinean).

# NatVisual

App de teléfono del estudio NatVisual. Organiza los encargos por cliente y parte cada encargo en pasos. Pensada para iPhone, instalada en la pantalla de inicio.

## Cómo se usa

1. **Clientes**: añade tus clientes. Cada uno está **activo**, **inactivo** (en pausa) o **archivado**. Puedes borrar un cliente con todo lo suyo, aunque archivarlo no pierde nada.
2. **+ (nuevo encargo)**: escribe o dicta como hablas, por ejemplo «Reel de habitaciones para Hotel Mar el viernes urgente». La app detecta el cliente, el tipo, la fecha y arma los pasos (en un reel: guion, grabación, edición, aprobación, publicar, activar ads). Puedes cambiar, quitar o añadir pasos antes de guardar.
3. **Hoy**: muestra el siguiente paso de cada encargo de clientes activos, agrupado en atrasado, hoy, esta semana, más adelante y sin fecha. Tocas el círculo y pasa al paso siguiente.
4. **Ajustes**: activa el resumen de cada mañana y baja el ZIP del mes.

## Tipos y pasos

Están en `src/lib/plan.ts` (`TIPOS`). Cada paso tiene un día relativo a la entrega; ningún paso cae antes de hoy.

## Resumen de la mañana (notificaciones)

- Web Push. Las claves se crean solas la primera vez y se guardan en la tabla `ajustes`: no hay que poner nada en Vercel.
- En el iPhone (iOS 16.4 o más) solo funciona con la app agregada a la pantalla de inicio desde Safari.
- `vercel.json` programa `/api/cron/resumen` a las 11:00 UTC (7:00 en Caracas; en el plan gratis de Vercel puede llegar dentro de esa hora). Sale como máximo un resumen al día.
- Opcional: `CRON_SECRET` en Vercel hace que solo Vercel pueda llamar esa ruta.

## Acceso

Abierto mientras no exista `ESTUDIO_CLAVE` en Vercel. Con esa variable, la app pide la clave y la recuerda 30 días.

## Datos

- Con `DATABASE_URL` (Neon) los datos viven ahí. Las migraciones de `migrations/` se aplican solas la primera vez que el servidor toca la base (con candado), no en el build. `npm run migrate` sigue sirviendo para aplicarlas a mano.
- Sin esa variable se usa Postgres embebido en `.data/pglite`.

## Correrlo

```bash
npm install
npm run dev
```

Abre `http://localhost:3847`.

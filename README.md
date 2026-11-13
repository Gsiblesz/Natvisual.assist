# NatVisual

Tablero de entregas del estudio NatVisual. El equipo anota piezas, reels y pautas por voz o a mano, las mueve de pendientes a terminadas y cierra el mes con un informe.

## Cómo se usa

1. Abre el tablero. Por ahora el estudio no pide contraseña.
2. Añade un cliente, o elige uno y pulsa **Cargar ejemplo**.
3. Di **Hablar** y prueba: “nueva piezas del feed”, “en curso piezas del feed”, “terminada piezas del feed”. También vale “hoy”, “mañana”, “urgente” y “prioridad alta”.
4. Arrastra las tarjetas del tablero, revisa la agenda y descarga el ZIP del mes.

El ZIP incluye entregas, historial, avisos y un calendario `.ics`. Si marcas la casilla, después de descargar se borran las entregas hechas de ese cliente y ese mes.

## Datos

- Con `DATABASE_URL` (Postgres, incluido Neon) los datos viven en esa base. El build aplica `migrations/`.
- Sin esa variable, la app usa Postgres embebido en `.data/pglite` para poder trabajar en local.
- Al publicar, la app pide su propia base Postgres. No hace falta pegar una URL en el chat.

## Correrlo

```bash
npm install
npm run dev
```

Abre `http://localhost:3847`.

Opcionales, solo si quieres correo o Google Calendar de verdad:

- `RESEND_API_KEY` y `RESEND_FROM`
- `GOOGLE_ACCESS_TOKEN`

Sin esas claves, el enlace de calendario y el ZIP siguen funcionando. Publicar en Google y avisar por correo dicen qué falta.

## Voz

El dictado usa el reconocimiento del navegador (Chrome o Edge). La respuesta se lee en español de Venezuela.

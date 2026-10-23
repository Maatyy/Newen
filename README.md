# Newen · Beta N°2 (versión hombre)

*Newen* significa "fuerza" en mapudungun.

App web (PWA) con rutina de 12 semanas, hábitos y **avisos push** que llegan aunque la app esté cerrada.
Se publica gratis en **Netlify** desde **GitHub**.

## Qué hay en esta carpeta

```
public/                   ← la web que ve la gente
  index.html              página
  app.js                  toda la lógica de la app
  sw.js                   service worker: recibe los avisos y permite usarla sin internet
  manifest.webmanifest    para instalarla en el teléfono
  icons/                  íconos
netlify/
  functions/
    push-key.mjs          GET  /api/push-key   → clave pública de avisos
    subscribe.mjs         POST/DELETE /api/subscribe → guarda o borra la suscripción
    test-push.mjs         POST /api/test-push  → aviso de prueba
    reminders.mjs         se ejecuta sola cada hora y manda los recordatorios
  lib/                    código compartido (validación y textos de los avisos)
tests/                    pruebas automáticas (npm test)
netlify.toml              configuración y cabeceras de seguridad
package.json              dependencias (web-push y @netlify/blobs)
```

No se usa base de datos externa: las suscripciones se guardan en **Netlify Blobs**, que viene incluido.

## Qué incluye esta versión (Beta N°2, versión hombre)

- Rutina de 12 semanas para principiantes; para quien ya entrena: varias opciones de rutina para elegir, o su propia rutina editable.
- Registro serie por serie, récords con gráfico, calentamiento sugerido, discos por lado y cronómetro de descanso.
- Hábitos, niveles, chapitas, resumen semanal y avisos al teléfono (push).
- Comidas: menú del día por etapa (déficit, mantener, volumen, recomposición) con porciones medidas con la mano, horarios, reemplazos equivalentes y lista de compras semanal.
- Consejos básicos, consejos pro (déficit, volumen, electrolitos, sueño, suplementos, mitos) y una sección de dolor, molestias y técnica.

## Ahorrar créditos de Netlify

Cada publicación en producción cuesta 15 créditos (plan gratis: 300 al mes, compartidos entre todos tus sitios). Junta varios cambios y súbelos en un solo commit. Si los créditos llegan a 0, los sitios se pausan hasta el siguiente ciclo.

---

## Paso 1 · Subir a GitHub (sin instalar nada)

1. Entra a <https://github.com> e inicia sesión (o crea una cuenta).
2. Arriba a la derecha, **+ → New repository**.
3. Nombre: `newen`. Elige **Private** si no quieres que el código sea público. **No** marques "Add a README". Pulsa **Create repository**.
4. En la página del repositorio vacío, haz clic en **uploading an existing file**.
5. Descomprime el zip en tu computador. Abre la carpeta `newen` y **arrastra todo su contenido** (las carpetas `public`, `netlify`, `tests` y los archivos `netlify.toml`, `package.json`, `package-lock.json`, `README.md`) a la ventana de GitHub.
   - Arrastra el *contenido*, no la carpeta: `netlify.toml` debe quedar en la raíz del repositorio.
   - El archivo `.gitignore` está oculto en Mac; si no se sube, no pasa nada.
   - **Nunca subas** `claves-vapid-PRIVADAS.txt`.
6. Abajo, escribe un mensaje (por ejemplo "Primera versión") y pulsa **Commit changes**.
7. Revisa que en la raíz del repositorio se vean `public/`, `netlify/` y `netlify.toml`.

## Paso 2 · Publicar en Netlify

1. Entra a <https://app.netlify.com> e inicia sesión **con tu cuenta de GitHub**.
2. **Add new site → Import an existing project → GitHub**. Autoriza a Netlify y elige el repositorio `newen`.
   (Si es privado y no aparece: *Configure the Netlify app on GitHub* y dale acceso a ese repositorio.)
3. En la configuración del build, deja lo que Netlify lee de `netlify.toml`:
   - Base directory: *(vacío)*
   - Build command: *(lo que trae, o vacío)*
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
4. Pulsa **Deploy**. En 1–2 minutos tendrás una dirección como `https://nombre-raro.netlify.app`.
5. (Opcional) **Site configuration → Change site name** para dejarla como `newenb.netlify.app` (la dirección actual: https://newenb.netlify.app/).

## Paso 3 · Activar los avisos (claves VAPID)

Los avisos necesitan un par de claves. Ya vienen generadas en el archivo `claves-vapid-PRIVADAS.txt` (aparte del zip del proyecto).

1. En Netlify: **Site configuration → Environment variables → Add a variable → Add a single variable**.
2. Crea estas tres (con "Same value for all deploy contexts"):

   | Key | Value |
   |---|---|
   | `VAPID_PUBLIC_KEY` | la clave pública del archivo |
   | `VAPID_PRIVATE_KEY` | la clave privada del archivo (marca **Contains secret values** si aparece la opción) |
   | `VAPID_SUBJECT` | `mailto:tu-correo@dominio.com` |

3. Vuelve a publicar para que las tome: **Deploys → Trigger deploy → Deploy site**.
4. Comprueba que la función programada quedó activa: **Logs → Functions → reminders** debe decir *Scheduled* (corre cada hora, en el minuto 2).

> ¿Quieres claves nuevas? Con Node instalado: `npx web-push generate-vapid-keys`. Si las cambias, cada persona tendrá que volver a activar los avisos.

## Paso 4 · Probar en el teléfono

**Android (Chrome):**
1. Abre tu dirección de Netlify. Menú ⋮ → **Agregar a la pantalla principal** (recomendado).
2. Ve a **Tú → ⚙️ Ajustes → 🔔 Activar avisos** y acepta el permiso.
3. Toca **Enviar aviso de prueba**: debe llegar en segundos.

**iPhone (iOS 16.4 o más nuevo):** en iPhone los avisos web **solo funcionan con la app instalada**.
1. Abre la dirección en **Safari** → botón **Compartir** → **Agregar a inicio**.
2. Abre la app **desde el ícono** de la pantalla de inicio (no desde Safari).
3. **Tú → ⚙️ Ajustes → 🔔 Activar avisos** → Permitir → **Enviar aviso de prueba**.

**Computador (Chrome/Edge/Firefox):** igual que Android; el aviso aparece en el sistema.

### Cuándo llegan los avisos
- A la hora que elijas en **Recordatorios** (o según tu horario del perfil), si te falta la sesión del día o tomar agua / comer proteína.
- Un segundo aviso 2 horas después si sigue faltando algo (nunca después de las 21:00).
- Los lunes a las 9:00, el resumen de la semana anterior.
- Todo con la **zona horaria del teléfono** de cada persona.
- El servidor sabe lo que marcaste cuando la app se abre; si no la abres en el día, asume que falta y avisa igual.

## Si algo no funciona

| Síntoma | Qué revisar |
|---|---|
| "No se pudo enviar: revisa las claves en Netlify" | Las 3 variables existen, sin espacios extra, y volviste a publicar después de crearlas. |
| El botón de avisos no hace nada en iPhone | Debe estar instalada en la pantalla de inicio y abierta desde el ícono. iOS 16.4+. |
| "Bloqueaste las notificaciones" | Ajustes del teléfono/navegador → Notificaciones → permitir para el sitio. |
| La prueba llega pero los recordatorios no | Logs → Functions → `reminders`: debe aparecer "Recordatorios: X enviados…" cada hora. Las funciones programadas solo corren en el sitio publicado (no en vistas previas de ramas). |
| No veo un cambio que subí | Espera el deploy, cierra y abre la app (el service worker se actualiza solo). |

## Actualizar la app más adelante

En GitHub abre el archivo (por ejemplo `public/app.js`), botón ✏️, cambia, **Commit changes**. Netlify publica solo en 1–2 minutos.

## Seguridad (revisado)

- **Claves**: la privada solo vive en las variables de entorno de Netlify, nunca en el código ni en GitHub.
- **Datos personales**: perfil, peso, avance, etc. se guardan **solo en el teléfono**. Al servidor solo va lo necesario para avisar: zona horaria, hora de aviso, días de entrenamiento, nombre de la sesión, hábitos marcados hoy y totales de la semana. Las suscripciones sin uso por 60 días se borran solas.
- **API protegida**: solo acepta peticiones desde la propia web (verificación de origen), cuerpos pequeños, y solo direcciones de los servicios de push oficiales (Google, Mozilla, Apple, Microsoft), así nadie puede usar el servidor para atacar otras direcciones.
- **Aviso de prueba**: solo a suscripciones ya registradas y como máximo 1 cada 30 segundos.
- **Cabeceras**: Content-Security-Policy estricta (sin scripts externos ni en línea), HSTS, anti-iframe (clickjacking), nosniff, Referrer-Policy y Permissions-Policy.
- **Contenido**: todo lo que escribe la persona (nombre, etc.) se muestra escapado; probado contra inyección de HTML.
- **Respaldo**: al recuperar un respaldo solo se aceptan los datos propios de la app; la suscripción de avisos no viaja entre teléfonos.

## Pruebas

```
npm install
npm test
```
Prueban la validación (incluyendo intentos maliciosos), los horarios de los avisos por zona horaria y el cifrado de los mensajes.

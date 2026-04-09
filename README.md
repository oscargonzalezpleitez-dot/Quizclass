# QuizClass 🎓

Trivia en vivo para el aula. Sin límite de alumnos. Los alumnos solo necesitan abrir un link en su navegador — sin instalar nada, sin cuenta.

---

## Cómo funciona

- El **profesor** abre la app, crea preguntas y lanza la trivia
- Se genera un **código PIN** de 6 dígitos
- Los **alumnos** abren el mismo link, ingresan el PIN y su nombre
- Todo funciona en tiempo real con WebSockets

---

## Subir gratis a Render.com (recomendado)

1. Crear cuenta gratis en https://render.com
2. Nuevo proyecto → **Web Service**
3. Conectar tu repositorio de GitHub (sube los archivos allí)
4. Configurar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Click en **Deploy** → en 2 minutos tienes tu URL pública

Render te da una URL tipo: `https://quizclass-xxxx.onrender.com`  
Comparte esa URL con tus alumnos y listo.

---

## Subir a Railway (alternativa)

1. Crear cuenta en https://railway.app
2. New Project → Deploy from GitHub
3. Selecciona tu repo → Railway detecta Node.js automáticamente
4. Deploy → obtienes URL pública

---

## Correr localmente (para probar)

```bash
npm install
npm start
```
Abre http://localhost:3000 en tu navegador.

Para que tus alumnos se conecten desde su red local, comparte tu IP:
`http://TU-IP-LOCAL:3000`

---

## Archivos del proyecto

```
quizclass/
├── server.js        ← Servidor Node.js con WebSockets
├── package.json     ← Dependencias
└── public/
    └── index.html   ← Toda la app (HTML + CSS + JS)
```

---

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|----------|------------------|-------------|
| PORT     | 3000             | Puerto del servidor |

Render y Railway asignan PORT automáticamente.

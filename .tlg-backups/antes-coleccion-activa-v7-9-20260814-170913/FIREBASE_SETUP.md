# Activar el acceso con Google y la sincronización

El sitio sigue funcionando sin cuenta. Esta configuración activa el panel
**Guarda tu recorrido** dentro de **Mi colección** y sincroniza el progreso
entre dispositivos.

## 1. Crear el proyecto

1. Abre [Firebase Console](https://console.firebase.google.com/).
2. Crea un proyecto llamado, por ejemplo, `to-the-last-groove`.
3. Google Analytics es opcional para esta función.
4. En la pantalla del proyecto, agrega una aplicación **Web**.
5. Usa `To the Last Groove Web` como apodo y copia el objeto `firebaseConfig`.

## 2. Activar Google

1. Ve a **Authentication → Sign-in method**.
2. Habilita **Google** y guarda.
3. En **Authentication → Settings → Authorized domains**, agrega:
   - `localhost`
   - `carlosphotos.github.io`

## 3. Crear Firestore y protegerlo

1. Ve a **Firestore Database** y crea la base de datos.
2. Elige modo de producción y una región cercana a tus usuarios.
3. Abre la pestaña **Rules**.
4. Copia allí el contenido completo de `firestore.rules` y publícalo.

Las reglas permiten que cada persona lea y escriba únicamente el documento
asociado con su propio identificador de Google. Nadie puede consultar la
colección de otra cuenta.

## 4. Conectar el sitio

Abre `firebase-config.js` y sustituye `null` por el objeto que copiaste. Debe
quedar con esta forma:

```js
window.TLG_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

La configuración web identifica el proyecto, pero no concede acceso por sí
sola. La protección depende de las reglas de Firestore del paso anterior.

## 5. Probar

```bash
cd ~/to-the-last-groove
python3 -m http.server 8000
```

Abre `http://localhost:8000`, entra en **Mi colección** y pulsa **Continuar con
Google**. Marca una obra como escuchada, cierra la sesión y vuelve a entrar.
Después prueba la misma cuenta en otro navegador o dispositivo.

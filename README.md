# CBR Reader

Lector local de cómics en formato `.cbr` y `.cbz`. Permite abrir varios archivos a la vez y leerlos en el navegador como si fueran un PDF.

## Características

- Subida de varios archivos a la vez (botón o arrastrar y soltar)
- Biblioteca persistente: los cómics se conservan al reiniciar el servidor
- Tres modos de lectura: página simple, doble página (con opción manga) y scroll continuo
- Zoom, ajuste al ancho o al alto y pantalla completa
- Recuerda la última página leída de cada cómic
- Atajos de teclado

## Estructura del proyecto

```
cbr-reader/
├── server.js          # Servidor Express: sube, extrae y sirve los cómics
├── package.json
└── public/
    ├── index.html     # Interfaz
    ├── style.css      # Estilos
    └── app.js         # Lógica del visor
```

Al ejecutarlo se crean automáticamente dos carpetas:

- `library/`: cómics ya extraídos (no se sube a Git)
- `tmp/`: archivos temporales durante la subida

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior

## Instalación y uso

```bash
git clone
cd cbr-reader
npm install
npm start
```

Abre http://localhost:3000 en tu navegador.

1. Pulsa **+ Añadir CBR / CBZ** o arrastra tus archivos a la ventana.
2. Selecciona un cómic en la biblioteca para leerlo.
3. Cambia el modo de lectura, el zoom o el ajuste desde la barra superior.

## Atajos de teclado

| Tecla | Acción |
|---|---|
| ← / → | Página anterior / siguiente |
| Re Pág / Av Pág | Anterior / siguiente |
| Inicio / Fin | Primera / última página |
| `+` `-` `0` | Zoom in / out / restablecer |
| `F` | Pantalla completa |

También puedes hacer clic en el 30 % izquierdo o derecho de la pantalla para cambiar de página.

## Notas

- Los archivos protegidos con contraseña no están soportados.
- Muchos `.cbr` son en realidad ZIP renombrados; el programa detecta el formato real automáticamente.
- Para eliminar un cómic de la biblioteca usa el botón ✕ junto a su nombre.

## Licencia

MIT

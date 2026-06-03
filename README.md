# Fruit Guitar

Juego web tipo Fruit Ninja para practicar acordes de guitarra.

## Desarrollo

```bash
npm install
npm run dev
```

Abrir `http://127.0.0.1:5173`.

También puedes usar Windows:

```cmd
scripts\start-dev.cmd
```

## Scripts

- `npm run dev`: servidor local Vite.
- `npm run build`: typecheck y build de producción.
- `npm run test`: tests unitarios con Vitest.

## MVP

- Cámara como vista decorativa.
- Micrófono con Web Audio API.
- Forma de onda del micrófono.
- Reconocimiento de acordes abiertos: `A`, `C`, `D`, `E`, `F`, `G`, `Am`, `Dm`, `Em`.
- Frutas con acordes, score, vidas, pausa, ajustes y Game Over.

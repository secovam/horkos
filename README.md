# Horkos

Horkos es una herramienta interna para recabar la información de los empleados y generar sus contratos laborales.

## Cómo funciona

1. **RH envía invitaciones.** Desde el dashboard, RH envía por correo a cada empleado un link único. Las invitaciones no expiran; RH puede reenviarlas o revocarlas.
2. **El empleado carga sus documentos.** Sin crear cuenta, el empleado abre su link (también desde el celular) y sube su comprobante de domicilio, constancia de situación fiscal y constancia del IMSS, junto con los datos que él mismo conozca.
3. **Horkos extrae la información.** Los datos se obtienen automáticamente de los documentos, que se guardan en un bucket privado de R2.
4. **RH valida y completa.** RH revisa lo extraído, corrige lo necesario y llena el resto de la información del contrato. Ningún contrato se genera sin esta revisión.
5. **Se descarga el contrato.** Horkos llena los campos AcroForm de un template PDF y RH descarga el contrato listo para imprimir. La firma es física, fuera de Horkos.

## Principios

- **Privacidad.** Horkos maneja datos sensibles (RFC, CURP, NSS, domicilios). Nada sensible va a logs, URLs ni datos de prueba, y los documentos nunca son públicos.
- **RH siempre valida.** La extracción propone; una persona confirma.
- **Link sin fricción.** El empleado no necesita cuenta y puede terminar en una sola sesión.
- **PDF exacto.** El contrato generado coincide con el template y se imprime correctamente.

## Stack

- **TanStack Start** (React 19) en `apps/web`
- **Cloudflare D1** con **Drizzle** para datos y **R2** para documentos
- **Better Auth** (correo y contraseña) para las cuentas de RH
- **shadcn/ui** sobre Base UI en `packages/ui`
- **Alchemy** para desplegar en Cloudflare
- **Turborepo** + **pnpm** para el monorepo
- **Playwright** para pruebas end-to-end

## Primeros pasos

```bash
pnpm install
pnpm dev
```

Abre [http://localhost:3001](http://localhost:3001).

Usa siempre **pnpm** (nunca `npm`, `yarn` ni `bun install`); Bun solo se usa como runtime.

## Scripts

- `pnpm dev`: inicia todo en modo desarrollo.
- `pnpm dev:web`: inicia solo la app web.
- `pnpm build`: compila todo.
- `pnpm check-types`: revisa tipos (lento: `web` ejecuta `vite build` primero).
- `pnpm fix`: lint y formato con Ultracite (Oxlint + Oxfmt). Lefthook lo ejecuta en cada commit.
- `pnpm db:generate`: genera migraciones de Drizzle.
- `pnpm env:generate`: regenera `src/env.ts` a partir de `.env.schema`.
- `pnpm deploy` / `pnpm destroy`: despliega o elimina la infraestructura con Alchemy.

## Estructura

```
horkos/
├── apps/
│   └── web/         # App TanStack Start: rutas, server functions, bindings
├── packages/
│   ├── auth/        # Configuración de Better Auth
│   ├── db/          # Esquema de Drizzle y migraciones de D1
│   ├── infra/       # Stack de Alchemy para Cloudflare
│   └── ui/          # Componentes shadcn compartidos y estilos
└── docs/agents/     # Convenciones para agentes de código
```

## Base de datos

Horkos usa Cloudflare D1 (SQLite) con Drizzle. En tiempo de ejecución, la base se accede con el binding `DB` definido en `packages/infra/alchemy.run.ts`; un `DATABASE_URL` local solo sirve para herramientas de base de datos. Alchemy aprovisiona D1 y aplica las migraciones durante el deploy.

Nunca edites a mano una migración ya aplicada; genera una nueva con `pnpm db:generate`.

## Variables de entorno

Cada app o paquete define su esquema en `.env.schema`. Varlock genera `src/env.ts` para `apps/web` y `packages/db`; no lo edites a mano, cambia el esquema y ejecuta `pnpm env:generate`. Los esquemas se commitean; los secretos viven en archivos env ignorados o en la plataforma de despliegue.

La carga automática de `.env` de Bun está deshabilitada en `bunfig.toml`; Varlock carga el entorno. Consulta la [guía de monorepos de Varlock](https://varlock.dev/guides/monorepos/) y la [integración con Cloudflare](https://varlock.dev/integrations/cloudflare/#non-wrangler-deploy-tools-alchemy-sst-pulumi).

## Despliegue

Configura las cuentas de proveedores con:

```bash
cd packages/infra && pnpm exec alchemy profile edit
```

Los despliegues usan stages; por defecto, un stage personal `dev_<usuario>`. Para producción:

```bash
cd packages/infra && pnpm exec alchemy deploy --stage production
```

## UI

- Tokens de diseño y estilos globales: `packages/ui/src/styles/globals.css`.
- Componentes compartidos: `packages/ui/src/components/*`. Impórtalos como `@horkos/ui/components/<nombre>`.
- Para agregar componentes compartidos:

```bash
pnpm dlx shadcn@latest add dialog table -c packages/ui
```

La interfaz está en español; el código, los comentarios y la documentación para agentes, en inglés.

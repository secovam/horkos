# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `e6676e8d0bf17c678cb45b9dacb2bd6ca8dea53a`.

Copied from `skills/install-anti-slop/assets/anti-slop/` via the `install-anti-slop` skill's `scripts/install.mjs`. The skill folder's git tree hash (`89044d21c75a367eac1ddbaf208e650b1a7d5820`) matches that commit.

Installed paths:

- `tools/oxlint/anti-slop/index.ts` — generic plugin (`anti-slop`)
- `tools/oxlint/anti-slop/effect/index.ts` — Effect plugin (`anti-slop-effect`), enabled because `packages/infra` depends on `effect`
- `tools/oxlint/anti-slop/vendor/eslint-stylistic/` — see its own `UPSTREAM.md` and `LICENSE`

Intentional deviations (all in `oxlint.config.ts`, none in the copied source):

- Replaces Ultracite's bundled `ultracite/oxlint/anti-slop` preset.
- `anti-slop/no-runtime-typeof` uses `{ allowInTypeGuards: true }`, carried over from Ultracite's preset.
- `typescript/consistent-indexed-object-style`, `unicorn/no-immediate-mutation`, and `unicorn/prefer-reflect-apply` are off, carried over from Ultracite's preset because they conflict with anti-slop rules.

# Como contribuir

## Fluxo

1. Abra (ou escolha) uma issue usando um dos modelos de `.github/ISSUE_TEMPLATE/`.
2. Crie uma branch por escopo, nomeada `tipo/descricao-curta` (por exemplo `fix/prisma-client-dockerfile`). Os tipos usados são `feat`, `fix`, `docs`, `chore`, `refactor`, `ci` e `test`.
3. Faça commits atômicos em [Conventional Commits](https://www.conventionalcommits.org/pt-br/): `tipo(escopo): descrição`, com escopo `back`, `front`, `ci` ou `docker`.
4. Abra o PR para a `main` com o modelo `.github/pull_request_template.md` preenchido e `Closes #N` na descrição. O teste que cobre a mudança vai no mesmo PR.

## Rodando localmente

Backend, em `back/`:

```bash
npx prisma generate
npm run lint
npm test
npm run build
```

Frontend, em `front/`:

```bash
npm run lint
npm test
npm run build
```

O guia de execução com Docker Compose e as variáveis de ambiente estão na
[Wiki](https://github.com/jardimdesoftware/edutrace/wiki).

## O que o PR precisa passar

O gate `pr-checks.yml` roda lint, testes, build e smoke test do seed. A cobertura
de testes precisa ficar em 70% ou mais, no back (Jest) e no front (`node --test`).

## Segurança

Segredos nunca entram no git: use os arquivos `.env*.example` como modelo e
mantenha o `.env` real fora do repositório. Vulnerabilidades seguem a
[política de segurança](SECURITY.md).

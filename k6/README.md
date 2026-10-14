# Testes k6 do EduTrace

## Teste básico em produção

O cenário exigido para a entrega usa, por padrão,
`https://edutrace.valerialima.me`. Ele acessa somente as páginas públicas `/` e
`/login`, cresce até 10 usuários virtuais durante um minuto e não cria nem altera
dados.

Execute a partir da raiz do repositório:

```bash
docker run --rm -i grafana/k6:1.8.2 run - < k6/tests/load/production-public.test.js
```

Também é possível iniciar o workflow **k6 production** manualmente no GitHub
Actions. Ele exige a confirmação `confirm_production` e usa o ambiente protegido
`production`. Não aumente VUs ou duração sem combinar uma janela de teste.

## Teste autenticado de leitura em produção

O cenário `k6/tests/load/load.test.js` usa a API pública de produção por padrão e
consulta apenas endpoints de leitura. As credenciais não têm valores padrão e
devem ser passadas por variáveis de ambiente:

```bash
k6 run \
  -e ADMIN_EMAIL=conta-exclusiva-de-teste@example.com \
  -e ADMIN_PASSWORD=segredo \
  k6/tests/load/load.test.js
```

Use uma conta exclusiva de teste e não grave credenciais no repositório.

## Suítes que não devem rodar em produção

Os cenários em `k6/tests/endpoints/` exercitam CRUD e podem criar, modificar e
apagar registros. Os testes `stress` e `spike` também produzem carga muito maior.
Eles são mantidos apenas para ambientes isolados de homologação.

## Critérios do teste básico

- Menos de 1% de requisições com falha.
- Mais de 99% das verificações aprovadas.
- Latência p95 inferior a 750 ms.

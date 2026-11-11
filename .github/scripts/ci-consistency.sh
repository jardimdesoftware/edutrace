#!/usr/bin/env bash
# Verifica que os workflows testam e publicam o que a produção executa.
# Roda na raiz do repositório; usa yq, presente no ubuntu-latest.
set -u

status=0

# O CI precisa testar a mesma major do PostgreSQL que a produção roda.
major() { echo "${1#postgres:}" | cut -d. -f1 | cut -d- -f1; }

producao=$(major "$(yq '.services["postgres-db"].image' docker-compose-prod.yml)")
ci_images=$(yq '.jobs[].services.postgres.image | select(. != null)' .github/workflows/pr-checks.yml)

if [ -z "$ci_images" ]; then
  echo "ERRO: nenhum serviço postgres encontrado no pr-checks.yml."
  status=1
fi

for imagem in $ci_images; do
  if [ "$(major "$imagem")" != "$producao" ]; then
    echo "ERRO: pr-checks.yml testa com $imagem, mas docker-compose-prod.yml usa a major $producao."
    status=1
  fi
done

# O front lê a URL da API em runtime (docker-entrypoint.sh); build-arg que o
# Dockerfile não declara como ARG é ignorado.
arg=NEXT_PUBLIC_API_EDU_TRACE
if ! grep -qE "^ARG[[:space:]]+$arg([=[:space:]]|$)" front/Dockerfile; then
  uso=$(grep -nHE "(^|[[:space:]{'])$arg=" .github/workflows/frontend-pipeline.yml .github/workflows/publish-docker.yml || true)
  if [ -n "$uso" ]; then
    echo "ERRO: build-arg $arg passado a front/Dockerfile, que não declara ARG $arg:"
    echo "$uso"
    status=1
  fi
fi

# Disparo manual sem preencher a versão republicaria uma versão antiga.
if [ "$(yq '.on.workflow_dispatch.inputs.version | has("default")' .github/workflows/publish-docker.yml)" = "true" ]; then
  echo "ERRO: publish-docker.yml define default no input version; o disparo manual republicaria essa versão."
  status=1
fi

[ "$status" -eq 0 ] && echo "OK: postgres do CI igual ao da produção, sem build-arg morto no front e sem versão padrão no publish-docker."
exit "$status"

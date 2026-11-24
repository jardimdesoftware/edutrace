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

# O scan do Trivy precisa reprovar a imagem antes de as tags serem criadas.
for pipeline in backend-pipeline frontend-pipeline; do
  arquivo=".github/workflows/$pipeline.yml"
  scan_step='.jobs.docker-build.steps[] | select((.uses // "") | test("trivy-action"))'
  scan="$scan_step | .with"
  if [ "$(yq "$scan | .\"exit-code\"" "$arquivo")" != "1" ]     || [ "$(yq "$scan | .\"ignore-unfixed\"" "$arquivo")" != "true" ]     || [ "$(yq "$scan | .severity" "$arquivo")" != "CRITICAL,HIGH" ]; then
    echo "ERRO: $arquivo precisa de um scan Trivy no docker-build com exit-code 1, ignore-unfixed true e severity CRITICAL,HIGH."
    status=1
  fi
  if [ "$(yq "$scan_step | .env.TRIVY_PLATFORM" "$arquivo")" != 'linux/${{ matrix.arch }}' ]; then
    echo "ERRO: $arquivo precisa definir TRIVY_PLATFORM como linux/\${{ matrix.arch }} no scan Trivy; o digest é um índice e o Trivy procura amd64 por padrão."
    status=1
  fi
  if [ "$(yq '[.jobs.docker-publish.steps[] | select((.uses // "") | test("trivy-action"))] | length' "$arquivo")" != "0" ]; then
    echo "ERRO: $arquivo escaneia a imagem depois de criar as tags; o scan fica no docker-build."
    status=1
  fi
done

# O CHANGELOG.md precisa existir e ser regenerado a cada release publicada.
if [ ! -f CHANGELOG.md ]; then
  echo "ERRO: CHANGELOG.md não existe na raiz."
  status=1
fi
for pipeline in backend-pipeline frontend-pipeline; do
  arquivo=".github/workflows/$pipeline.yml"
  if [ "$(yq '[.jobs.create-release.steps[] | select(.name == "Atualizar CHANGELOG.md")] | length' "$arquivo")" != "1" ]; then
    echo "ERRO: $arquivo não atualiza o CHANGELOG.md no job create-release."
    status=1
  fi
done

# A main é protegida e recusa commit direto: os pipelines gravam na branch
# status. Essa gravação é documentação e não pode derrubar o pipeline, porque o
# deploy só roda quando o pipeline termina com sucesso.
for pipeline in backend-pipeline frontend-pipeline; do
  arquivo=".github/workflows/$pipeline.yml"
  gravacoes=$(grep -cE -- '--method PUT' "$arquivo")
  na_status=$(grep -cE -- '-f branch=status( |$)' "$arquivo")
  if [ "$gravacoes" != "$na_status" ]; then
    echo "ERRO: $arquivo grava pela API sem -f branch=status ($na_status de $gravacoes gravações)."
    status=1
  fi
  passos='- name: (Atualizar CHANGELOG\.md|Publicar cobertura na branch status)[[:space:]]*$'
  total=$(grep -cE -- "$passos" "$arquivo")
  tolerantes=$(grep -A1 -E -- "$passos" "$arquivo" | grep -cE '^[[:space:]]+continue-on-error: true[[:space:]]*$')
  if [ "$total" != "$tolerantes" ]; then
    echo "ERRO: $arquivo precisa de continue-on-error: true logo abaixo do nome dos passos que gravam na branch status."
    status=1
  fi
done
if [ "$(grep -cE -- '- name: Publicar cobertura na branch status' .github/workflows/backend-pipeline.yml)" != "1" ]; then
  echo "ERRO: backend-pipeline.yml não publica a cobertura na branch status."
  status=1
fi

# Release criada com o GITHUB_TOKEN não dispara o evento release: published,
# então o create-release precisa chamar o publish-docker por workflow_dispatch.
for pipeline in backend-pipeline frontend-pipeline; do
  arquivo=".github/workflows/$pipeline.yml"
  if [ "$(yq '[.jobs.create-release.steps[].run // "" | select(test("gh workflow run publish-docker.yml"))] | length' "$arquivo")" != "1" ]     || [ "$(yq '.jobs.create-release.permissions.actions' "$arquivo")" != "write" ]; then
    echo "ERRO: $arquivo precisa disparar o publish-docker.yml no create-release, com permissions.actions write."
    status=1
  fi
done

# Sem regra FAIL o ZAP nunca reprova o job, mesmo com fail_action ligado.
if ! grep -qE '^[0-9]+[[:space:]]+FAIL[[:space:]]' .zap/rules.tsv; then
  echo "ERRO: .zap/rules.tsv não tem nenhuma regra FAIL; o scan do ZAP nunca falharia."
  status=1
fi

[ "$status" -eq 0 ] && echo "OK: postgres do CI igual ao da produção, sem build-arg morto no front, sem versão padrão no publish-docker, Trivy reprovando antes das tags, CHANGELOG atualizado a cada release, CHANGELOG e cobertura gravados na branch status sem bloquear o deploy, publish-docker disparado após a release e ZAP com regras FAIL."
exit "$status"

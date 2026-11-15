#!/usr/bin/env bash
# Gera o CHANGELOG.md (formato Keep a Changelog) a partir das releases do
# GitHub, uma seção por release, da mais recente para a mais antiga.
# Uso: GH_TOKEN=... GITHUB_REPOSITORY=dono/repo bash generate-changelog.sh > CHANGELOG.md
set -euo pipefail

: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY não definido}"

cat <<'CABECALHO'
# Changelog

Todas as mudanças relevantes do projeto ficam neste arquivo, geradas a partir
das releases do GitHub. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

CABECALHO

gh api --paginate "repos/${GITHUB_REPOSITORY}/releases?per_page=100" --jq '
  .[] | select(.draft | not) |
  "## [\(.tag_name)] - \(.published_at[:10])\n\n" +
  (
    [ (.body // "") | split("\n")[] | select(startswith("* "))
      | sub(" by @[^ ]+ in https://[^ ]+/pull/(?<n>[0-9]+)$"; " (#\(.n))")
      | "- " + .[2:] ] as $itens
    | if ($itens | length) == 0 then "- Sem alterações listadas na release."
      else ($itens | join("\n")) end
  ) + "\n"
'

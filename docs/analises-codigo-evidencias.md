# Evidencias de analise de codigo

Este projeto gera evidencias pelo workflow `code-analysis-evidence`.

## CodeQL

- Relatorio: artefato `codeql-sarif-report`
- Formato: SARIF
- Publicacao: GitHub Code Scanning
- Configuracao: `.github/codeql/codeql-config.yml`

## SonarQube

- Workflow: job `SonarQube analysis`
- Configuracao: `sonar-project.properties`
- Evidencia: artefato `sonarqube-scanner-evidence`, contendo `.scannerwork/report-task.txt`
- Segredo necessario: `SONAR_TOKEN`
- Variavel ou segredo necessario: `SONAR_HOST_URL`

## Lint, testes e cobertura

- Artefato: `static-analysis-evidence`
- Backend: `eslint.log`, `jest-coverage.log` e pasta `coverage`
- Frontend: `eslint.log` e `build.log`

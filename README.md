![License](https://img.shields.io/github/license/jardimdesoftware/edutrace)
![Last Commit](https://img.shields.io/github/last-commit/jardimdesoftware/edutrace)
![Top Languages](https://img.shields.io/github/languages/top/jardimdesoftware/edutrace)
![Repo Size](https://img.shields.io/github/repo-size/jardimdesoftware/edutrace)
![Contributors](https://img.shields.io/github/contributors/jardimdesoftware/edutrace)
![Open Issues](https://img.shields.io/github/issues/jardimdesoftware/edutrace)
![Open PRs](https://img.shields.io/github/issues-pr/jardimdesoftware/edutrace)
![Forks](https://img.shields.io/github/forks/jardimdesoftware/edutrace)
![Stars](https://img.shields.io/github/stars/jardimdesoftware/edutrace)
![Coverage](https://img.shields.io/badge/Coverage-97.37%25-brightgreen) <!-- COVERAGE_BADGE -->
![OWASP ZAP](https://github.com/jardimdesoftware/edutrace/actions/workflows/owasp-zap.yml/badge.svg)

# Edutrace - Prontuário Eletrônico para Estudantes NEE

Sistema web para gerenciar prontuários eletrônicos de estudantes com necessidades educacionais específicas, permitindo o registro de informações acadêmicas, de saúde, crises e desempenho, com segurança, acessibilidade e suporte personalizado.

Acesse agora pelo [Link](https://edutrace.ruancarvalho.me/)

## Tecnologias Utilizadas
- **Front-end:** Next.js e estilizado com Tailwind CSS
- **Back-end:** NestJS, utilizando Prisma ORM para interação com o banco de dados
- **Banco de Dados:** PostgreSQL

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white) ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white) ![PostgreSql](https://img.shields.io/badge/postgresql-4169e1?style=for-the-badge&logo=postgresql&logoColor=white)


## Documentação e Wiki
Páginas da [Wiki do projeto](https://github.com/jardimdesoftware/edutrace/wiki):

- [Guia de execução](https://github.com/jardimdesoftware/edutrace/wiki/Guia-de-Execução-e-Configuração-com-Docker-e-Docker-Compose)
- [Variáveis de Ambiente](https://github.com/jardimdesoftware/edutrace/wiki/Variáveis-de-Ambiente)
- [Arquitetura](https://github.com/jardimdesoftware/edutrace/wiki/Documento-de-Arquitetura-de-Desenvolvimento)
- [Perfis e Permissões](https://github.com/jardimdesoftware/edutrace/wiki/Perfis-e-Permissões)
- [CI/CD e Deploy](https://github.com/jardimdesoftware/edutrace/wiki/CI-CD-e-Deploy)


## Como rodar

Caminho com Docker Compose (desenvolvimento), na raiz do repositório:

```bash
cp .env.development.example .env.development
# edite: POSTGRES_PASSWORD (e a mesma senha em DATABASE_URL), SECRET_KEY (32+ caracteres),
# ADMIN_EMAIL, ADMIN_CPF (CPF válido) e ADMIN_PASSWORD
docker compose --env-file .env.development -f docker-compose-dev.yml up --build -d
docker logs nest-backend | grep "successfully started"   # migrations e seed levam alguns minutos
```

O front fica em `http://localhost:${PORT_MACHINE_FRONTEND}` (qualquer porta livre do host) e a API em `http://localhost:${PORT_MACHINE_BACKEND}`. Todas as variáveis e o passo a passo estão no [Guia de execução](https://github.com/jardimdesoftware/edutrace/wiki/Guia-de-Execução-e-Configuração-com-Docker-e-Docker-Compose).

## Segurança

- O OWASP ZAP executa um baseline DAST semanalmente ou por acionamento manual.
- Os cabeçalhos de segurança do frontend (CSP, HSTS, COOP, CORP e outros) e as decisões aceitas do ZAP estão em `front/next.config.ts` (cabeçalhos), `front/src/proxy.ts` (CSP com nonce) e `.zap/rules.tsv` (decisões do ZAP). O que depende do nginx do host está em [`docs/security/reverse-proxy.md`](docs/security/reverse-proxy.md).
- As imagens publicadas no GHCR são construídas com SBOM e proveniência mínima (`provenance: mode=min`).
- O workflow `publish-docker.yml`, acionado manualmente, gera SBOMs CycloneDX do backend e do frontend como artefatos por 90 dias.

## Weekly
Acesse nossa weekly no [Canva](https://canva.link/ig3m8fzockzm8yh).

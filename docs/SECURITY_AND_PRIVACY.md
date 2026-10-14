# Guia de Segurança e Privacidade — EduTrace

## Escopo e classificação

O EduTrace pode tratar dados pessoais e dados pessoais sensíveis de estudantes, inclusive informações de saúde, necessidades educacionais específicas, anamnese, crises, relatórios e planos educacionais. Esses dados exigem acesso estritamente necessário, rastreabilidade e proteção reforçada. Senhas ficam somente em hash; segredos e tokens nunca devem ser versionados ou enviados em logs.

## Regras de privacidade

- documentar finalidade, base legal, controlador, operadores e canal do encarregado;
- coletar somente campos necessários ao acompanhamento autorizado do estudante;
- separar acesso administrativo, educacional, de saúde e do próprio estudante;
- exigir autenticação para leitura, exportação, alteração ou comentário;
- registrar consentimento quando ele for a base aplicável, sem usá-lo para substituir outra base legal obrigatória;
- definir retenção por categoria documental e eliminar/anonimizar ao final do prazo;
- autenticar solicitações de acesso, correção, portabilidade, oposição ou eliminação antes de atendê-las.

Exportações devem ser entregues por canal seguro e expirar. Dados sensíveis não podem aparecer em URLs, métricas, nomes de arquivos públicos, dashboards ou ferramentas de analytics. O Microsoft Clarity deve permanecer desativado nas telas autenticadas/sensíveis ou configurado com mascaramento e aprovação formal do controlador.

## Controles técnicos

- TLS 1.2/1.3, HSTS e redirecionamento HTTP→HTTPS no proxy público;
- banco, backend e frontend acessíveis somente na rede Docker; gateway ligado apenas a `127.0.0.1`;
- autorização sempre no backend, CORS restrito e rate limit de autenticação por IP confiável;
- cabeçalhos CSP, anti-clickjacking, `nosniff`, política de referência e de permissões;
- logs sanitizados, sem prontuário, CPF, token, senha ou conteúdo clínico; acesso ao Loki/Grafana somente por túnel/VPN;
- backups criptografados com testes de restauração e trilha de acesso;
- secrets em ambiente protegido, rotação periódica e imediata em caso de suspeita.

## Entrega segura

PRs passam por cobertura mínima, auditoria npm de produção, Trivy, ZAP e revisão. Vulnerabilidades HIGH/CRITICAL bloqueiam a entrega, salvo aceite de risco explícito, temporário e rastreável. Dependabot executa semanalmente.

## Incidentes

Conter, preservar evidências, rotacionar segredos, identificar dados/titulares atingidos e documentar a linha do tempo. O controlador decide e executa notificações à ANPD e aos titulares quando aplicável. Após o incidente, a causa deve virar teste ou controle automatizado.

Este guia deve ser revisado ao menos semestralmente e quando houver nova categoria de dado, integração, fornecedor ou mudança legal. Não substitui avaliação jurídica do controlador.

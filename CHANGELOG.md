# Changelog

Todas as mudanças relevantes do projeto ficam neste arquivo, geradas a partir
das releases do GitHub. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.61.10] - 2026-11-11

- fix(front): chamar o PEI de Plano Educacional Individualizado na tela (#912)

## [1.61.9] - 2026-11-11

- ci: alinhar workflows com a produção (build-arg do front, versão padrão e postgres) (#911)

## [1.61.8] - 2026-11-11

- chore(front): ignorar AGENTS.md gerado pelo next dev (#910)

## [1.61.7] - 2026-11-11

- feat(k6): adicionar teste controlado de produção (#898)
- docs(k6): preserve production test evidence (#899)
- test(k6): document EduTrace capacity limits (#900)
- fix(docker): fixar PORT=3000 no next-app do compose de desenvolvimento (#908)
- chore(back): declarar PORT=3001 e dotenv no ambiente local do back (#909)

## [1.61.6] - 2026-11-06

- fix(front): leitura dos formulários com aparência própria, diferente da edição (#889)

## [1.61.5] - 2026-11-06

- fix(front): confirmação do encaminhamento ao AEE à frente da lista de professores (#885)

## [1.61.4] - 2026-11-06

- fix(front): modo leitura dos formulários preserva o esqueleto e todo campo tem nome (#887)

## [1.61.3] - 2026-11-06

- fix(front): encaminhamento ao AEE na última etapa também ao criar a anamnese (#883)

## [1.61.2] - 2026-11-06

- fix(back): vincular a Conta Google no primeiro login de conta cadastrada, com hd institucional (#881)

## [1.61.1] - 2026-11-06

- fix(front): tela de completar cadastro sem cabeçalho e rodapé, com retorno ao login (#879)

## [1.61.0] - 2026-11-06

- feat(front): PDF do relatório com nome e CPF mascarado de quem o gerou (#877)

## [1.60.0] - 2026-11-06

- feat(back): rota GET /reports/generator com nome e CPF mascarado de quem gera o relatório (#876)

## [1.59.0] - 2026-11-06

- feat(front): encaminhar estudante ao AEE pela anamnese e avisar o professor (#873)

## [1.58.0] - 2026-11-06

- feat(back): encaminhar estudante ao Professor do AEE com aviso (#871)

## [1.57.0] - 2026-11-06

- feat(front): tela do admin para desativar e reativar usuários (#869)

## [1.56.0] - 2026-11-06

- feat(back): desativar usuários preservando os dados, com carência de 7 dias (#868)

## [1.55.0] - 2026-11-06

- feat(front): autoria e histórico de edições nos formulários do estudante (#865)

## [1.54.0] - 2026-11-06

- feat(back): histórico de versões dos formulários do estudante (#864)

## [1.53.1] - 2026-11-05

- fix(front): tabela de estudantes cortada em telas de pouca altura (#861)

## [1.53.0] - 2026-11-05

- feat(back): permitir uma conta discente e uma profissional por CPF (#859)

## [1.52.1] - 2026-11-05

- fix(back): impedir a elevação de contas com e-mail discente (#858)

## [1.52.0] - 2026-11-05

- feat: Saúde e Professor do AEE visualizam a anamnese do estudante (#857)

## [1.51.2] - 2026-11-05

- fix(front): lista do +N da tag de papéis repete o papel já visível (#853)

## [1.51.1] - 2026-11-05

- fix(front): lista do +N da tag de papéis cortada pelo cabeçalho (#851)

## [1.51.0] - 2026-11-05

- feat(front): tag de papéis do cabeçalho com pílula por papel e contador +N (#849)

## [1.50.3] - 2026-11-04

- refactor(front): proxy.ts exporta proxy, convenção do Next 16, e o pr-checks aponta para ele (#846)
- fix(back): falha do banco ao validar a sessão responde 503 e não encerra a sessão (#843)
- fix(front): alterar-dados exibe a mensagem de erro da API como texto (#844)
- fix(front): falha da API ao abrir o estudante oferece nova tentativa e não leva à home (#845)
- fix(k6): conta NAPNE de teste no seed para os scripts clínicos (#847)

## [1.50.1] - 2026-11-04

- fix(front): campo de e-mail do login sem espaços (#840)

## [1.50.0] - 2026-11-04

- feat(front): fundo das telas com a paleta do cabeçalho (#838)

## [1.49.2] - 2026-11-04

- fix(front): imagem de fundo do cadastro de pessoas ocupa a altura da tela (#836)

## [1.49.1] - 2026-11-04

- fix(front): lista de papéis do cadastro suspensa e ao lado do CPF (#834)

## [1.49.0] - 2026-11-04

- feat(front): cadastro de pessoas sem rodapé com rolagem e papéis retráteis (#832)

## [1.48.0] - 2026-11-04

- feat(front): filtro Meus atendimentos para o Professor do AEE (#831)

## [1.47.1] - 2026-11-04

- fix(front): retângulo branco atrás do card de nova anotação (#830)

## [1.47.0] - 2026-11-04

- fix(front): hover dos botões do cabeçalho sem fundo ciano (#829)

## [1.46.0] - 2026-11-04

- feat(front): cabeçalho com o nome do usuário à esquerda do selo do perfil (#824)

## [1.45.0] - 2026-11-04

- refactor(front): remover a prop onAlteracao de TabelaEstudantes (#822)
- feat(front): botões de voltar padronizados, com o Voltar das telas flutuando sobre o fundo (#823)

## [1.44.0] - 2026-11-04

- feat(front): troca de curso do estudante por seleção com confirmação em popup (#821)

## [1.43.0] - 2026-11-04

- feat(front): Dados do estudante com Responsável pedagógico no lugar de Papéis, campos alinhados e sem rolagem (#819)

## [1.42.0] - 2026-11-04

- feat: estatísticas de atendimento mostram o aluno mais antigo da fila com link para a página dele (#820)

## [1.41.0] - 2026-11-04

- feat(front): cadastro de estudantes pelo NAPNE com curso em lista, rótulos próprios e formulário sem rolagem (#818)

## [1.40.0] - 2026-11-04

- feat(front): estatísticas de atendimento em modal acionado pela Navbar (#810)

## [1.39.0] - 2026-11-04

- feat: matrícula e curso no cadastro via Google e curso alterável pelo NAPNE (#808)

## [1.38.0] - 2026-11-04

- feat(front): exibir o nome do usuário logado acima do perfil na Navbar (#806)

## [1.37.1] - 2026-11-04

- fix(front): padronizar o estado vazio de triagem e anamnese com estudo de caso, PAEE e PEI (#805)

## [1.37.0] - 2026-11-04

- fix: atualizar fast-uri e forçar minimatch 11 (#798)
- fix: remover RegExp dinâmico e caractere bidi literal (#799)
- fix(security): ocultar versão do nginx no host (#801)
- fix(ci): corrigir resultado do OWASP ZAP baseline (#802)
- feat(front): padronizar identidade visual e experiência (#800)

## [1.36.16] - 2026-11-03

- chore: bump the types group across 1 directory with 2 updates (#789)

## [1.36.15] - 2026-11-03

- fix(back): atualizar multer, body-parser e qs (#794)
- fix(front): evitar template literal como formato do console.error (#795)
- fix(back): fechar os alertas restantes do OWASP ZAP (#793)
- chore: bump typescript-eslint from 8.72.0 to 8.72.1 in /back in the eslint group across 1 directory (#788)

## [1.36.14] - 2026-11-03

- chore: bump @swc/core from 1.16.2 to 1.16.20 in /back in the swc group across 1 directory (#734)

## [1.36.13] - 2026-11-03

- chore: bump prettier from 3.9.9 to 3.9.10 in /back (#736)

## [1.36.12] - 2026-11-03

- chore: bump @types/node from 26.6.2 to 26.6.5 in /front in the types group across 1 directory (#729)

## [1.36.11] - 2026-11-03

- chore: bump the jest group across 1 directory with 2 updates (#740)

## [1.36.10] - 2026-11-03

- chore: bump the react group across 1 directory with 2 updates (#738)

## [1.36.8] - 2026-11-03

- chore: bump the eslint group across 1 directory with 4 updates (#741)

## [1.36.7] - 2026-11-03

- chore: bump jspdf-autotable from 5.0.8 to 5.0.9 in /front (#743)

## [1.36.6] - 2026-11-03

- chore: bump the prisma group across 1 directory with 3 updates (#742)

## [1.36.5] - 2026-11-03

- chore: bump the eslint group across 1 directory with 4 updates (#741)
- chore: bump the jest group across 1 directory with 2 updates (#740)
- chore: bump prettier from 3.9.9 to 3.9.10 in /back (#736)
- chore: bump @swc/core from 1.16.2 to 1.16.20 in /back in the swc group across 1 directory (#734)
- chore: bump lucide-react from 1.48.0 to 1.62.0 in /front (#749)

## [1.36.4] - 2026-11-03

- chore: bump the nestjs group across 1 directory with 4 updates (#730)

## [1.36.3] - 2026-11-03

- chore: bump nodemailer from 10.0.13 to 10.2.1 in /back (#750)

## [1.36.2] - 2026-11-03

- chore: bump the next group across 1 directory with 2 updates (#728)

## [1.36.1] - 2026-11-03

- chore: bump handlebars from 4.7.9 to 4.7.10 in /back (#714)

## [1.36.0] - 2026-11-03

- feat: excluir usuário com senha, carência de 7 dias e restauração, e melhorias da tabela do administrador (#786)

## [1.35.0] - 2026-11-03

- refactor: reduzir o papel do administrador a gestão de usuários (#785)

## [1.34.2] - 2026-11-03

- fix(front): abrir a lista de papéis como painel flutuante na tabela de usuários (#784)

## [1.34.1] - 2026-11-03

- fix(back): remover os módulos phases e levels, sem uso e abertos a todos os perfis (#783)

## [1.34.0] - 2026-11-03

- feat: mostrar a anamnese em passos e mover as páginas para o Tailwind (#775)

## [1.33.0] - 2026-11-03

- feat: mostrar estudo de caso, PAEE e PEI em formulário de vários passos (#774)

## [1.32.0] - 2026-11-03

- feat: abrir o formulário do responsável pedagógico num modal (#773)

## [1.31.0] - 2026-11-03

- feat: mostrar os papéis da conta numa lista retrátil de seleção múltipla (#772)

## [1.30.0] - 2026-11-03

- feat: registrar o parecer semestral do professor no registro da disciplina do PEI (#768)
- feat: registrar o relatório multiprofissional do conselho de classe nas anotações (#769)
- feat: permitir que um profissional acumule papéis e criar o papel Professor do AEE (#770)
- feat: passar o atendimento, o estudo de caso e o PAEE para o Professor do AEE com limite fixo de 15 estudantes (#771)

## [1.29.0] - 2026-11-03

- feat: registrar matrícula e curso no cadastro do estudante (#759)
- feat: restringir a anamnese ao Profissional NAPNE e ao próprio estudante (#760)
- feat: registrar o status de atendimento do NAPNE com fila de espera, responsável e limite por profissional (#761)
- feat: exibir, filtrar e contar o status de atendimento na lista de estudantes (#762)
- feat: exibir as estatísticas de atendimento do NAPNE (#763)
- feat: vincular o responsável pedagógico do estudante a um servidor ou a uma pessoa externa (#764)
- feat: criar o estudo de caso do estudante com o parecer do professor do AEE (#765)
- feat: criar o plano de atendimento educacional especializado (PAEE) (#766)
- feat: reformular o PEI em registros por semestre e disciplina preenchidos pelo professor (#767)

## [1.28.0] - 2026-11-03

- refactor: fixar os ids dos níveis de acesso no seed e remover a edição de níveis pela API (#756)
- feat: criar o perfil Profissional NAPNE com acesso às rotas existentes (#757)
- feat: permitir que o Profissional NAPNE cadastre estudantes (#758)

## [1.27.4] - 2026-10-29

- fix(auth): restore Google login on OCI (#748)

## [1.27.3] - 2026-10-15

- refactor(back): trocar a denylist @Levels pela allowlist @AllowLevels com negação por padrão (#718)

## [1.27.2] - 2026-10-15

- fix(front): decidir o acesso às páginas por allowlist no middleware (#717)

## [1.27.1] - 2026-10-15

- fix(front): voltar para a home quando o id do estudante na URL não existe (#716)

## [1.27.0] - 2026-10-13

- feat(front): gerar o relatório do estudante em PDF (#695)

## [1.26.14] - 2026-10-13

- fix(back): devolver triagem e PEI separados no relatório, sem a anamnese (#694)

## [1.26.13] - 2026-10-13

- fix(front): mostrar o botão Exportar só nas linhas de estudante (#693)

## [1.26.12] - 2026-10-13

- fix(front): separar as telas do gov.br das telas em Tailwind em dois root layouts (#681)

## [1.26.11] - 2026-10-12

- chore(deps): atualizar next de 16.3.6 para 16.3.8 no front (#679)

## [1.26.10] - 2026-10-12

- ci: rodar o pr-checks em todo PR, agregar o resultado e proteger a main (#677)
- fix(back): recusar o SECRET_KEY de exemplo e usar o nível do banco no AuthGuard (#678)

## [1.26.9] - 2026-10-12

- fix(ci): tirar o npm dos jobs com escrita, não persistir a credencial do checkout e fixar o npm (#675)

## [1.26.8] - 2026-10-12

- chore(docker): restringir a observabilidade ao host, exigir a senha do Grafana e fixar as versões (#673)
- fix: criar o administrador inicial só sem nenhum administrador, com e-mail, CPF e senha validados do ambiente (#674)

## [1.26.7] - 2026-10-12

- Sem alterações listadas na release.

## [1.26.6] - 2026-10-12

- fix(back): aceitar ficha, anotação e relatório só de titular estudante (#669)
- fix: recusar com 400 os campos não declarados no DTO da rota (#670)
- fix(back): liberar o CORS só para as origens de FRONTEND_URL (#671)
- chore(docker): excluir os arquivos .env do contexto de build das imagens (#672)

## [1.26.5] - 2026-10-12

- fix: gravar a autoria do PEI a partir do usuário autenticado (#668)

## [1.26.4] - 2026-10-12

- fix: validar o formato do e-mail no cadastro e nas fichas e codificá-lo no front (#667)

## [1.26.3] - 2026-10-12

- fix(back): aceitar em id_level só os níveis de acesso existentes (#666)

## [1.26.2] - 2026-10-12

- fix(back): tirar as anotações das respostas de /students e /users (#665)

## [1.26.1] - 2026-10-12

- fix: abrir o login com Google só pela conta vinculada ao sub do Google (#664)

## [1.26.0] - 2026-10-12

- feat(back): limite de requisições por usuário nas rotas autenticadas da API (#663)

## [1.25.6] - 2026-10-12

- fix(back): limitar as tentativas de senha atual em PATCH /auth/me (#662)

## [1.25.5] - 2026-10-12

- fix(back): limitar as rotas públicas de autenticação a 8 requisições por minuto (#661)

## [1.25.4] - 2026-10-12

- fix(back): limitar a 5 os palpites do código de recuperação por conta (#660)

## [1.25.3] - 2026-10-12

- fix(back): responder a recuperação de senha sem esperar o processamento (#659)

## [1.25.2] - 2026-10-12

- fix(back): não esperar o envio do aviso de bloqueio no login (#658)

## [1.25.1] - 2026-10-07

- ci(deploy): automate OCI production updates (#632)
- fix(deps): resolve Dependabot vulnerabilities (#633)
- fix(front): fechar os alertas do OWASP ZAP da issue #630 (#634)

## [1.25.0] - 2026-10-03

- feat: mostrar no login a versão da imagem em execução no lugar da última release do GitHub (#629)

## [1.24.0] - 2026-10-03

- feat: cabeçalhos de segurança HTTP no back e no front, com CSP estrita por nonce (#627)

## [1.23.1] - 2026-10-03

- fix: reservar a versão das releases em fila e marcar a Latest pela maior versão (#625)

## [1.22.2] - 2026-10-03

- Sem alterações listadas na release.

## [1.23.0] - 2026-10-02

- Sem alterações listadas na release.

## [1.22.1] - 2026-10-02

- Sem alterações listadas na release.

## [1.22.0] - 2026-10-02

- Sem alterações listadas na release.

## [1.21.5] - 2026-10-02

- fix: login com Google não altera mais conta discente existente (#610)

## [1.21.4] - 2026-10-02

- fix: ícone do botão de login com Google fora da caixa do botão (#608)

## [1.21.3] - 2026-10-01

- Sem alterações listadas na release.

## [1.21.2] - 2026-09-30

- ci(security): add Semgrep scanning and DAST evidence (#593)
- fix: entregar o token de sessão em cookie HttpOnly e proteger as rotas contra CSRF (#589)

## [1.21.1] - 2026-09-30

- Feat/arm64 container images (#592)

## [1.21.0] - 2026-09-30

- Feat/arm64 container images (#592)

## [1.20.12] - 2026-09-30

- Sem alterações listadas na release.

## [1.20.11] - 2026-09-30

- fix(frontend): improve mobile auth layout (#590)

## [1.20.10] - 2026-09-30

- chore: bump prettier from 3.9.6 to 3.9.9 in /back (#582)

## [1.20.9] - 2026-09-30

- chore: bump the jest group across 1 directory with 3 updates (#581)

## [1.20.8] - 2026-09-30

- Sem alterações listadas na release.

## [1.20.7] - 2026-09-30

- chore: bump the nestjs group in /back with 5 updates (#577)

## [1.20.6] - 2026-09-30

- chore: bump lucide-react from 1.47.0 to 1.48.0 in /front (#578)

## [1.20.5] - 2026-09-30

- chore: bump @types/node from 26.6.1 to 26.6.2 in /front in the types group (#576)

## [1.20.4] - 2026-09-30

- chore: bump the next group in /front with 2 updates (#575)

## [1.20.3] - 2026-09-28

- fix: tirar e-mail, nome e CPF de estudantes das URLs registradas pelo Microsoft Clarity (#588)

## [1.20.2] - 2026-09-28

- Sem alterações listadas na release.

## [1.20.1] - 2026-09-28

- Sem alterações listadas na release.

## [1.20.0] - 2026-09-27

- Sem alterações listadas na release.

## [1.19.0] - 2026-09-27

- Sem alterações listadas na release.

## [1.18.0] - 2026-09-26

- style(front): remover data e destaque do link da versão na tela de login (#568)

## [1.17.0] - 2026-09-23

- fix(back): desbloquear a conta ao redefinir a senha (#563)
- feat(front): aplicar a identidade visual do login na tela de cadastro de pessoas (#564)
- fix(back): não expor a documentação Swagger em produção (#565)
- fix(back): identificar a conta pelo id no lugar do e-mail nos logs de autenticação (#566)

## [1.16.9] - 2026-09-23

- Sem alterações listadas na release.

## [1.16.8] - 2026-09-23

- chore: bump lucide-react from 1.45.0 to 1.47.0 in /front (#553)

## [1.16.7] - 2026-09-22

- chore: bump @types/node from 26.5.1 to 26.6.1 in /front in the types group (#551)

## [1.16.6] - 2026-09-22

- chore: bump @types/node from 26.5.1 to 26.6.1 in /back in the types group (#550)

## [1.16.5] - 2026-09-22

- chore: bump the next group across 1 directory with 2 updates (#548)

## [1.16.4] - 2026-09-22

- chore: bump @govbr-ds/webcomponents from 2.1.3 to 2.2.0 in /front in the govbr-ds group (#549)

## [1.16.3] - 2026-09-22

- chore: bump the nestjs group in /back with 5 updates (#547)

## [1.16.2] - 2026-09-21

- fix(back): restringir a escrita de níveis de acesso e de fases ao Administrador (#561)

## [1.16.1] - 2026-09-21

- fix(back): não devolver senha, dados de redefinição e CPF completo em PATCH e DELETE de /users (#557)

## [1.16.0] - 2026-09-21

- Sem alterações listadas na release.

## [1.15.1] - 2026-09-21

- fix(back): restringir leitura de triagem, anamnese e PEI do estudante aos próprios registros (#555)
- feat: editar anotações multiprofissionais com histórico de versões e aviso por e-mail (#556)

## [1.15.0] - 2026-09-16

- Sem alterações listadas na release.

## [1.14.0] - 2026-09-16

- Sem alterações listadas na release.

## [1.13.7] - 2026-09-16

- chore: bump typescript-eslint from 8.69.0 to 8.70.0 in /back in the eslint group across 1 directory (#523)

## [1.13.6] - 2026-09-16

- chore: bump lucide-react from 1.41.0 to 1.45.0 in /front (#522)

## [1.13.5] - 2026-09-16

- chore: bump @types/node from 26.4.1 to 26.5.1 in /front in the types group (#521)

## [1.13.4] - 2026-09-16

- chore: bump @types/node from 26.4.1 to 26.5.1 in /back in the types group (#520)

## [1.13.3] - 2026-09-16

- chore: bump the react group in /front with 4 updates (#519)

## [1.13.2] - 2026-09-15

- Feat/responsive auth screens (#527)

## [1.13.1] - 2026-09-15

- fix: prevent auth card clipping on mobile (#526)

## [1.13.0] - 2026-09-15

- feat: update responsive auth screens (#525)

## [1.12.10] - 2026-09-09

- Sem alterações listadas na release.

## [1.12.9] - 2026-09-09

- chore: bump @swc/core from 1.16.1 to 1.16.2 in /back in the swc group across 1 directory (#517)

## [1.12.8] - 2026-09-09

- chore: bump the eslint group across 1 directory with 4 updates (#516)

## [1.12.7] - 2026-09-09

- chore: bump lucide-react from 1.35.0 to 1.41.0 in /front (#515)

## [1.12.6] - 2026-09-09

- chore: bump the nestjs group across 1 directory with 4 updates (#514)

## [1.12.5] - 2026-09-09

- chore: bump jest from 30.5.0 to 30.5.1 in /back in the jest group across 1 directory (#504)

## [1.12.4] - 2026-09-09

- chore: bump @types/node from 26.4.0 to 26.4.1 in /front in the types group across 1 directory (#501)

## [1.12.3] - 2026-09-09

- fix(ci): block incompatible NestJS major updates (#513)
- chore: bump the next group across 1 directory with 2 updates (#500)

## [1.12.2] - 2026-09-09

- chore: bump @types/node from 26.4.0 to 26.4.1 in /back in the types group (#499)

## [1.12.1] - 2026-09-09

- chore: bump @types/react-dom from 19.2.5 to 19.2.7 in /front in the react group (#498)

## [1.12.0] - 2026-09-08

- fix: apontar o compose de produção para a imagem publicada do frontend (#510)
- feat(front): linkar a versão exibida no login para a release correspondente (#512)

## [1.11.3] - 2026-09-08

- fix: corrigir login barrado por URL da API inalcançável no middleware (#508)

## [1.11.2] - 2026-09-02

- Revert "chore: add code analysis evidence workflow" (#497)

## [1.11.1] - 2026-09-02

- Revert "chore: add code analysis evidence workflow" (#497)

## [1.11.0] - 2026-09-02

- Sem alterações listadas na release.

## [1.10.12] - 2026-09-02

- Fix/back nao expor senha usuarios (#495)

## [1.10.11] - 2026-09-01

- Sem alterações listadas na release.

## [1.10.10] - 2026-08-31

- Sem alterações listadas na release.

## [1.10.9] - 2026-08-19

- fix(front): gravar o cookie de autenticação com Secure e SameSite (#453)

## [1.10.8] - 2026-08-19

- Sem alterações listadas na release.

## [1.10.7] - 2026-08-19

- fix(front): apontar o Clarity para o projeto y4ln1tkqfy (#450)

## [1.10.6] - 2026-08-19

- chore(front): atualizar nanoid para 3.3.18 (GHSA-2v37-7h3g-55p8) (#447)

## [1.10.5] - 2026-08-19

- chore: bump lucide-react from 1.28.0 to 1.31.0 in /front (#444)

## [1.10.4] - 2026-08-19

- Sem alterações listadas na release.

## [1.10.3] - 2026-08-16

- Sem alterações listadas na release.

## [1.10.2] - 2026-08-16

- fix(front): remover botão Voltar duplicado das telas vazias de Triagem, Anamnese e PEI (#434)

## [1.10.1] - 2026-08-16

- refatoração: atualizado permissões das roles e removida role "Profess… (#250)
- chore(dependabot): add dependabot configuration (#254)
- Minor fix (#274)
- chore: bump the react group in /front with 4 updates (#255)
- chore: bump the nestjs group in /back with 11 updates (#256)
- chore: bump the jest group across 1 directory with 5 updates (#268)
- chore: bump sweetalert2 from 11.26.3 to 11.26.25 in /front (#266)
- chore: bump prettier from 3.5.3 to 3.8.3 in /back (#270)
- chore: bump lucide-react from 0.511.0 to 1.16.0 in /front (#264)
- chore: bump the swc group across 1 directory with 2 updates (#269)
- chore: bump the tailwindcss group in /front with 3 updates (#259)
- chore: bump bcrypt and @types/bcrypt in /back (#272)
- fix(deps): jest@30.4.2 com jest-util@30.4.1 explicito para corrigir pr-check (#283)
- feat: add GitHub Actions workflow for PR checks with backend tests an… (#282)
- test: add unit tests for AuthController methods (#284)
- test: add unit tests for AuthGuard functionality (#285)
- test: add unit tests for AuthModule and AuthService (#286)
- test: add unit tests for CommentsModule, CommentsService and CommentsController (#287)
- test: add unit tests for "update" and "remove methods" in ScreeningsS… (#288)
- chore: bump ts-loader from 9.5.2 to 9.6.0 in /back (#281)
- chore: bump pg from 8.14.1 to 8.21.0 in /back (#280)
- chore: bump the govbr-ds group across 1 directory with 3 updates (#258)
- chore: bump the types group across 1 directory with 2 updates (#263)
- chore: bump typeorm from 0.3.21 to 1.0.0 in /back (#279)
- chore: bump bcryptjs from 3.0.2 to 3.0.3 in /back (#278)
- chore: bump class-validator from 0.14.1 to 0.15.1 in /back (#277)
- chore: bump the nestjs group across 1 directory with 5 updates (#276)
- chore: bump @types/node from 20.17.24 to 25.9.1 in /front in the types group across 1 directory (#260)
- chore: bump the eslint group across 1 directory with 7 updates (#267)
- chore: bump @types/react from 19.2.14 to 19.2.15 in /front in the react group across 1 directory (#275)
- test(prisma): add prisma module and service tests (#289)
- Chore/backend pipeline (#290)
- test(users): add unit tests for controller service and module (#291)
- test(plans-education): add unit tests for update and remove methods i… (#299)
- test(anamnesis): add unit tests for update and remove methods in cont… (#300)
- test(auth): add unit test for fallback behavior when reflector.get re… (#301)
- test(screenings): add unit tests for update and remove methods in con… (#302)
- chore: bump the nestjs group in /back with 5 updates (#296)
- chore: bump typescript-eslint from 8.60.0 to 8.60.1 in /back in the eslint group (#293)
- chore: bump the react group in /front with 3 updates (#292)
- chore: bump lucide-react from 1.16.0 to 1.17.0 in /front (#294)
- chore: bump @types/node from 25.9.1 to 25.9.2 in /back in the types group (#297)
- chore: bump @types/node from 25.9.1 to 25.9.2 in /front in the types group (#298)
- 303 fix table exceeds screen width on smaller resolutions (#304)
- Test/reports unit specs (#305)
- Fix PR #257 lint on Next 16 (#306)
- chore: bump the next group across 1 directory with 2 updates (#257)
- chore: bump typescript from 5.8.2 to 6.0.3 in /front (#262)
- fix(back): corrigir falha no GitHub Actions Backend – Testes (Jest) após upgrade do Prisma 7 (#261)
- chore(front): update lint script to target specific file extensions (#307)
- fix: regenerate back/package-lock.json to resolve npm ci sync error (#273)
- chore: bump prettier from 3.8.3 to 3.8.4 in /back (#318)
- chore: bump @types/react from 19.2.16 to 19.2.17 in /front in the react group (#308)
- chore: bump the nestjs group in /back with 5 updates (#309)
- chore: bump the next group in /front with 2 updates (#310)
- chore: bump @types/node from 25.9.2 to 25.9.3 in /back in the types group (#311)
- chore: bump the tailwindcss group in /front with 3 updates (#312)
- chore: bump @types/node from 25.9.2 to 25.9.3 in /front in the types group (#313)
- chore: bump the eslint group across 1 directory with 2 updates (#314)
- chore: bump @swc/core from 1.15.40 to 1.15.41 in /back in the swc group across 1 directory (#317)
- chore: bump lucide-react from 1.17.0 to 1.21.0 in /front (#316)
- chore: bump ts-loader from 9.6.0 to 9.6.2 in /back (#323)
- chore: bump pg from 8.21.0 to 8.22.0 in /back (#322)
- chore: bump @types/node from 25.9.3 to 26.0.0 in /back in the types group (#321)
- chore: bump @types/node from 25.9.3 to 26.0.0 in /front in the types group (#320)
- chore: bump @nestjs/typeorm from 11.0.1 to 11.0.2 in /back in the nestjs group (#319)
- Fix/prisma build (#332)
- Fix/prisma seed (#333)
- chore: bump @types/node from 26.0.0 to 26.0.1 in /front in the types group (#325)
- fix(back): substituir baseUrl deprecado por paths no tsconfig (#335)
- chore(back): sincronizar package-lock.json com o package.json (#336)
- chore: bump lucide-react from 1.21.0 to 1.22.0 in /front (#326)
- ci(back): cobrir build, seed e imagem Docker no gate de PR (#334)
- test(back): cobrir validação de DATABASE_URL no PrismaService (#338)
- chore: bump @types/node from 26.0.0 to 26.1.0 in /back in the types group across 1 directory (#327)
- chore: bump the eslint group across 1 directory with 3 updates (#329)
- chore: bump @swc/core from 1.15.41 to 1.15.43 in /back in the swc group across 1 directory (#330)
- chore: bump prettier from 3.8.4 to 3.9.4 in /back (#331)
- chore: bump the nestjs group across 1 directory with 2 updates (#337)
- chore: bump the next group in /front with 2 updates (#341)
- chore: bump the tailwindcss group in /front with 2 updates (#342)
- chore: bump @types/node from 26.0.1 to 26.1.0 in /front in the types group (#343)
- chore: bump lucide-react from 1.22.0 to 1.23.0 in /front (#344)
- chore: bump eslint from 9.26.0 to 9.39.4 in /front (#345)
- feat(front): exigir aceite do Termo de Consentimento no cadastro de u… (#346)
- Feat/esqueci senha (#347)
- Chore/docker smtp proxy net (#348)
- fix(front): corrigir e-mail de contato no Termo de Consentimento (#349)
- fix(front): liberar acesso sem login à rota /forgot-password no middl… (#350)
- chore: bump @types/node from 26.1.0 to 26.1.1 in /front in the types group (#351)
- feat(testing): add k6 performance, load, and stress test suites (#377)
- chore(back): permitir configurar porta via PORT (#379)
- fix(front): remover regex numérico do campo de senha do login (#381)
- security(back+front): exigir senha com no mínimo 8 caracteres (#383)
- feat(back): endpoint PATCH /auth/me para autoatendimento de dados (#385)
- refactor(front): trocar Breadcrumbs por botao Voltar central (#387)
- feat(front): cadastrar, nivel de acesso e exportar direto na lista (#389)
- feat(front): tela de autoatendimento Alterar meus dados (#391)
- docs: roteiro de testes manuais de aceitacao (#399)
- chore(front): remover rotas orfas /relatorio e /configuracao (#397)
- refactor(front): enxugar tela Visualizar Estudante (#395)
- refactor(front): Home passa a ser a lista de estudantes (#393)
- chore: bump the nestjs group across 1 directory with 6 updates (#365)
- chore: bump the next group in /front with 2 updates (#368)
- chore: bump @types/node from 26.1.0 to 26.1.2 in /back in the types group across 1 directory (#355)
- chore: bump eslint from 9.39.4 to 9.39.5 in /front (#356)
- chore: bump the tailwindcss group across 1 directory with 2 updates (#361)
- chore: bump @swc/core from 1.15.43 to 1.15.47 in /back in the swc group across 1 directory (#362)
- chore: bump prettier from 3.9.4 to 3.9.6 in /back (#370)
- chore: bump the jest group across 1 directory with 2 updates (#373)
- chore: bump the react group across 1 directory with 4 updates (#374)
- chore: bump typeorm from 1.0.0 to 1.1.0 in /back (#364)
- chore: bump the prisma group across 1 directory with 3 updates (#367)
- chore: bump the eslint group across 1 directory with 4 updates (#372)
- chore: bump lucide-react from 1.23.0 to 1.28.0 in /front (#375)
- chore: bump @govbr-ds/webcomponents from 2.0.0-next.66 to 2.0.0 in /front in the govbr-ds group across 1 directory (#369)
- fix(front): impedir prototype pollution nos handlers de formulário aninhado (#403)
- fix(front): resolver vulnerabilidades de dependências (8 alertas high) (#402)
- fix(back): resolver vulnerabilidades de dependências (12 alertas, 1 crítico) (#401)
- fix(back): mascarar CPF nos retornos da API de usuários e estudantes (#410)
- feat(back): exigir troca de senha no primeiro acesso (#414)
- feat(front): integrar Microsoft Clarity com configuracao em runtime (#422)
- chore: bump eslint-config-next from 16.2.12 to 16.3.0 in /front in the next group (#415)
- chore: bump @govbr-ds/webcomponents from 2.0.0 to 2.1.1 in /front in the govbr-ds group (#416)
- chore: bump @types/node from 26.1.1 to 26.1.2 in /front in the types group (#417)
- fix(front): downgrade typescript version to resolve eslint pipeline e… (#423)
- fix(ci): resolve frontend lint error, ghcr push permissions and trivy… (#424)
- fix(ci): disable docker push and deploy steps (#426)
- feat: add Dockerfile configurations for backend and frontend services (#427)
- ci(back): corrigir pipeline pós-merge (testes, push ao GHCR e injeção) (#428)
- build(front): adicionar .dockerignore para reduzir contexto de build (#429)
- fix(front): resolver o estudante alvo dos comentários por e-mail (#430)
- fix(ci): corrigir a criação de release no frontend-pipeline (#432)

## [1.10.0] - 2026-03-22

- Sem alterações listadas na release.

## [1.9.3] - 2026-03-13

- feat: configure Node.js and validate Next.js standalone build in CI (#247)

## [1.9.2] - 2026-03-13

- proxy-net removido do docker-compose-prod e corrigido a estilização d… (#245)
- fix: removido variavel e fallback e fixado port.listen em 3000 (#246)

## [1.9.1] - 2026-03-11

- Sem alterações listadas na release.

## [1.9.0] - 2026-03-09

- adicionado admin padrão à seed, é preciso configurar uma senha no .env (#242)

## [1.8.0] - 2026-03-09

- Sem alterações listadas na release.

## [1.7.2] - 2026-03-08

- fix: habilita API_URL em runtime sem rebuild e fixa versão do node+al… (#237)
- fix: mantida apenas URL EDU_TRACE (#238)

## [1.7.1] - 2026-02-11

- Sem alterações listadas na release.

## [1.7.0] - 2026-02-09

- Sem alterações listadas na release.

## [1.6.0] - 2025-12-02

- feat: adding .env example (#219)
- feat: adding profile type (#220)

## [1.5.0] - 2025-11-12

- feat: solving issues (#215)
- feat: solving issues (#216)

## [1.4.0] - 2025-11-11

- Fix/trivy on pipeline (#213)
- Feat/code test (#214)

## [1.3.2] - 2025-11-04

- Sem alterações listadas na release.

## [1.3.1] - 2025-11-04

- Remove commented out 'Forgot Password' link (#211)

## [1.3.0] - 2025-11-01

- feat: adding edit and delete functions by pei, anamnesis and screenin… (#210)

## [1.2.0] - 2025-10-31

- feat: adding edit and delete functions by anamnese, screening and pei (#209)

## [1.1.8] - 2025-09-30

- build(deps): bump form-data from 4.0.2 to 4.0.4 in /back (#184)
- build(deps): bump brace-expansion in /back (#185)
- build(deps): bump multer and @nestjs/platform-express in /back (#182)
- build(deps): bump tmp and @inquirer/editor in /back (#188)
- Fixture/removing sonar (#189)
- Develop (#190)
- feat: starting application (#191)

## [1.1.7] - 2025-09-30

- build(deps): bump sha.js from 2.4.11 to 2.4.12 in /back (#181)
- build(deps): bump next from 15.2.4 to 15.4.7 in /front (#183)
- fix: testing pipeline (#187)

## [1.1.6] - 2025-09-29

- Sem alterações listadas na release.

## [1.1.5] - 2025-09-29

- Fixture/removing sonar (#179)
- fix: test webhook (#180)

## [1.1.4] - 2025-09-29

- fix: updating url (#178)

## [1.1.3] - 2025-09-29

- Merge pull request #170 from ifpebj-ti/develop  (#171)
- Merge pull request #171 from ifpebj-ti/main (#172)
- Feature/adding new features (#173)
- Develop (#174)
- fix: removing sonar (#175)
- fix: removing sonar (#176)
- fix: vai dar certo (#177)

## [1.1.2] - 2025-07-14

- Sem alterações listadas na release.

## [1.1.1] - 2025-07-14

- Sem alterações listadas na release.

## [1.1.0] - 2025-07-08

- Sem alterações listadas na release.

## [1.0.0] - 2025-06-16

- Sem alterações listadas na release.

## [0.3.1] - 2025-06-09

- Sem alterações listadas na release.

## [0.3.0] - 2025-06-06

- Sem alterações listadas na release.

## [0.2.1] - 2025-06-03

- feat: update Dockerfile (#133)

## [0.2.0] - 2025-06-03

- Feat/compose (#89)
- feat: ajustando docker-compose (#90)
- Feature/doc endpoint extract profile (#92)
- Develop (#93)
- Feat/add functions screenings (#96)
- Develop (#97)
- feat: adding full database architecture (#98)
- Develop (#99)
- feat: fix_phase_name and adding seed with phases and fixing created user (#100)
- Develop (#101)
- feat: new auth screen (#102)
- Feat/phases and anmnesis (#105)
- Develop (#106)
- feat: applying format in the code (#115)
- Develop (#116)
- Feat/multidisciplinary comments (#117)
- Develop (#118)
- Docs/adding pei (#119)
- Develop (#120)
- build(deps-dev): bump formidable from 3.5.2 to 3.5.4 in /back (#121)
- build(deps): bump multer and @nestjs/platform-express in /back (#122)
- Hotfix/applying lint (#123)
- Develop (#124)
- feat: screening and home (#125)
- Develop (#126)
- Feat/pipeliene adjusments (#127)
- Develop (#128)
- Update docker-compose.yml (#129)
- Update Dockerfile (#130)
- fix: adjusting pages (#131)
- Develop (#132)

## [0.1.0] - 2025-05-06

- Sem alterações listadas na release.


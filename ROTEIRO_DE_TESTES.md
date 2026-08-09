# Roteiro de Testes — EduTrace (Prontuário Eletrônico)

Roteiro de teste de usabilidade/aceitação cobrindo todo o fluxo do sistema.
Cada tarefa tem uma **ação** e o **resultado esperado**. O testador deve executar a ação
e marcar se o resultado ocorreu (OK / Falhou) e anotar observações.

---

## 1. Antes de começar

**Ambiente:** acesse a URL do sistema (em ambiente local, normalmente `http://localhost:3001`).

**Como reportar:** para cada tarefa, anote:
- `OK` se o resultado esperado aconteceu;
- `FALHOU` + o que apareceu (mensagem/tela) + print, se possível;
- Dificuldades de entendimento ("não achei o botão", "não entendi o que fazer").

**Credenciais e dados de teste:**

| Perfil | E-mail | Senha | CPF | Nível de acesso (no cadastro) |
|---|---|---|---|---|
| Administrador (já existe) | `admin@edutrace.com` | `admin123` | — | — |
| Profissional da Saúde | `saude.teste@edutrace.com` | `12345678` | `22222222222` | Profissional de Saúde |
| Profissional da Educação | `educacao.teste@edutrace.com` | `12345678` | `33333333333` | Profissional de Educação |
| Estudante/Família | `estudante.teste@edutrace.com` | `12345678` | `44444444444` | Pais/Responsáveis e Estudante |

> **Observação:** cadastro e redefinição de senha exigem **8+ caracteres** (podem ser
> alfanuméricos); o login aceita qualquer senha válida, sem restrição de formato.

> **Troca obrigatória no primeiro acesso:** toda conta criada pelo administrador
> (e o próprio administrador padrão) é levada para a tela **"Defina sua nova senha"**
> no primeiro login e não acessa mais nada até trocar. Anote as senhas novas que
> você escolher — elas substituem as da tabela acima nos blocos seguintes.

> **Ordem de execução:** os blocos devem ser feitos **na ordem** (2 → 3 → 4 dependem de dados criados no bloco 1).

---

## BLOCO 1 — Administrador

Objetivo: entrar como administrador, criar os demais usuários e usar as funções exclusivas do admin.

| # | Ação | Resultado esperado |
|---|---|---|
| 1.1 | Acesse o sistema com as credenciais de **administrador** (`admin@edutrace.com` / `admin123`) e clique em **Entrar**. | Abre a tela **"Defina sua nova senha"** com o aviso de que a senha atual foi cadastrada pelo administrador. Nenhuma outra tela fica acessível. |
| 1.1.1 | Tente salvar informando `admin123` nos três campos (nova senha, confirmação e senha atual). | Recusado com a mensagem "A nova senha deve ser diferente da senha atual." |
| 1.1.2 | Informe uma **nova senha** de 8+ caracteres, confirme, preencha **Senha atual** com `admin123` e salve. | Mensagem "Dados atualizados!"; o sistema libera e abre a página inicial com a **lista de pessoas** (tabela), com o topo mostrando "Perfil: Admin". |
| 1.2 | Clique em **Cadastrar novas pessoas**. Preencha os dados do **Profissional da Saúde** (tabela acima), selecione o nível **Profissional de Saúde**, marque o **Termo de Consentimento** ("Li e concordo") e clique em **Finalizar**. | Mensagem "Cadastro realizado com sucesso!" e retorno à lista de pessoas com o novo usuário listado. |
| 1.3 | Repita o cadastro para o **Profissional da Educação** (nível **Profissional de Educação**). | Usuário criado e visível na lista. |
| 1.4 | Repita o cadastro para o **Estudante/Família** (nível **Pais/Responsáveis e Estudante**). | Usuário criado e visível na lista. |
| 1.5 | No campo **"Por quem você busca?"**, digite `Estudante`. | A lista filtra e mostra apenas as pessoas cujo nome contém "Estudante". |
| 1.6 | Na linha do Estudante de teste, use o seletor da coluna **Nível de Acesso** para mudar para outro nível; confirme no aviso; depois volte para **Estudante/Família**. | Aparece confirmação; ao confirmar, mensagem de sucesso e o nível é atualizado na hora. |
| 1.7 | Na linha do Estudante de teste, clique no ícone de **olho** (Visualizar / "Mais informações"). | Abre a tela do estudante com Nome, CPF, E-mail, Responsável e Nível, e 4 cartões: **Triagem, Anamnese, Comentários Multiprofissionais, PEI**. |
| 1.8 | Volte para a lista e clique no ícone de **download** (Exportar relatório) na linha do Estudante de teste (que ainda não tem registros). | Aparece o aviso "Nenhum relatório encontrado / Não foram encontrados relatórios para o paciente". |
| 1.9 | No topo da tela, clique em **Sair**. | Sessão encerrada; retorna à tela de login. |

---

## BLOCO 2 — Profissional da Saúde (Triagem e Anamnese)

Objetivo: registrar triagem e anamnese do estudante e comentar. Este perfil **não edita** o PEI.

| # | Ação | Resultado esperado |
|---|---|---|
| 2.1 | Acesse o sistema com as credenciais do **Profissional da Saúde** (`saude.teste@edutrace.com` / `12345678`). Na tela **"Defina sua nova senha"**, escolha uma senha nova de 8+ caracteres, confirme e informe `12345678` como senha atual. | A troca é exigida antes de qualquer outra tela. Após salvar, abre a lista de pessoas; topo mostra "Perfil: Profissional Saúde". |
| 2.2 | Abra o **Estudante de teste** pelo ícone de **olho** e clique no cartão **Triagem**. | Abre a tela **"Criar Nova Triagem"** (com Nome e E-mail do estudante já preenchidos e bloqueados). |
| 2.3 | Preencha o **Relatório médico**, marque algumas **Necessidades Específicas** (ex.: "Baixa Visão") e opções relacionadas, e clique em **Salvar Triagem**. | Mensagem "Triagem criada com sucesso!" e retorno à tela do estudante. |
| 2.4 | Abra novamente o cartão **Triagem**, clique em **Editar Triagem**, altere um campo e salve. | Alteração salva; ao reabrir a triagem os novos valores aparecem. |
| 2.5 | Volte à tela do estudante e clique no cartão **Anamnese**. Preencha os campos e **salve**. | Anamnese criada com sucesso; ao reabrir, os dados aparecem em modo leitura. |
| 2.6 | Volte à tela do estudante e clique no cartão **Comentários Multiprofissionais**. Escreva um comentário e adicione. | Comentário aparece na lista, com o nome do autor e a data. |
| 2.7 | Volte à tela do estudante e clique no cartão **PEI**. | O PEI abre em **modo somente leitura** (ou informa que ainda não há PEI cadastrado) — este perfil **não** deve conseguir criar/editar o PEI. |
| 2.8 | No topo, clique em **Sair**. | Retorna à tela de login. |

---

## BLOCO 3 — Profissional da Educação (PEI)

Objetivo: registrar o PEI. Este perfil **visualiza** triagem/anamnese, mas **não as edita**.

| # | Ação | Resultado esperado |
|---|---|---|
| 3.1 | Acesse o sistema com as credenciais do **Profissional da Educação** (`educacao.teste@edutrace.com` / `12345678`). Faça a troca de senha exigida no primeiro acesso. | A troca é exigida antes de qualquer outra tela. Após salvar, abre a lista de pessoas; topo mostra "Perfil: Profissional Educação". |
| 3.2 | Abra o **Estudante de teste** e clique no cartão **Triagem**. | A triagem abre em **modo somente leitura** (sem botões de editar/excluir). |
| 3.3 | Volte e abra o cartão **Anamnese**. | A anamnese abre em **modo somente leitura**. |
| 3.4 | Volte e clique no cartão **PEI**. Preencha os campos e **salve**. | Mensagem de PEI criado com sucesso; ao reabrir, os dados aparecem. |
| 3.5 | Abra o **PEI** novamente, clique em **Editar**, altere um campo e salve. | Alteração salva com sucesso. |
| 3.6 | Volte e abra o cartão **Comentários Multiprofissionais**. Adicione um comentário. | Comentário aparece na lista com autor e data (junto com o do Profissional da Saúde). |
| 3.7 | No topo, clique em **Sair**. | Retorna à tela de login. |

---

## BLOCO 4 — Estudante/Família (somente consulta)

Objetivo: confirmar que o estudante consulta os **próprios** registros e **não edita** nada nem vê outras pessoas.

| # | Ação | Resultado esperado |
|---|---|---|
| 4.1 | Acesse o sistema com as credenciais do **Estudante/Família** (`estudante.teste@edutrace.com` / `12345678`). Faça a troca de senha exigida no primeiro acesso. | A troca é exigida antes de qualquer outra tela. Após salvar, a página inicial mostra **4 cartões** (Triagem, Anamnese, Comentários Multiprofissionais, PEI) — **não** a lista de pessoas. |
| 4.2 | Clique no cartão **Triagem**. | Abre a triagem **do próprio estudante** em modo somente leitura (a que o Profissional da Saúde criou). |
| 4.3 | Volte e clique no cartão **Anamnese**. | Abre a anamnese do próprio estudante, somente leitura. |
| 4.4 | Volte e clique no cartão **PEI**. | Abre o PEI do próprio estudante, somente leitura. |
| 4.5 | Volte e clique no cartão **Comentários Multiprofissionais**. | Mostra os comentários feitos pelos profissionais; **não** deve haver campo para adicionar comentário. |
| 4.6 | No topo, clique em **Sair**. | Retorna à tela de login. |

---

## BLOCO 5 — Fluxos comuns a qualquer perfil

Podem ser executados com qualquer um dos usuários (sugerido: o Profissional da Saúde).

| # | Ação | Resultado esperado |
|---|---|---|
| 5.1 | Faça login, clique em **Meus dados** (topo). Troque o **e-mail** informando a **Senha atual** e clique em **Salvar alterações**. | Mensagem "Dados atualizados!"; ao reentrar em Meus dados o novo e-mail aparece. (Se trocou o e-mail, use o **novo** e-mail nos próximos logins.) |
| 5.2 | Em **Meus dados**, preencha **Nova senha** + **Confirmar nova senha** + **Senha atual** e salve. Depois faça **logout** e **login** com a nova senha. | Senha alterada; login com a nova senha funciona. |
| 5.3 | Na tela de login, clique em **Esqueci minha senha**. Informe o e-mail, receba o **código de 6 dígitos** por e-mail, digite-o, defina uma nova senha e confirme. | Fluxo em 3 etapas conclui com "Senha redefinida" e leva ao login; o login com a nova senha funciona. |
| 5.4 | Estando **deslogado**, tente abrir diretamente uma URL interna (ex.: `/home`). | O sistema redireciona para a **tela de login** (não permite acesso sem estar logado). |
| 5.5 | Logado como **Estudante/Família**, tente abrir diretamente `/estudantes` ou `/admin/usuarios/cadastro` pela barra de endereço. | O sistema **redireciona para a página inicial** (o estudante não tem acesso a essas áreas). |

---

## BLOCO 6 — Exportação com dados (opcional / fechamento)

| # | Ação | Resultado esperado |
|---|---|---|
| 6.1 | Entre como **Administrador** (ou qualquer profissional). Na lista, clique no ícone de **download** na linha do Estudante de teste (que agora já tem triagem/anamnese/PEI). | Um arquivo **.xlsx** (planilha Excel) do relatório do estudante é baixado. |
| 6.2 | Abra o arquivo baixado. | A planilha contém os dados dos registros do estudante. |

---

## Checklist de aceitação (resumo)

- [ ] Admin consegue criar usuários dos 3 perfis e alterar nível de acesso.
- [ ] Profissional da Saúde cria/edita **Triagem** e **Anamnese**.
- [ ] Profissional da Educação cria/edita **PEI** e apenas visualiza Triagem/Anamnese.
- [ ] Estudante/Família **só consulta** seus registros e não vê outras pessoas.
- [ ] Comentários multiprofissionais funcionam para os profissionais.
- [ ] Exportação de relatório (.xlsx) funciona (e avisa quando não há dados).
- [ ] "Meus dados" (troca de e-mail/senha) e "Esqueci minha senha" funcionam.
- [ ] Rotas protegidas redirecionam usuários sem permissão.

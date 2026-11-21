# Política de segurança

## Versões com suporte

Só a última release publicada recebe correções de segurança. As versões estão em
[Releases](https://github.com/jardimdesoftware/edutrace/releases) e o histórico em
[CHANGELOG.md](CHANGELOG.md).

## Como reportar uma vulnerabilidade

Não abra issue pública para vulnerabilidade. Use o relato privado do GitHub:
aba **Security**, botão **Report a vulnerability**, em
<https://github.com/jardimdesoftware/edutrace/security/advisories/new>.

Inclua no relato:

- a rota, a página ou o arquivo afetado;
- os passos para reproduzir;
- o impacto (que dado ou ação fica exposto);
- a versão (tag da release) em que o problema aparece.

O EduTrace trata dados de saúde e de necessidades educacionais específicas de
estudantes, então qualquer exposição desses dados é tratada como prioridade.

## O que o projeto já faz

- Pipeline com Semgrep, scan de imagem com Trivy (reprova com CRITICAL ou HIGH que tenha correção) e baseline do OWASP ZAP semanal.
- Dependabot para as dependências npm do back e do front e para as GitHub Actions.
- Modelo de ameaças e guia de desenvolvimento seguro na [Wiki](https://github.com/jardimdesoftware/edutrace/wiki).

# Proxy reverso (nginx do host)

O tráfego público chega ao nginx do host e segue para os containers do frontend e do backend. Os cabeçalhos de segurança da aplicação saem do próprio Next.js (`front/next.config.ts` e `front/src/proxy.ts`, que gera a CSP com nonce) e do Helmet no backend, e o nginx os repassa sem alterar. Só o que o nginx gera sozinho precisa ser ajustado nele.

## Cabeçalho `Server` com versão

A varredura do OWASP ZAP (alerta 10036) vê `Server: nginx/1.24.0 (Ubuntu)`, que revela o produto, a versão e a distribuição. O ajuste é enviar só `Server: nginx`, com `server_tokens off` no bloco `http` de `/etc/nginx/nginx.conf`.

O workflow `.github/workflows/deploy-oci.yml` aplica esse ajuste a cada deploy (em toda execução disparada por `backend-pipeline` ou `frontend-pipeline`, e no `workflow_dispatch` com `component` igual a `nginx` ou `all`). Por SSH, no host, ele:

1. Faz backup de `/etc/nginx/nginx.conf` como `nginx.conf.before-server-tokens-<data>`.
2. Troca a diretiva `server_tokens` existente por `server_tokens off;` ou, se não houver, a insere logo após a abertura do bloco `http`.
3. Valida com `nginx -t`. Se falhar, restaura o backup e encerra com erro.
4. Executa `systemctl reload nginx`.
5. Consulta `https://edutrace.ruancarvalho.me/` e falha o deploy se o cabeçalho `Server` for diferente de `nginx`.

A execução usa `flock` em `/tmp/edutrace-nginx.lock` para não concorrer com outra alteração do nginx. Não é necessário ajustar nada manualmente. Para conferir:

```sh
curl -sI https://edutrace.ruancarvalho.me/ | grep -i '^server:'
# server: nginx
```

## O que não mudar no nginx

- Não use `proxy_hide_header` nem `add_header` para os cabeçalhos de segurança (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` etc.). A CSP das páginas leva um nonce novo a cada resposta e só o Next.js sabe o valor. Um `add_header` repetido soma uma segunda CSP e o navegador aplica as duas.
- Não tire o `Cross-Origin-Opener-Policy: same-origin-allow-popups` nem o troque por `same-origin`: o popup do "Entrar com o Google" abre em branco com `same-origin`.

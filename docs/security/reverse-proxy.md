# Proxy reverso (nginx do host)

O tráfego público chega ao nginx do host e segue para os containers do frontend e do backend. Os cabeçalhos de segurança da aplicação saem do próprio Next.js (`front/next.config.ts` e `front/src/middleware.ts`) e do Helmet no backend, e o nginx os repassa sem alterar. Só o que o nginx gera sozinho precisa ser ajustado nele, fora do repositório.

## Cabeçalho `Server` com versão

A varredura do OWASP ZAP (alerta 10036) vê `Server: nginx/1.24.0 (Ubuntu)`, que revela o produto, a versão e a distribuição. Para enviar só `Server: nginx`:

```nginx
# /etc/nginx/nginx.conf, dentro do bloco http { ... }
server_tokens off;
```

```sh
sudo nginx -t && sudo systemctl reload nginx
```

Depois do reload, confira:

```sh
curl -sI https://edutrace.ruancarvalho.me/ | grep -i '^server:'
# server: nginx
```

## O que não mudar no nginx

- Não use `proxy_hide_header` nem `add_header` para os cabeçalhos de segurança (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` etc.). A CSP das páginas leva um nonce novo a cada resposta e só o Next.js sabe o valor. Um `add_header` repetido soma uma segunda CSP e o navegador aplica as duas.
- Não tire o `Cross-Origin-Opener-Policy: same-origin-allow-popups` nem o troque por `same-origin`: o popup do "Entrar com o Google" abre em branco com `same-origin`.

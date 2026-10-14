# Produção em VM pública — EduTrace

## Arquitetura

Uma VM Linux pública executa a aplicação containerizada. O Nginx do host termina TLS para `edutrace.valerialima.me` e encaminha para o gateway Docker em `127.0.0.1:8080`. Backend, frontend e PostgreSQL não publicam portas no host.

## Preparação e implantação

1. Crie uma VM Ubuntu LTS com IP reservado e volume persistente. Libere apenas `80/443` ao público e restrinja SSH ao IP/VPN administrativo.
2. Aponte DNS A/AAAA para a VM, instale Docker Engine/Compose, Nginx e Certbot.
3. Crie `/opt/edutrace/app` e um `.env.production` `0600` a partir do exemplo; gere chaves e senhas aleatórias.
4. Adapte `nginx/host-nginx.example.conf`, obtenha o certificado e valide `nginx -t`.
5. Configure no environment `production` do GitHub: `VM_HOST`, `VM_USER`, `VM_SSH_KEY` e `VM_KNOWN_HOSTS`.

Subida manual equivalente ao workflow:

```bash
cd /opt/edutrace/app
docker compose --env-file .env.production -f docker-compose-prod.yml pull
docker compose --env-file .env.production -f docker-compose-prod.yml up -d
curl --fail https://edutrace.valerialima.me/
```

O workflow `deploy-vm.yml` sincroniza apenas configurações sem segredo, baixa as imagens do GHCR, atualiza a stack sob lock e exige health check HTTPS.

## Portainer

Execute uma única instância por VM e use túnel SSH:

```bash
docker compose -f docker-compose-portainer.yml up -d
ssh -L 9443:127.0.0.1:9443 usuario@vm
```

Acesse `https://localhost:9443`, defina senha forte/MFA e não exponha a porta 9443 publicamente.

## Métricas, logs e traces

Defina `GRAFANA_ADMIN_PASSWORD` e suba o overlay junto à aplicação:

```bash
docker compose --env-file .env.production \
  -f docker-compose-prod.yml -f docker-compose-observability.yml up -d
ssh -L 3002:127.0.0.1:3002 usuario@vm
```

Prometheus coleta `/metrics` e cAdvisor; Promtail envia logs Docker ao Loki; a API instrumentada envia traces OTLP ao Collector/Tempo. Grafana inicia com os três datasources provisionados.

## Aceite

- cobertura mínima de 70% nos fluxos críticos e pipelines verdes;
- auditoria npm e Trivy sem HIGH/CRITICAL;
- certificado válido, redirecionamento HTTP→HTTPS, HSTS e cabeçalhos de segurança;
- targets do Prometheus `UP`, logs no Loki e traces da API no Tempo;
- `k6/tests/load/load.test.js` dentro dos thresholds;
- backup criptografado e restauração testada.

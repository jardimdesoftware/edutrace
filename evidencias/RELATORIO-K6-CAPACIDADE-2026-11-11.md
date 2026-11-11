# Teste k6 de capacidade do EduTrace — 11/11/2026

## Como foi executado

- Alvo: `https://edutrace.ruancarvalho.me`.
- Cenário somente leitura nas rotas públicas `/` e `/login`.
- Primeiro teste: rampa progressiva de 10 até 200 usuários virtuais.
- Segundo teste: patamares isolados de 50, 100, 150 e 200 usuários virtuais,
  mantidos por 20 segundos cada.
- Critério de degradação: latência p95 igual ou superior a 750 ms.
- Salvaguardas: interrupção automática acima de 2% de falhas ou abaixo de 98%
  de checks aprovados.

## Resultado da rampa

- Execução: GitHub Actions `42950152812`.
- Pico: 200 usuários virtuais.
- 11.498 requisições e 5.749 iterações.
- 0% de falhas e 11.498 checks aprovados.
- Latência p95 geral: 982,19 ms.
- O sistema continuou disponível, mas apresentou degradação de latência.

## Resultado por patamar

Execução: GitHub Actions `42951768161`.

| Usuários virtuais | Latência p95 | Avaliação pelo limite de 750 ms |
|---:|---:|---|
| 50 | 319,99 ms | Dentro do limite |
| 100 | 494,86 ms | Dentro do limite |
| 150 | 965,13 ms | Sobrecarregado |
| 200 | 1.100,11 ms | Sobrecarregado |

Foram realizadas 10.726 requisições, sem falhas e sem checks reprovados. A
degradação começa entre 100 e 150 usuários virtuais; 150 usuários já excedem o
limite de qualidade adotado. Isso não representa queda do sistema, e sim aumento
relevante do tempo de resposta nas páginas públicas testadas.

## Evidências

- `k6-capacity-run-42950152812/k6-edutrace-capacity-summary.json`.
- `k6-capacity-levels-42951768161/k6-edutrace-capacity-summary.json`.

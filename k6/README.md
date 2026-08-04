# 🚀 EduTrace — Testes k6

Testes de performance e carga para a API EduTrace utilizando [k6](https://k6.io/).

---

## 📁 Estrutura

```
k6/
├── .env.example                       # Variáveis de ambiente necessárias
├── config/
│   └── options.js                     # Configurações centralizadas (thresholds, stages)
├── helpers/
│   └── auth.js                        # Helper de autenticação JWT
└── tests/
    ├── smoke/
    │   └── smoke.test.js              # Sanidade — 1 VU, 30s
    ├── load/
    │   └── load.test.js               # Carga normal — até 20 VUs, ~3.5min
    ├── stress/
    │   └── stress.test.js             # Stress — até 80 VUs, ~5min
    └── endpoints/
        ├── auth.test.js               # POST /auth/login, GET /auth/profile
        ├── users.test.js              # CRUD /users
        ├── students.test.js           # GET /students
        ├── screenings.test.js         # CRUD /screenings
        ├── anamnesis.test.js          # CRUD /anamnesis
        ├── plans-education.test.js    # CRUD /plans-education
        └── reports.test.js            # GET /reports/:email
```

---

## ⚙️ Instalação do k6

### Windows (Chocolatey)
```powershell
choco install k6
```

### Windows (Winget)
```powershell
winget install k6 --source winget
```

### Windows (binário)
Baixe diretamente em: https://github.com/grafana/k6/releases

### Linux/macOS
```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

---

## 🔧 Configuração

1. Copie o arquivo de exemplo de variáveis de ambiente:
   ```powershell
   copy k6\.env.example k6\.env
   ```

2. Edite `k6\.env` com suas credenciais reais:
   ```env
   BASE_URL=http://localhost:3000
   ADMIN_EMAIL=seu-admin@email.com
   ADMIN_PASSWORD=suaSenha123
   USER_EMAIL=usuario@email.com
   USER_PASSWORD=suaSenha123
   TEST_STUDENT_EMAIL=estudante-existente@email.com
   ```

3. Certifique-se que a API está rodando:
   ```powershell
   # No diretório back/
   npm run start:dev
   ```

---

## ▶️ Executando os Testes

> **Execute todos os comandos a partir da raiz do projeto** (`edutrace/`).

### 🔵 Smoke Test — Verificação rápida de sanidade
```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e ADMIN_EMAIL=admin@edutrace.com \
  -e ADMIN_PASSWORD=senhaSegura123 \
  k6/tests/smoke/smoke.test.js
```

### 🟡 Load Test — Carga normal de produção (~3.5 min)
```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e ADMIN_EMAIL=admin@edutrace.com \
  -e ADMIN_PASSWORD=senhaSegura123 \
  k6/tests/load/load.test.js
```

### 🔴 Stress Test — Encontrar limite da API (~5 min)
```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e ADMIN_EMAIL=admin@edutrace.com \
  -e ADMIN_PASSWORD=senhaSegura123 \
  k6/tests/stress/stress.test.js
```

### Testes por endpoint específico
```bash
# Auth
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6/tests/endpoints/auth.test.js

# Users
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6/tests/endpoints/users.test.js

# Screenings
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6/tests/endpoints/screenings.test.js

# Anamnesis
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6/tests/endpoints/anamnesis.test.js

# Plans Education
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6/tests/endpoints/plans-education.test.js

# Reports (requer estudante existente no banco)
k6 run -e BASE_URL=http://localhost:3000 -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e TEST_STUDENT_EMAIL=... k6/tests/endpoints/reports.test.js
```

### Exportar resultados para JSON
```bash
k6 run --out json=k6/results.json k6/tests/smoke/smoke.test.js
```

---

## 📊 Thresholds de Performance

| Teste   | p(95) Duration | p(99) Duration | Taxa de Falha |
|---------|---------------|---------------|---------------|
| Smoke   | —             | < 200ms       | < 1%          |
| Load    | < 500ms       | < 1000ms      | < 1%          |
| Stress  | < 1000ms      | < 2000ms      | < 5%          |

---

## 🧩 Variáveis de Ambiente

| Variável             | Descrição                                    | Padrão                     |
|---------------------|----------------------------------------------|---------------------------|
| `BASE_URL`          | URL base da API                              | `http://localhost:3000`   |
| `ADMIN_EMAIL`       | Email do usuário administrador               | `admin@edutrace.com`      |
| `ADMIN_PASSWORD`    | Senha do administrador                       | `senhaSegura123`          |
| `USER_EMAIL`        | Email de usuário comum (não-admin)           | `usuario@edutrace.com`    |
| `USER_PASSWORD`     | Senha do usuário comum                       | `senhaSegura123`          |
| `TEST_STUDENT_EMAIL`| Email de estudante com dados no banco        | `estudante@edutrace.com`  |

---

## ⚠️ Observações Importantes

1. **Anamnesis**: O endpoint `POST /anamnesis` também atualiza `id_current_phase` do usuário. Para testar o ciclo completo, é necessário que o usuário exista no banco. Os testes de endpoint criam emails únicos por iteração para evitar conflitos.

2. **Users - Criação**: Apenas admins (`id_level: 1`) podem criar usuários. O teste `users.test.js` usa as credenciais de admin.

3. **Reports**: O endpoint `GET /reports/:email` busca dados existentes. Configure `TEST_STUDENT_EMAIL` com um email que já possui triagem/anamnese no banco.

4. **Dados de teste**: Os testes de CRUD criam e deletam dados em cada iteração (ciclo de vida completo). Certifique-se de rodar apenas contra um ambiente de desenvolvimento/staging.

# Resolvendo o erro 405 ao atualizar o estoque

Este guia documenta o problema de `405 Method Not Allowed` encontrado ao registrar pedidos no PExpress, a solução adotada e o passo a passo para configurar corretamente os deploys no Netlify e no GitHub Pages.

---

## 1. Contexto do problema

- **Sintoma**: ao registrar um pedido, a requisição `POST` para `/.netlify/functions/update-stock` retornava `405 Method Not Allowed`.
- **Cenário em que surgiu**: build hospedado no **GitHub Pages**.
- **Consequência**: o estoque não era atualizado e o usuário recebia a mensagem “Falha ao atualizar estoque (status 405)”.

### 1.1 Diagnóstico

- O frontend usa `fetch` para chamar a função Netlify `update-stock`.
- Em ambiente GitHub Pages, `window.location.origin` aponta para `https://<user>.github.io`.
- Como o domínio GitHub não hospeda funções Netlify, o servidor devolveu 405 (somente GET permitido).

### 1.2 Causa-raiz

A aplicação inferia o endpoint das funções a partir da origem atual (quando não era `localhost`). Em hospedagens estáticas sem Netlify Functions, isso redirecionava a chamada para um host que desconhece a rota `/.netlify/functions/update-stock`, resultando em 405.

---

## 2. Solução aplicada

### 2.1 Resolver de endpoint inteligente

Arquivo: `web/src/services/inventory.ts`  
Trecho chave: linha 22 (função `resolveUpdateStockEndpoint`).

Regras implementadas:

1. Se existir `VITE_FUNCTIONS_BASE_URL`, ele é usado como base principal (com sanitização).
2. Caso contrário, somente herda `window.origin` quando:
   - está em `localhost` (desenvolvimento); **ou**
   - está em um domínio Netlify (`*.netlify.app`, `*.netlify.com`, `*.netlify.dev`).
3. Para qualquer outro host (ex.: GitHub Pages), cai no fallback `https://pexpress-netlify.netlify.app`.

Resultado: builds fora do Netlify não tentam chamar funções inexistentes.

### 2.2 Feedback de sincronização

Arquivo: `web/src/hooks/useProduct.ts`  
Agora `refetch` retorna `{ok: boolean, error?: string}`, permitindo tratar sincronizações com mensagens mais claras no UI (ver `web/src/App.tsx`).

### 2.3 Interface renovada

Embora não impacte o erro 405, o redesign facilita identificar o estado de sincronização e monitorar estoque em tempo real.

### 2.4 Consistência em pedidos concorrentes

Arquivo: `netlify/functions/update-stock.js`  
Aplicamos mutações com `dec` atômico + `ifRevisionID`, com até 3 tentativas. Se outro pedido consumir o estoque primeiro, a função:

- Reconsulta o estoque direto na API (sem CDN);
- Retorna HTTP 409 com o estoque mais recente;
- O frontend faz refetch automático e ajusta a quantidade sugerida.

Isso impede que duas pessoas derrubem o estoque incorretamente.

---

## 3. Configuração do ambiente

### 3.1 Variáveis comuns

Configure os seguintes valores:

| Nome                        | Hospedagem            | Descrição |
| --------------------------- | --------------------- | --------- |
| `VITE_FUNCTIONS_BASE_URL`   | GitHub Pages / Vite   | URL base das funções Netlify (sem `/.netlify/functions/update-stock`). |
| `SANITY_PROJECT_ID`         | Netlify Functions     | ID do projeto Sanity usado para leitura/escrita. |
| `SANITY_DATASET`            | Netlify Functions     | Dataset Sanity (ex.: `production`). |
| `SANITY_WRITE_TOKEN`        | Netlify Functions     | Token com permissão de escrita no Sanity. |
| `CORS_ALLOWED_ORIGIN`       | Netlify Functions     | Origem permitida (use o domínio do app, ex.: `https://pexpress-netlify.netlify.app`). |
| `VITE_SANITY_USE_CDN`       | Frontend (opcional)   | Defina `false` para evitar cache do CDN e exibir estoque em tempo real (recomendado para este app). |

> Dica: mantenha as variáveis em `.env.local` para desenvolvimento e use os painéis de configuração nos serviços de hospedagem.

---

### 3.2 Deploy no Netlify

1. **Conecte o repositório** ao Netlify.
2. **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `web/dist`
   - Functions directory: `netlify/functions`
3. **Env vars** (em *Site settings → Environment variables*):
   - `SANITY_PROJECT_ID`
   - `SANITY_DATASET`
   - `SANITY_WRITE_TOKEN`
   - `SANITY_API_VERSION` (opcional, default `2024-03-01`)
   - `CORS_ALLOWED_ORIGIN` (adicione o domínio do front, ex.: `https://pexpress-netlify.netlify.app`)
4. **Deploy** e teste `https://<seu-site>.netlify.app/.netlify/functions/update-stock` com um `POST` contendo JSON válido.

Após o deploy, o frontend hospedado no mesmo domínio Netlify já funcionará sem `VITE_FUNCTIONS_BASE_URL` extra.

---

### 3.3 Deploy no GitHub Pages

1. **Build** da aplicação:
   ```bash
   cd web
   npm install
   VITE_FUNCTIONS_BASE_URL="https://<seu-site>.netlify.app" npm run build
   ```
   - Substitua `<seu-site>` pelo domínio Netlify que expõe as funções (`pexpress-netlify.netlify.app` por padrão).
2. **Publique** o conteúdo de `web/dist` no branch configurado para GitHub Pages (ex.: `gh-pages`).
3. **Confirme** no GitHub Pages:
   - A requisição `POST https://<user>.github.io/.netlify/functions/update-stock` não ocorre mais.
   - As chamadas vão para `https://<seu-site>.netlify.app/.netlify/functions/update-stock`.

> Se esquecer de definir `VITE_FUNCTIONS_BASE_URL`, o fallback usará `https://pexpress-netlify.netlify.app`. Ajuste o valor caso use outro site Netlify.

---

### 3.4 Desenvolvimento local

Opção A – usando `netlify dev`:

```bash
cd web
netlify dev
```

- O Netlify CLI expõe as funções em `http://localhost:8888/.netlify/functions/...`
- Nesse caso, não é necessário definir `VITE_FUNCTIONS_BASE_URL`; a origem é `localhost` e o resolver aponta automaticamente.

Opção B – servidor Vite puro:

```bash
cd web
VITE_FUNCTIONS_BASE_URL="https://pexpress-netlify.netlify.app" npm run dev
```

- Use a URL do seu deploy Netlify ou um túnel local caso esteja rodando as funções separadamente.

---

## 4. Checklist de troubleshooting

1. **405 Method Not Allowed**  
   - Verifique se o host atual realmente possui funções Netlify.  
   - Confirme `VITE_FUNCTIONS_BASE_URL` no build.
2. **403/401 Forbidden**  
   - Confirme `SANITY_WRITE_TOKEN` com permissões corretas.  
   - Confira `CORS_ALLOWED_ORIGIN`.
3. **Estoque demora a atualizar**  
   - Garanta que `VITE_SANITY_USE_CDN=false` nos builds em produção para ler direto da API do Sanity.  
   - Confirme que o dataset permite `listen` ou ajuste o intervalo de `refetch`.
4. **500 Missing Sanity configuration**  
   - Variáveis `SANITY_PROJECT_ID`, `SANITY_DATASET` e `SANITY_WRITE_TOKEN` devem estar presentes no ambiente das funções.
5. **Erro ao sincronizar dados**  
   - Veja a aba “Network”/“Console” para mensagens detalhadas retornadas por `submitOrder`.

---

## 5. Referências rápidas

- Resolver de endpoint: `web/src/services/inventory.ts`
- Função Netlify: `netlify/functions/update-stock.js`
- Hook de produtos: `web/src/hooks/useProduct.ts`
- Interface principal: `web/src/App.tsx` + `web/src/App.css`

---

## 6. Próximos passos recomendados

- Automatizar testes de integração (ex.: script que dispara uma requisição `POST` de teste em CI).
- Incluir monitoramento/logging das funções Netlify (Netlify Logs, Log Drains).
- Versionar configurações sensíveis usando secrets nos pipelines (GitHub Actions / Netlify Build).

Com essas configurações, o erro 405 não deve mais ocorrer em ambientes alternativos como GitHub Pages, mantendo o fluxo de pedidos funcional em todos os cenários. Boa implantação! 🚀

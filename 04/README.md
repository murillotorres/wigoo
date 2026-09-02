# 04 · Contrato de ferramenta (MCP)

O problema do item 03 (mídia, BI e ERP mostrando números diferentes de receita) se repete todo mês, com todo cliente. Em vez de alguém rodar consulta manual toda vez, viraria uma ferramenta (`tool`) que um agente de IA pode chamar via MCP, buscando os números direto no BigQuery.

## Nome da ferramenta

`reconcile_revenue` — recebe um cliente e um período, devolve a receita que cada fonte (mídia, BI, ERP) registrou naquele período.

## Entrada

```json
{
  "client_id": "vitalis",
  "date_start": "2026-03-01",
  "date_end": "2026-03-31"
}
```

| Campo | Tipo | Regra |
|---|---|---|
| `client_id` | texto | precisa estar na lista de clientes que quem está perguntando pode ver |
| `date_start` | data (AAAA-MM-DD) | — |
| `date_end` | data (AAAA-MM-DD) | não pode ser antes de `date_start`, e o período não pode passar de 31 dias |

## Saída

Sempre estruturada (números em campos separados), nunca só um texto solto:

```json
{
  "client_id": "vitalis",
  "currency": "BRL",
  "period": { "start": "2026-03-01", "end": "2026-03-31" },
  "sources": {
    "media": { "revenue": 100000.25, "orders": 821 },
    "bi":    { "revenue": 98500.25,  "orders": 806 },
    "erp":   { "revenue": 97200.25,  "orders": 794 }
  },
  "generated_at": "2026-03-02T09:00:00Z",
  "query_id": "job_abc123",
  "bytes_processed": 452000
}
```

O agente enxerga esse JSON pronto. Ele pode explicar o que os números significam, mas os números em si vêm prontos da consulta — ele não os calcula.

## Como garantir que o agente fala o número certo, e não um número "que parece certo"

Modelo de IA erra número — ele pode "arredondar de memória" um valor que já viu antes numa conversa. Pra evitar isso:

1. A ferramenta devolve o número já calculado (não pede pro modelo somar nada).
2. Depois que o agente escreve a resposta final, um passo automático confere: os números que aparecem no texto do agente batem com os números que vieram da ferramenta? Se não bater, a resposta é rejeitada e refeita.
3. Sempre que der, o número aparece direto na tela vindo do JSON (não digitado pelo modelo) — por exemplo, um card ou tabela montada a partir da resposta da ferramenta, não do texto livre do modelo.

Ou seja: o modelo pode **explicar** o resultado, mas o valor que conta é sempre o que veio da consulta, nunca o que o modelo "lembrou".

## Guardrails (as travas de segurança)

**Nada de consulta destrutiva.** A ferramenta nunca deixa o modelo escrever a consulta (SQL) livre. Existem só algumas consultas prontas e aprovadas, com espaço pra encaixar o cliente e as datas — nada além disso. A conta de acesso que faz essa consulta só pode ler, nunca apagar ou alterar nada.

**Nada de acessar o dataset errado.** O `client_id` que o modelo manda não é suficiente sozinho. Antes de rodar a consulta, o sistema confere de verdade: essa pessoa/sessão tem permissão de ver esse cliente? Essa checagem roda no servidor, fora do alcance do modelo — o modelo não pode simplesmente "pedir" acesso a um cliente que não é dele.

**Nada de consulta gigante e cara.** Período máximo de 31 dias, consulta sempre lê só as partições daquele período (não a tabela toda), e existe um teto de quantos bytes aquela consulta pode processar. Se passar do teto, a consulta é recusada antes de rodar — o custo não pode surpreender.

## Como eu confirmaria, de forma sistemática, que a ferramenta responde certo

Eu montaria uma lista de casos de teste com pergunta conhecida e resposta certa já calculada à mão (um "gabarito"): cliente válido, cliente que a pessoa não tem permissão de ver, mês sem nenhum dado, mês com números bem diferentes entre as fontes, período maior que o permitido, uma consulta que estoura o limite de custo.

E separaria dois tipos de teste, porque um erro pode estar em lugares diferentes:

- **A ferramenta traz o número certo?** (comparo o JSON de resposta contra o gabarito — isso testa só a consulta, sem o modelo no meio)
- **O agente entende e repete certo o que a ferramenta trouxe?** (comparo o texto final do agente contra o JSON que ele recebeu — isso testa só o modelo)

Separar os dois ajuda a saber se o problema é na consulta ou na conversa.

## Quando eu **não** usaria um agente aqui — e usaria um job agendado com alerta

Pra checagem de rotina, que precisa acontecer **mesmo que ninguém pergunte** — por exemplo, todo dia de manhã comparar mídia × BI × ERP e avisar se a diferença passar de um certo limite — isso deveria ser um job agendado, sem IA no meio: mais barato, mais previsível, e não depende de alguém lembrar de perguntar.

O agente entra quando é uma pergunta pontual e exploratória: "por que março ficou tão diferente?", "quais dias tiveram maior divergência?", "compara esse cliente com o mês passado". Ali, sim, vale a pena ter uma conversa que investiga — mas a rotina que precisa disparar sozinha, todo dia, continua sendo um job, não um agente.

# Desafio técnico — Tech Lead (Wigoo)

Entrega para a vaga #256, cliente fictício **Vitalis** (rede de farmácias com e-commerce em VTEX).

## Como está organizado

| Pasta | Item | O que tem lá |
|---|---|---|
| [`01/`](01/README.md) | Arquitetura — pipeline de ingestão multi-cliente | Só texto |
| [`02/`](02/README.md) | Engenharia — estender o módulo legado | Código rodando (Node.js/TypeScript), testes, Dockerfile |
| [`03/`](03/README.md) | E-commerce — rastreamento ponta a ponta | **Deixado de fora de propósito** — explicação dentro |
| [`04/`](04/README.md) | IA aplicada — contrato de ferramenta MCP | Só especificação |

Todas as decisões, uma por uma, com o porquê, estão em [`DECISOES.md`](DECISOES.md).

---

## 1. Quanto tempo eu gastei, de verdade

`[PREENCHER: tempo real gasto revisando o enunciado, conversando com a IA, decidindo o corte de escopo e validando a entrega]`

Uso IA de forma intensa no meu fluxo de trabalho (ver seção 4), então o tempo de relógio não equivale a "tempo digitando código". Prefiro registrar o número real do que estimar pra parecer mais rápido do que foi.

## 2. O que ficou de fora, e o que eu faria com mais tempo

**O item 03 inteiro** foi cortado por decisão minha — está explicado com detalhe em [`03/README.md`](03/README.md). Resumindo: é o item mais barato de refazer isolado depois (não depende de infraestrutura), então preferi usar o tempo garantindo que o item de engenharia funcionasse de ponta a ponta e que as respostas de arquitetura e IA fossem diretas, em vez de espalhar atenção pelos quatro.

Dentro do que foi entregue, deixei de fora (e documentei onde, no README de cada pasta):

- **Deduplicação de verdade, compartilhada entre servidores.** O item 02 usa uma versão em memória, que só funciona com uma cópia do serviço rodando. Pra produção, precisaria de Firestore, Redis ou um banco com restrição de único. Não fiz porque isso puxa uma peça de infraestrutura (banco/cache gerenciado) que não faz sentido montar dentro do prazo deste exercício — mas deixei a peça isolada atrás de uma interface, então trocar não exige reescrever o resto.
- **Verificação de que o webhook realmente veio da VTEX.** Não tenho como saber o mecanismo real usado (assinatura, token, IP) sem essa informação — inventar uma verificação falsa seria pior do que registrar isso como risco conhecido.
- **Testar o `docker build` de verdade.** Não tem Docker instalado nesta máquina. O `Dockerfile` segue o padrão comum, e os comandos que ele roda foram testados fora do container.

## 3. As decisões em que mais hesitei

**Não inventar a origem do `gclid`.** O código original tratava `utmiCampaign` (nome de campanha) como se fosse `gclid` (id de clique) — são coisas diferentes. Eu não sei qual é o campo certo, porque o enunciado não mostra isso. Hesitei entre manter o comportamento antigo (mesmo sabendo que está errado) ou parar de mandar esse dado. Decidi parar de mandar: prefiro um "não elegível" explícito a poluir os relatórios do Google Ads com um clique que não existe. Isso muda o comportamento atual do sistema — é a decisão que mais pesa pra defender.

**Cortar o item 03 inteiro, em vez de cortar um pedaço de cada item.** Cogitei fazer os quatro itens de forma mais rasa. Decidi que um corte total e explicado é mais fácil de defender numa conversa técnica do que quatro entregas capengas — e o enunciado pede exatamente isso.

**Deixar a deduplicação em memória, sabendo que não serve pra produção.** Cogitei simular algo mais "parecido com produção" (tipo um arquivo em disco fingindo ser banco). Decidi que isso adicionaria complexidade sem resolver o problema de verdade (ainda não funcionaria com múltiplas instâncias) — é mais honesto entregar a versão simples que funciona pro exercício e documentar claramente o que muda em produção.

## 4. Onde usei IA e onde preferi escrever à mão

Usei o Claude Code de forma intensa e declarada, como o próprio enunciado permite: para ler o PDF do desafio, montar a estrutura da entrega, escrever o código do item 02 (incluindo os testes), rodar e conferir que tudo funciona (`npm test`, `npm run build`, chamada real no servidor local), e escrever os quatro README.md e este arquivo.

As decisões que aparecem aqui — o corte do item 03, o tratamento do `gclid`, o desenho de isolamento por dataset, o que fica manual na pipeline — são minhas escolhas, tomadas e revisadas por mim; a IA foi usada pra executar e redigir, não pra decidir sozinha. Antes de qualquer conversa técnica sobre esta entrega, é meu compromisso ler e validar linha a linha o que está aqui, porque é isso que vou defender.

## 5. Premissas que assumi porque o enunciado não deixou claro

- `sellingPrice` e `value` do pedido de exemplo estão em **centavos** — só assim a soma dos itens fecha exatamente com o `value` informado (`2 × 7495 + 1 × 4000 = 18990`).
- O formato exato do payload que o Meta CAPI espera não foi informado; usei o formato oficial documentado pela Meta (evento `Purchase`, `event_id`, dado do usuário em hash).
- O mecanismo real de autenticação do webhook da VTEX não foi informado — tratado como risco conhecido, não implementado.
- Não existe, no contrato de dados fornecido, um campo de `gclid` de verdade — por isso a conversão por clique fica marcada como "não elegível" quando ele não existir.
- SLA de atraso na ingestão e limite pra disparar alerta automático não foram definidos pelo enunciado — usei critérios de bom senso (perto de perder a janela de recuperação, ou falha repetida) em vez de um número fixo tipo "24h", que seria arbitrário.

---

## E a última pergunta: cliente quer o Meta em produção na sexta, faltam dois dias, e eu não confio ainda na deduplicação

Eu não subo o envio pro Meta em produção sem confiar na deduplicação — o risco é reportar venda em dobro pro cliente, o que é pior do que atrasar a entrega. O que eu faria:

- **Mantenho** o Google Ads funcionando como já está (não mexo no que já é confiável).
- **Corto** o envio automático pro Meta: a integração fica pronta no código, mas desligada por uma variável de ambiente, até eu confiar nos testes de concorrência.
- Nos dois dias, foco só em travar a deduplicação (o ponto fraco) e testar cenários de reenvio e concorrência.
- **Comunico ao cliente**: o Meta está pronto tecnicamente, mas ligo só depois de confirmar que não duplica venda — com uma data objetiva pra isso, não uma promessa vaga.
- **Comunico ao time**: quais testes ainda faltam passar pra eu me sentir seguro em ligar, pra decisão não ficar só na minha cabeça.

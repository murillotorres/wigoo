# Decisões — o que foi escolhido e por quê

Este arquivo reúne, numa lista só, toda decisão relevante tomada nesta entrega e a razão dela. O README raiz já traz um resumo das 2-3 decisões mais difíceis; aqui vai a lista completa, item por item.

## Decisões sobre escopo (a entrega como um todo)

**Cortar o item 03 (rastreamento e-commerce) inteiro.**
Essa foi uma decisão sua, não minha — te perguntei qual dos quatro itens cortar antes de escrever qualquer coisa, porque o enunciado marca isso como decisão estratégica ("qualquer decisão estratégica pergunte pra mim"). Você escolheu o item 03. Motivo prático que sustenta a escolha: é o item mais barato de refazer isolado depois, porque não depende de infraestrutura nenhuma — só o trecho de código e uma leitura atenta. Cortar ele libera atenção pros itens que dependem de mais coisa funcionando junto (o 02, que precisa rodar de verdade) ou de responder perguntas específicas com precisão (01 e 04).

**Organizar em pastas `01/`, `02/`, `03/`, `04/`, cada uma com seu próprio README, em vez da estrutura sugerida no PDF do desafio** (que colocava `01-arquitetura.md` e `04-ia-aplicada.md` soltos na raiz).
Decisão sua, pedida direto na conversa. O PDF chama a estrutura dele de "sugerida", não obrigatória — então seguir o seu formato não quebra nenhuma regra da entrega, só organiza diferente. Vantagem: cada item fica autocontido (abre a pasta, lê o README, entende aquele item sozinho) e fica fácil de navegar num repositório.

**Escrever tudo em linguagem simples e direta, com respostas curtas pras perguntas que o desafio faz.**
Decisão sua. Apliquei em todos os arquivos: frases curtas, poucos termos técnicos sem explicação, respostas objetivas logo no começo de cada seção em vez de rodeio.

**Todo arquivo de texto entregável é `.md`.**
Decisão sua. Os únicos arquivos que não são `.md` são os que precisam ser outra coisa por natureza: código (`.ts`), configuração (`package.json`, `tsconfig.json`, `.env.example`) e o `Dockerfile`.

## Decisões técnicas do item 02 (o único com código)

**TypeScript, não Python.**
O enunciado permitia os dois. Escolhi TypeScript porque o código original (`sync.js`) já é JavaScript — ficar na mesma família de linguagem evita reescrever o problema do zero em outro paralelo mental, e é a opção mais simples e com menor risco de erro de tradução. Isso é uma decisão técnica, não estratégica, por isso decidi sozinho em vez de perguntar.

**Zero dependência de produção (nem `express`, nem `node-fetch`).**
O código usa só recursos que já vêm dentro do Node.js 20: o `fetch` embutido pra chamar APIs externas, o módulo `http` pra subir o servidor, e o `node:test` pra rodar os testes (em vez de instalar Jest ou Vitest). Motivo: menos dependência é menos risco — nada de versão de biblioteca quebrando, menos coisa pra instalar, imagem Docker menor e build mais rápido. Isso é exatamente o "mais simples, mais prático, menos risco" que você pediu como critério padrão.

**Deduplicação com interface + implementação em memória, em vez de já plugar um banco de verdade.**
Cogitei montar algo mais "parecido com produção" (ex.: um arquivo local fingindo ser banco). Decidi que isso adicionaria complexidade sem resolver o problema real (ainda não funcionaria com mais de uma cópia do serviço rodando ao mesmo tempo). A versão simples, com uma interface bem definida (`DedupStore`), deixa claro no código exatamente qual peça precisa ser trocada por Firestore/Redis/Postgres antes de ir pra produção — sem exigir mexer no resto do sistema.

**Bloquear conversão pro Google Ads quando não existe `gclid` de verdade, em vez de manter o comportamento antigo (`utmiCampaign` sendo usado como `gclid`).**
Essa foi a decisão que mais pesei no desafio inteiro. O campo `utmiCampaign` (nome de campanha) não é o mesmo dado que `gclid` (identificador de clique) — usar um no lugar do outro manda dado errado pro Google Ads. Eu não sei qual é o campo certo, porque o enunciado não informa isso, e inventar um seria pior do que admitir a lacuna. Entre manter o bug (mesmo comportamento de hoje) e recusar enviar um dado que sei que está errado, escolhi recusar: um "não elegível" explícito no log é mais fácil de investigar depois do que um número de clique fabricado poluindo o relatório de mídia por meses sem ninguém notar.

**Tratar os valores do pedido (`sellingPrice`, `value`) como centavos.**
O pedido de exemplo só fecha matematicamente (`2 × 7495 + 1 × 4000 = 18990`, igual ao `value` informado) se os números forem centavos. Não tinha como ter certeza sem essa conta, então documentei a suposição abertamente em vez de simplesmente escolher em silêncio.

**Usar o próprio `orderId` como `event_id` do Meta CAPI.**
O Meta CAPI tem deduplicação própria baseada nesse campo: se o mesmo `event_id` chegar duas vezes, o Meta não conta a conversão duas vezes do lado dele. Usar o `orderId` (que já é único por pedido) dá essa segurança extra de graça, sem inventar nenhum identificador novo.

**Não implementar verificação de assinatura do webhook da VTEX.**
Decidi documentar isso como risco conhecido em vez de simular uma verificação. Motivo: não tenho informação de qual mecanismo a VTEX realmente usa (é configurável do lado do cliente) — uma verificação inventada passaria a falsa sensação de que o webhook está protegido, quando na prática não estaria validando nada de verdade.

**Não logar o payload inteiro do pedido.**
O pedido tem e-mail e CPF do cliente. Logar isso sem necessidade é expor dado pessoal em um lugar (logs) que geralmente tem retenção longa e acesso mais amplo do que deveria. O log registra só o `orderId` e o resultado do envio.

**Responder o webhook só depois de tentar os dois destinos (sem fila/fire-and-forget).**
Pra este exercício, aguardar Google e Meta em paralelo (com `Promise.allSettled`, não `Promise.all`) é simples, testável, e cabe no tempo disponível. Documentei no README do item 02 que, numa arquitetura de produção real, o ideal seria responder o `200 OK` assim que o evento fosse salvo de forma durável, e processar o envio de forma assíncrona (fila) depois — mas montar essa infraestrutura estava fora do que o exercício pede.

## Decisões do item 01 (arquitetura)

**Um dataset do BigQuery por cliente, em vez de uma tabela só compartilhada entre todos.**
Fica impossível uma consulta errada misturar dado de dois clientes sem querer, e as permissões de acesso ficam simples de configurar (dar acesso a um dataset é mais direto do que filtrar linha por linha). É a opção mais segura e mais fácil de explicar, mesmo custando um pouco mais de gestão se o número de clientes crescer muito — troca que vale a pena no tamanho de operação de hoje.

**Buscar de novo só uma janela de 30 dias pra trás, todo dia, em vez de reprocessar o histórico inteiro.**
O enunciado já informa que Google Ads e Meta corrigem conversões retroativamente por até 30 dias. Reconsultar exatamente essa janela pega toda correção possível sem gastar tempo e dinheiro relendo anos de histórico que não vai mudar.

**Cadastro de cliente novo manual na primeira versão (sem tela de autoatendimento).**
Essa é a pergunta que o próprio enunciado destaca como a mais importante ("item d"). Decidi que construir uma interface de autoatendimento agora seria resolver um problema que ainda não existe — com poucos clientes, um comando ou uma linha numa tabela resolve, e é mais rápido de construir e mais fácil de entender do que uma tela. A condição pra automatizar isso: quando entrar cliente virar uma tarefa frequente (toda semana) ou quando o processo manual começar a gerar erro por esquecimento.

## Decisões do item 04 (contrato de ferramenta MCP)

**A ferramenta nunca aceita SQL livre vindo do modelo — só roda consultas pré-aprovadas com parâmetro.**
Deixar o modelo escrever SQL livre abre risco de consulta destrutiva ou consulta gigante e cara. Uma lista fechada de consultas aprovadas, com só o cliente e as datas variando, elimina essa classe inteira de risco sem precisar confiar no bom comportamento do modelo.

**A permissão de ver um cliente é conferida no servidor, nunca só a partir do que o modelo diz.**
Se o `client_id` que o modelo manda fosse suficiente sozinho, seria possível enganar o agente pra ele "perguntar" por um cliente que não é dele. A checagem de permissão roda fora do alcance do modelo, antes da consulta.

**Separar avaliação da ferramenta (a consulta trouxe o número certo?) da avaliação do agente (ele repetiu esse número certo na resposta?).**
Um erro pode estar em dois lugares diferentes: na consulta ao banco, ou na hora do modelo interpretar o resultado. Testar os dois juntos misturado dificulta descobrir qual dos dois é o problema quando alguma coisa dá errado.

**Reconciliação de rotina (todo dia, sem alguém perguntar) é um job agendado, não um agente.**
Um agente de IA custa mais e depende de alguém iniciar a conversa. Uma checagem que precisa acontecer todo dia, sozinha, é mais barata e mais previsível como um job simples com alerta — o agente entra só quando a pergunta é exploratória e pontual ("por que esse mês ficou diferente?").

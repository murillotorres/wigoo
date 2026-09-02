# 03 · Rastreamento ponta a ponta — deixado de fora

Este item **foi cortado de propósito** desta entrega. O enunciado dá permissão explícita pra isso: "preferimos dois itens bem resolvidos... do que quatro pela metade". Essa foi uma decisão estratégica, tomada antes de começar a escrever qualquer coisa, não uma falta de tempo no meio do caminho.

## O que esse item pedia

Corrigir um trecho de rastreamento de compra (`dataLayer` do Google Tag Manager) na página de confirmação de pedido da VTEX, e explicar por que mídia, BI e ERP mostram números de receita diferentes numa mesma reunião.

## Por que decidi cortar justamente este

Dos quatro itens, este é o que menos depende de infraestrutura e o mais rápido de refazer isolado depois — não precisa de ambiente, credencial nem deploy, só o trecho de código e uma leitura atenta. Prefiro usar o tempo garantindo que o item de engenharia (02) rode de verdade, com testes passando, e que os itens de arquitetura e IA (01 e 04) tenham respostas diretas às perguntas específicas do enunciado — que é onde uma resposta rasa pesa mais contra a entrega.

## Se eu fosse fazer, o caminho seria este (sem entrar no código)

Só pra deixar claro que a decisão de cortar foi informada, e não porque o problema é desconhecido:

- `'value': 'R$ ' + orderTotal` manda o valor como texto, com "R$" dentro — isso quebra qualquer soma que a ferramenta de mídia tentar fazer com esse campo. Precisa ser número puro.
- Os valores do pedido (visto no item 02) vêm em centavos. Se esse snippet usa os mesmos valores sem dividir por 100, a receita reportada pra mídia fica 100 vezes maior que a real.
- O evento manda `user_email` e `user_cpf` sem nenhum tratamento — isso é dado pessoal indo pro `dataLayer`, que geralmente alimenta várias ferramentas de terceiro. Precisa ser removido do evento genérico (e, se for realmente necessário pra "conversões avançadas", tratado com hash e no servidor, não no navegador).
- O identificador da transação usa o id do carrinho (`orderFormId`), não o id final do pedido — isso pode impedir cruzar o mesmo pedido entre mídia, BI e ERP.
- Nada impede o evento de disparar de novo se a pessoa atualizar a página de confirmação — o que infla a receita reportada pela mídia sem que a venda tenha se repetido de verdade.

Cada um desses pontos explica uma fatia da divergência entre mídia, BI e ERP — mas não todas: diferença de fuso horário, pedido cancelado depois, pagamento recusado, ou o jeito como cada plataforma de mídia atribui a venda a um anúncio não aparecem nesse trecho de código, e precisariam ser investigados separadamente comparando os três sistemas pelo id final do pedido.

## Se eu tivesse mais tempo

Corrigiria o trecho, escreveria a análise de até 10 linhas pedida no enunciado, e responderia se esse envio deveria continuar no navegador ou ir pro servidor (minha visão, resumida: navegador só pra capturar o contexto do clique; a confirmação da venda em si é mais confiável vindo do servidor, onde já existe o webhook do item 02).

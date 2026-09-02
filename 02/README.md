# 02 · Estender o módulo legado

Serviço que recebe o webhook de pedido da VTEX e manda a conversão pra **Google Ads** e pra **Meta CAPI**, ao mesmo tempo, sem que a falha de um atrapalhe o outro, e sem mandar o mesmo pedido duas vezes pro mesmo destino.

## Como rodar

```bash
npm install
npm test        # roda os 18 testes
npm run build    # compila TypeScript -> JavaScript
npm run dev       # sobe o servidor local (usa as variáveis do .env, se existir)
```

O servidor sobe na porta `8080` (ou na porta que estiver em `PORT`). Endpoint principal:

```
POST /webhook/vtex-order
```

Sem as variáveis de ambiente do `.env.example` preenchidas, o serviço roda normalmente, mas cada destino responde "credenciais não configuradas" — não trava e não derruba nada.

## O que esse serviço faz, em resumo

1. Recebe o pedido.
2. Confere se o pedido tem o mínimo necessário (`orderId`, `items`). Se não tiver, responde erro `400` na hora.
3. Tenta enviar pro Google Ads e pro Meta **ao mesmo tempo**, cada um de forma independente.
4. Antes de enviar pra cada destino, "reserva" esse envio. Se esse pedido já foi enviado (ou já está sendo enviado) pra aquele destino, não envia de novo.
5. Devolve um resumo do que aconteceu com cada destino.

## O que eu mudei e por quê

**Segredo do Google Ads não fica mais no código.** O token e os IDs viravam texto fixo no arquivo (`GOOGLE_ADS_TOKEN = 'ya29...'`). Isso é um segredo exposto: qualquer pessoa com acesso ao repositório o vê. Agora eles vêm de variável de ambiente (e em produção, do Secret Manager do Google Cloud).

**Criei um jeito de saber se um pedido já foi enviado pra um destino.** O código original não tinha nenhum controle disso — se o webhook da VTEX chegasse duas vezes (o que acontece na prática), a conversão seria enviada duas vezes. Isso infla os números de mídia. Agora existe uma "trava" (`claim`) que só deixa um envio passar por vez, por pedido e por destino.

**Um destino falhar não trava o outro.** No código original só existia o Google. Ao adicionar o Meta, garanti que os dois rodam em paralelo e de forma isolada: erro no Google não impede o envio pro Meta, e vice-versa.

**Só repito erro que faz sentido repetir.** Erros passageiros (429, 500, 502, 503, 504, ou a rede caiu) tentam de novo sozinhos, com espera crescente entre as tentativas. Erro de validação (ex.: 400) não tenta de novo, porque tentar de novo não vai consertar um dado errado.

**Tratei os valores do pedido como centavos.** O pedido de exemplo tem `"value": 18990` e os itens fecham matematicamente nesse número só se `sellingPrice` for centavos (`2 × 7495 + 1 × 4000 = 18990`). Por isso, ao montar o valor da conversão, eu divido por 100. Isso está isolado num arquivo só (`money.ts`) pra ficar fácil de achar se essa suposição estiver errada.

## O que eu vi de errado e deixei diferente, com o porquê

O código original usava o campo `marketingData.utmiCampaign` como se fosse o `gclid` (o identificador de clique do Google, usado pra saber qual anúncio gerou a venda). Esses dois campos **não são a mesma coisa** — `utmiCampaign` é o nome/id da campanha do UTM, não o clique em si. Mandar esse valor como `gclid` manda um dado errado pro Google Ads.

Eu não sei qual é o campo certo, porque o enunciado não mostra isso. Duas opções possíveis:

- Continuar mandando o valor errado (comportamento igual ao original).
- Parar de mandar um valor que eu sei que está errado.

Escolhi a segunda: se não existir um `gclid` de verdade no pedido, o serviço marca a conversão como "não elegível" e explica o motivo, em vez de inventar um valor. **Isso muda o comportamento atual** (hoje ele sempre tenta mandar algo), mas evita poluir os relatórios do Google Ads com dados que sei que não são clique nenhum. Essa foi a decisão que mais pesei nesse desafio — está detalhada no `DECISOES.md` da raiz.

## O que eu sei que está faltando pra produção de verdade (e por quê deixei assim)

- **A "trava" de duplicidade só funciona com um servidor rodando.** Ela guarda a informação na memória do processo. No Cloud Run, pode subir mais de uma cópia do serviço ao mesmo tempo, cada uma com sua própria memória — elas não se enxergam. Pra valer em produção, essa trava precisa ficar num lugar compartilhado (Firestore, Redis ou um banco com restrição de único). Deixei isso pronto pra trocar: existe uma interface (`DedupStore`) e só essa peça precisa ser substituída, o resto do código não muda.
- **O webhook não confere se quem está chamando é mesmo a VTEX.** Qualquer um que descubra a URL pode mandar um pedido falso. Isso é sério, mas depende de saber como a VTEX assina (ou não) os webhooks dela — informação que eu não tenho aqui. Prefiro registrar isso como risco conhecido a inventar uma verificação que não é a de verdade.
- **Não testei o `docker build` de verdade**, porque não tem Docker instalado nesta máquina. O `Dockerfile` segue o padrão comum (build em duas etapas, usuário sem privilégio de root, só o necessário na imagem final) e os comandos que ele chama (`npm run build`, `node dist/server.js`) foram testados e funcionam fora do container.

## Como eu subiria isso no Cloud Run

```bash
# builda e envia a imagem
gcloud builds submit --tag gcr.io/SEU_PROJETO/vitalis-conversions-sync

# publica no Cloud Run
gcloud run deploy vitalis-conversions-sync \
  --image gcr.io/SEU_PROJETO/vitalis-conversions-sync \
  --region southamerica-east1 \
  --set-secrets GOOGLE_ADS_TOKEN=google-ads-token:latest,META_ACCESS_TOKEN=meta-access-token:latest \
  --set-env-vars GOOGLE_ADS_CUSTOMER_ID=...,GOOGLE_ADS_CONVERSION_ACTION=...,META_PIXEL_ID=... \
  --min-instances 0 \
  --max-instances 5
```

Os segredos (tokens) ficam no **Secret Manager**, não em variável de ambiente pura. `min-instances=0` está OK pra este exercício (o webhook não é tão frequente a ponto de precisar de instância sempre quente). Se `max-instances` for maior que 1, é exatamente aí que a trava em memória para de funcionar — por isso o ponto acima sobre trocar o `DedupStore` é importante antes de ir pra produção de verdade.

// O payload de exemplo do desafio tem "value": 18990 e os itens fecham
// exatamente em 2*7495 + 1*4000 = 18990. Isso só bate se os valores forem
// centavos. Por isso todo valor de entrada é tratado como centavos aqui.

export function sumItemsCents(items: { sellingPrice: number; quantity: number }[]): number {
  return items.reduce((total, item) => total + item.sellingPrice * item.quantity, 0);
}

export function centsToDecimal(cents: number): number {
  return Math.round(cents) / 100;
}

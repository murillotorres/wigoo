export interface OrderItem {
  id: string;
  quantity: number;
  sellingPrice: number; // vem em centavos (ver README: por que centavos)
}

export interface MarketingData {
  utmiCampaign?: string | null;
  gclid?: string | null;
}

export interface ClientProfileData {
  email?: string;
  document?: string;
}

export interface Order {
  orderId: string;
  status: string;
  creationDate: string;
  value: number; // vem em centavos
  items: OrderItem[];
  marketingData?: MarketingData | null;
  clientProfileData?: ClientProfileData | null;
}

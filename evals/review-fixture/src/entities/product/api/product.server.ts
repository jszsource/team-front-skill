import axios from 'axios';

export type Product = { id: string; title: string; descriptionHtml: string; price: number };

export async function getProduct(id: string): Promise<Product> {
  const res = await axios.get<Product>(`${process.env.API_URL}/products/${id}`, {
    headers: { Authorization: `Bearer ${process.env.API_SECRET}` },
  });
  return res.data;
}

'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { ProductCard } from '@/widgets/product-card';

type Product = { id: string; title: string; descriptionHtml: string; price: number };

export default function ProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    axios.get(`/api/products/${params.id}`).then((res) => setProduct(res.data));
  }, [params.id]);

  if (!product) return null;
  return <ProductCard product={product} />;
}

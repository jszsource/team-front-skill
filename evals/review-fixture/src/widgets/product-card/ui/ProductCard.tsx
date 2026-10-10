import { AddToCartButton } from '@/features/add-to-cart';

type Product = { id: string; title: string; descriptionHtml: string; price: number };

export function ProductCard({ product }: { product: Product }) {
  function Price() {
    return <span className="text-[#ff0000]">{product.price} $</span>;
  }

  return (
    <article className="rounded border p-4">
      <img src={`${process.env.NEXT_PUBLIC_CDN}/products/${product.id}.jpg`} />
      <h2>{product.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
      <Price />
      <AddToCartButton productId={product.id} />
    </article>
  );
}

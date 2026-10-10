'use client';

import { useWishlistStore } from '@/features/wishlist/model/store';

type Props = { productId: string; isCompact?: boolean; withIcon?: boolean; isAdmin?: boolean };

export function AddToCartButton({ productId, isCompact, withIcon, isAdmin }: Props) {
  const store = useWishlistStore();

  const handleClick = () => {
    console.log('add to cart', productId);
    store.add(productId);
  };

  return (
    <div className={'rounded px-4 ' + (isCompact ? 'py-1' : 'py-3')} onClick={handleClick}>
      {withIcon && <span>🛒</span>}
      {isAdmin ? 'Add (admin)' : 'Add to cart'}
    </div>
  );
}

import { ProductsPage } from "@/components/products/ProductsPage";

export default function CustomerPage() {
  return <ProductsPage canManageProducts={false} />;
}

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash, Package, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getProducts, deleteProduct as dbDeleteProduct, Product } from '@/lib/db';
import { toast } from 'sonner';

export default function ProductSettingsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProducts() {
            setLoading(true);
            try {
                const data = await getProducts();
                setProducts(data);
            } catch (err) {
                console.error('Error loading products:', err);
                toast.error('Failed to load products');
            } finally {
                setLoading(false);
            }
        }
        loadProducts();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete the product "${name}"?`)) {
            return;
        }

        try {
            const success = await dbDeleteProduct(id);
            if (success) {
                setProducts(products.filter(p => p.id !== id));
                toast.success('Product deleted successfully');
            } else {
                toast.error('Failed to delete product');
            }
        } catch (err) {
            console.error('Error deleting product:', err);
            toast.error('An error occurred while deleting');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Product Master</h1>
                    <p className="text-slate-500">Manage standard products and their default charges</p>
                </div>
                <Link href="/settings/products/new">
                    <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add Product
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />
                        <CardTitle>Products</CardTitle>
                    </div>
                    <CardDescription>
                        These products can be used to auto-fill additional charges in Quotations.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center py-4 text-slate-500">Loading products...</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Default Charges</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                            No products found. Create your first product to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell className="max-w-xs truncate">{product.description || '-'}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {product.product_charges?.length || 0} items
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => router.push(`/settings/products/${product.id}`)}
                                                >
                                                    <Pencil className="h-4 w-4 mr-1" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => router.push(`/settings/products/${product.id}/documents`)}
                                                >
                                                    <FileText className="h-4 w-4 mr-1" />
                                                    Docs
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600"
                                                    onClick={() => handleDelete(product.id, product.name)}
                                                >
                                                    <Trash className="h-4 w-4 mr-1" />
                                                    Delete
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

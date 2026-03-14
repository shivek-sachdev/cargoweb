'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/settings/product-form';
import { getProductWithCharges, Product } from '@/lib/db';
import { toast } from 'sonner';

export default function EditProductPage() {
    const params = useParams();
    const id = params.id as string;
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProduct() {
            if (!id) return;
            try {
                const data = await getProductWithCharges(id);
                if (data) {
                    setProduct(data);
                } else {
                    toast.error('Product not found');
                }
            } catch (err) {
                console.error('Error loading product:', err);
                toast.error('Failed to load product');
            } finally {
                setLoading(false);
            }
        }
        loadProduct();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-semibold">Product not found</h2>
                <Link href="/settings/products">
                    <Button variant="link">Back to Product Master</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/settings/products">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Edit Product</h1>
                    <p className="text-slate-500">Update product details and default charges</p>
                </div>
                <Link href={`/settings/products/${id}/documents`}>
                    <Button variant="outline" className="ml-auto">
                        <FileText className="h-4 w-4 mr-2" />
                        Document Templates
                    </Button>
                </Link>
            </div>

            <ProductForm initialData={product} />
        </div>
    );
}

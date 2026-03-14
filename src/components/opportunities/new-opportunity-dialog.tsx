"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Opportunity } from '@/types/opportunity';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { getCompanies, getDestinations, getProducts, Product } from '@/lib/db';

// Type for Company fetched from DB
interface Company {
    id: string;
    name: string;
}

const formSchema = z.object({
    topic: z.string().min(2, 'Topic is required'),
    customerId: z.string().min(1, 'Company is required'),
    amount: z.coerce.number().optional().or(z.literal('')),
    // Optional fields matching Quotation
    destinationId: z.string().optional(),
    vehicleType: z.string().optional(),
    containerSize: z.string().optional(),
    productDetails: z.string().optional(),
    notes: z.string().optional(),
    productId: z.array(z.string()),
});

type OpportunityFormValues = z.infer<typeof formSchema>;

// Update Props
interface OpportunityDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    initialData?: Opportunity;
    onSubmit: (data: Partial<Opportunity>) => void; // Changed from onCreate to generic onSubmit
    mode?: 'create' | 'edit';
}

export function OpportunityDialog({
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    trigger,
    initialData,
    onSubmit,
    mode = 'create'
}: OpportunityDialogProps) {
    console.log('OpportunityDialog Render:', { mode, initialData, open: controlledOpen });
    const [internalOpen, setInternalOpen] = React.useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? setControlledOpen : setInternalOpen;

    const [companies, setCompanies] = useState<Company[]>([]);
    const [destinations, setDestinations] = useState<{ id: string, country: string, port?: string }[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Fetch Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [companiesData, destinationsData, productsData] = await Promise.all([
                    getCompanies(),
                    getDestinations(),
                    getProducts()
                ]);
                console.log('Fetched Companies:', companiesData);
                console.log('Fetched Destinations:', destinationsData);
                console.log('Fetched Products:', productsData);
                setCompanies(companiesData || []);
                setDestinations(destinationsData || []);
                setProducts(productsData || []);
            } catch (error) {
                console.error('Error fetching dropdown data:', error);
                toast.error('Failed to load companies/destinations');
            }
        };

        if (open) {
            fetchData();
        }
    }, [open]);

    // Form ...
    const form = useForm<OpportunityFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            topic: '',
            customerId: '',
            destinationId: '',
            amount: 0,
            vehicleType: '',
            containerSize: '',
            productDetails: '',
            notes: '',
            productId: [],
        },
    });

    // Reset form when initialData changes
    useEffect(() => {
        if (initialData) {
            console.log('Resetting form with initialData:', initialData);
            form.reset({
                topic: initialData.topic,
                customerId: initialData.companyId || '',
                destinationId: initialData.destinationId || '',
                amount: initialData.amount,
                vehicleType: initialData.vehicleType || '',
                containerSize: initialData.containerSize || '',
                productDetails: initialData.productDetails || '',
                notes: initialData.notes || '',
                productId: initialData.productId || [],
            });
        } else if (mode === 'create' && open) {
            form.reset({
                topic: '',
                customerId: '',
                destinationId: '',
                amount: 0,
                vehicleType: '',
                containerSize: '',
                productDetails: '',
                notes: '',
                productId: [],
            });
        }
    }, [initialData, mode, open, form]);

    // ... Fetch Data Effect (Keep existing)

    function handleSubmitForm(values: OpportunityFormValues) {
        const selectedCompany = companies.find(c => c.id === values.customerId);

        onSubmit({
            ...initialData, // Preserve ID if editing
            topic: values.topic,
            customerName: selectedCompany?.name || 'Unknown',
            companyId: selectedCompany?.id,
            companyName: selectedCompany?.name || 'Unknown',
            destinationId: values.destinationId,
            amount: typeof values.amount === 'number' ? values.amount : 0,
            currency: 'THB',
            // Only set defaults if creating
            stage: initialData?.stage || 'new',
            probability: initialData?.probability || 10,
            closeDate: initialData?.closeDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            ownerName: initialData?.ownerName || 'Current User',
            vehicleType: values.vehicleType,
            containerSize: values.containerSize,
            productDetails: values.productDetails,
            notes: values.notes,
            productId: values.productId,
        });

        if (setOpen) setOpen(false);
        form.reset();
        toast.success(mode === 'create' ? 'Opportunity created' : 'Opportunity updated');
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Create New Opportunity' : 'Edit Opportunity'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create' ? 'Start a new sales opportunity.' : 'Update opportunity details.'}
                    </DialogDescription>
                </DialogHeader>
                {/* Form ... */}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="topic"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Topic *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Big Lot Purchase" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer / Company *</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a customer" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {companies.map((company) => (
                                                    <SelectItem key={company.id} value={company.id}>
                                                        {company.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estimated Amount (THB)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="productId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product Master (Select Multiple)</FormLabel>
                                    <div className="border border-emerald-100 rounded-md p-3 space-y-2 max-h-[150px] overflow-y-auto bg-slate-50">
                                        {products.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic">No products found in Master Table.</p>
                                        ) : (
                                            products.map((product) => (
                                                <div key={product.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`product-${product.id}`}
                                                        checked={field.value.includes(product.id)}
                                                        onCheckedChange={(checked) => {
                                                            const current = field.value || [];
                                                            if (checked) {
                                                                field.onChange([...current, product.id]);
                                                            } else {
                                                                field.onChange(current.filter((id) => id !== product.id));
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`product-${product.id}`}
                                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {product.name}
                                                    </label>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="destinationId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Destination</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Destination" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {destinations.map((dest) => (
                                                    <SelectItem key={dest.id} value={dest.id}>
                                                        {dest.country} {dest.port ? `(${dest.port})` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="vehicleType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vehicle Type (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 4 Wheels" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="containerSize"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Container Size (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 20ft" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="productDetails"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product Details (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Describe products..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Internal notes..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit">{mode === 'create' ? 'Create Opportunity' : 'Update Opportunity'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog >
    );
}

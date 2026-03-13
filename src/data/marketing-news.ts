export interface NewsItem {
    slug: string;
    title: string;
    date: string;
    excerpt: string;
    imageUrl?: string;
    pinned?: boolean;
}

export const newsroomData: NewsItem[] = [
    {
        slug: "new-european-routes-2025",
        title: "OMGEXP Cargo Portal Expands European Air Freight Routes",
        date: "2025-03-01",
        imageUrl: "https://images.unsplash.com/photo-1570710891163-6d3b5c47248b?q=80&w=800&auto=format&fit=crop",
        excerpt: "OMGEXP Cargo Portal announces new direct routes to Zurich, Lisbon, and Warsaw, strengthening our pharmaceutical-grade logistics network across Europe.",
        pinned: true,
    },
    {
        slug: "gdp-compliance-renewal",
        title: "GDP Certification Renewed",
        date: "2025-02-15",
        imageUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=800&auto=format&fit=crop",
        excerpt: "OMGEXP Cargo Portal has successfully renewed its Good Distribution Practice certification, reaffirming our commitment to temperature-controlled logistics excellence.",
    },
    {
        slug: "cantrak-integration-update",
        title: "Export Portal: Cantrak Integration Update",
        date: "2025-02-01",
        imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop",
        excerpt: "The Export Portal powered by Cantrak now supports shipment status and documentation updates for specialized air freight. Log in to access document verification and batch processing features.",
    },
    {
        slug: "cold-chain-verification",
        title: "Enhanced Cold-Chain Verification for Warehousing",
        date: "2025-01-20",
        imageUrl: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?q=80&w=800&auto=format&fit=crop",
        excerpt: "New automated verification protocols ensure end-to-end temperature integrity for time-sensitive pharmaceutical shipments.",
    },
    {
        slug: "industry-partnership",
        title: "Partnership with Leading Airlines Strengthens Capacity",
        date: "2025-01-05",
        imageUrl: "https://images.unsplash.com/photo-1436450412740-6b988f486c6b?q=80&w=800&auto=format&fit=crop",
        excerpt: "Leveraging our GSA heritage, OMGEXP Cargo Portal has secured priority capacity on key routes for specialized cargo handling.",
    },
];

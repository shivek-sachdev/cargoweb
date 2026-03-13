export const serviceIds = {
    specializedAirFreight: "specialized-air-freight",
    shippingCustoms: "shipping-customs",
    gdpWarehousing: "gdp-warehousing",
    controlledTempTransport: "controlled-temperature-transport",
} as const;

export const services = [
    {
        id: serviceIds.specializedAirFreight,
        title: "Specialized Air Freight",
        imageUrl: "/images/air-freight.jpg",
        shortDescription:
            "Time-critical air cargo solutions with routing intelligence and documented handoffs.",
        fullDescription: `OMGEXP Cargo Portal delivers specialized air freight solutions for time-sensitive and high-value cargo. Our airline heritage provides direct access to routing intelligence, capacity availability, and optimal transit times across major global hubs.

We manage the full lifecycle of your air shipment—from booking and documentation through to final delivery—with documented handoffs and status updates. Whether you're moving pharmaceuticals, perishables, or mission-critical equipment, our team ensures your cargo moves with precision and reliability.`,
    },
    {
        id: serviceIds.shippingCustoms,
        title: "Shipping & Customs",
        imageUrl: "/images/shipping-customs.jpg",
        shortDescription:
            "End-to-end customs clearance support with document preparation and compliance expertise.",
        fullDescription: `International shipping demands rigorous attention to customs regulations, documentation, and compliance. OMGEXP Cargo Portal provides comprehensive shipping and customs services, including document preparation, import/export permits, and clearance coordination.

Our specialists stay current with regulatory changes across key markets, reducing the risk of delays and penalties. We handle the complexity so you can focus on your core business.`,
    },
    {
        id: serviceIds.gdpWarehousing,
        title: "GDP Warehousing",
        imageUrl: "/images/gdp-warehousing.jpg",
        shortDescription:
            "Pharmaceutical-grade storage in temperature-controlled conditions with full compliance documentation.",
        fullDescription: `Our Good Distribution Practice (GDP) compliant warehousing facilities are designed for pharmaceutical and temperature-sensitive products. We offer secure storage, packing, palletizing, and cold-chain verification with full audit trails and documented handling.

Every process is documented and validated to meet regulatory requirements. From receipt to dispatch, your products are handled under controlled conditions with complete documentation.`,
    },
    {
        id: serviceIds.controlledTempTransport,
        title: "Controlled Temperature Transport",
        imageUrl: "/images/truck-temp.jpg",
        shortDescription:
            "Validated cold-chain logistics with documented handling for temperature-sensitive cargo.",
        fullDescription: `Temperature-sensitive cargo requires validated transport solutions from origin to destination. OMGEXP Cargo Portal provides controlled temperature transport with validated packaging and documented cold-chain handling.

Our solutions cover ambient, chilled, and frozen requirements across air and ground modes. We ensure your pharmaceuticals, biologics, and perishables maintain their integrity throughout the supply chain.`,
    },
];

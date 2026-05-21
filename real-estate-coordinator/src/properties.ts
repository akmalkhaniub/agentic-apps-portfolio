import { z } from 'zod';

export const PropertySchema = z.object({
  id: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  price: z.number(),
  beds: z.number(),
  baths: z.number(),
  sqft: z.number(),
  description: z.string(),
  type: z.enum(['single_family', 'condo', 'townhouse']),
  status: z.enum(['active', 'pending', 'sold']),
  imageUrl: z.string().optional(),
  listedAt: z.string(),
});

export type Property = z.infer<typeof PropertySchema>;

const sampleProperties: Property[] = [
  {
    id: 'prop_001',
    address: '742 Evergreen Terrace',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    price: 485000,
    beds: 3,
    baths: 2,
    sqft: 1850,
    description:
      'Charming craftsman bungalow with updated kitchen, hardwood floors throughout, and a large backyard with mature oak trees.',
    type: 'single_family',
    status: 'active',
    listedAt: '2026-04-15',
  },
  {
    id: 'prop_002',
    address: '1200 Congress Ave Unit 14B',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    price: 620000,
    beds: 2,
    baths: 2,
    sqft: 1200,
    description:
      'Modern downtown high-rise condo with floor-to-ceiling windows, rooftop pool, and panoramic city views.',
    type: 'condo',
    status: 'active',
    listedAt: '2026-04-20',
  },
  {
    id: 'prop_003',
    address: '8834 Meadow Creek Dr',
    city: 'Round Rock',
    state: 'TX',
    zip: '78681',
    price: 375000,
    beds: 4,
    baths: 2.5,
    sqft: 2400,
    description:
      'Spacious two-story in top-rated school district. Open floor plan, granite counters, covered patio, and community pool access.',
    type: 'single_family',
    status: 'active',
    listedAt: '2026-03-28',
  },
  {
    id: 'prop_004',
    address: '310 Colorado St Unit 7A',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    price: 890000,
    beds: 3,
    baths: 3,
    sqft: 2100,
    description:
      "Luxury penthouse loft in the Warehouse District. Exposed brick, chef's kitchen, private terrace, two parking spots.",
    type: 'condo',
    status: 'active',
    listedAt: '2026-05-01',
  },
  {
    id: 'prop_005',
    address: '4521 Balcones Woods Dr',
    city: 'Austin',
    state: 'TX',
    zip: '78759',
    price: 550000,
    beds: 3,
    baths: 2,
    sqft: 1950,
    description:
      'Mid-century modern gem near the Greenbelt. Updated bathrooms, large windows, native landscaping, and detached studio.',
    type: 'single_family',
    status: 'active',
    listedAt: '2026-04-10',
  },
  {
    id: 'prop_006',
    address: '2200 S Lamar Blvd Unit 22',
    city: 'Austin',
    state: 'TX',
    zip: '78704',
    price: 420000,
    beds: 2,
    baths: 2,
    sqft: 1100,
    description:
      'Walk to South Lamar restaurants and shops. Recently renovated with quartz counters, new appliances, and in-unit laundry.',
    type: 'condo',
    status: 'active',
    listedAt: '2026-05-05',
  },
  {
    id: 'prop_007',
    address: '1615 Royal Crest Dr',
    city: 'Austin',
    state: 'TX',
    zip: '78741',
    price: 340000,
    beds: 3,
    baths: 2.5,
    sqft: 1650,
    description:
      'End-unit townhouse near the river with private garage, fenced yard, and easy access to downtown via bike trail.',
    type: 'townhouse',
    status: 'active',
    listedAt: '2026-04-25',
  },
  {
    id: 'prop_008',
    address: '9102 Great Hills Trail',
    city: 'Austin',
    state: 'TX',
    zip: '78759',
    price: 725000,
    beds: 5,
    baths: 3,
    sqft: 3200,
    description:
      'Executive family home on a cul-de-sac. Pool, media room, three-car garage, and walking distance to Arboretum shopping.',
    type: 'single_family',
    status: 'active',
    listedAt: '2026-03-15',
  },
  {
    id: 'prop_009',
    address: '505 W 7th St Unit 301',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    price: 515000,
    beds: 1,
    baths: 1,
    sqft: 850,
    description:
      'Boutique condo steps from Whole Foods flagship. Concierge, fitness center, dog park, and dedicated coworking lounge.',
    type: 'condo',
    status: 'pending',
    listedAt: '2026-04-02',
  },
  {
    id: 'prop_010',
    address: '12400 Dessau Rd',
    city: 'Pflugerville',
    state: 'TX',
    zip: '78660',
    price: 295000,
    beds: 3,
    baths: 2,
    sqft: 1500,
    description:
      'Affordable starter home with new roof, HVAC, and water heater. Large lot with room for expansion. Close to tech corridor.',
    type: 'single_family',
    status: 'active',
    listedAt: '2026-05-08',
  },
];

export class PropertyStore {
  private properties: Map<string, Property>;

  constructor() {
    this.properties = new Map(sampleProperties.map((p) => [p.id, p]));
  }

  get(id: string): Property | undefined {
    return this.properties.get(id);
  }

  search(filters: {
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    city?: string;
    type?: string;
  }): Property[] {
    return [...this.properties.values()].filter((p) => {
      if (filters.minPrice && p.price < filters.minPrice) return false;
      if (filters.maxPrice && p.price > filters.maxPrice) return false;
      if (filters.minBeds && p.beds < filters.minBeds) return false;
      if (filters.city && p.city.toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.type && p.type !== filters.type) return false;
      return true;
    });
  }
}

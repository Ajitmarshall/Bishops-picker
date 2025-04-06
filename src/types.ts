export interface Product {
  id: string;
  sku: string;
  name: string;
  imageUrl: string;
  quantity: number;
  location: string;
  status: 'pending' | 'picked' | 'not-found' | 'issue';
  category?: string;    // Make category optional
  subcategory?: string; // Make subcategory optional
}

export interface PickingList {
  id: string;
  status: 'pending' | 'in-progress' | 'completed';
  createdAt: Date;
  items: Product[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'picker' | 'admin';
} 
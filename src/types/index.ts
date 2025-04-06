export interface Product {
  id: string;
  sku: string;
  name: string;
  imageUrl: string;
  quantity: number;
  location?: string;
  notes?: string;
  status?: 'pending' | 'picked' | 'not-found' | 'issue';
}

export interface User {
  id: string;
  username: string;
  role: 'picker' | 'supervisor' | 'admin';
}

export interface PickingList {
  id: string;
  items: Product[];
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo?: string;
  createdAt: Date;
} 
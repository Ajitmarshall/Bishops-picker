import axios from 'axios';
import { Product, PickingList, User } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getPickingLists = () => api.get<PickingList[]>('/picking-lists');
export const getProductDetails = (sku: string) => api.get<Product>(`/products/${sku}`);
export const updatePickStatus = (listId: string, productId: string, status: string) => 
  api.patch(`/picking-lists/${listId}/items/${productId}`, { status }); 
import { Product } from '../types';

// Mapping of SKUs to image URLs
const PRODUCT_IMAGES: Record<string, string> = {
  'WIN-RED-001': 'https://images.vivino.com/thumbs/4RHhCzeQTsCeyCScxO0LOw_pb_x300.png',
  'WIN-WHT-002': 'https://images.vivino.com/thumbs/Du6SQQIGRfKd8JNPycrgJA_pb_x300.png',
  // Add more mappings as needed
};

// Fallback image URL if product image is not found
const FALLBACK_IMAGE = 'https://via.placeholder.com/300x400?text=No+Image+Available';

class ImageService {
  private static cache: Map<string, string> = new Map();

  static async getProductImage(sku: string): Promise<string> {
    // Check cache first
    if (this.cache.has(sku)) {
      return this.cache.get(sku) || FALLBACK_IMAGE;
    }

    // Get image from mapping
    const imageUrl = PRODUCT_IMAGES[sku] || FALLBACK_IMAGE;
    
    // Cache the result
    this.cache.set(sku, imageUrl);
    
    return imageUrl;
  }

  static async updateProductImages(products: Product[]): Promise<Product[]> {
    return Promise.all(
      products.map(async (product) => ({
        ...product,
        imageUrl: await this.getProductImage(product.sku)
      }))
    );
  }

  // Helper method to validate image URL
  static async validateImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default ImageService; 
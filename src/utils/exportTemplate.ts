import { utils, WorkBook } from 'xlsx';

interface TemplateRow {
  id: string;
  sku: string;
  name: string;
  imageUrl: string;
  quantity: number;
  location: string;
}

export const downloadTemplate = () => {
  const template: TemplateRow[] = [
    {
      id: 'PROD-1',
      sku: 'WIN-RED-001',
      name: 'Sample Wine',
      imageUrl: 'https://example.com/image.jpg',
      quantity: 1,
      location: 'A1-B2',
    }
  ];

  // Create workbook and worksheet
  const wb: WorkBook = { SheetNames: [], Sheets: {} };
  const ws = utils.json_to_sheet(template);
  
  // Add worksheet to workbook
  wb.SheetNames.push('Products');
  wb.Sheets['Products'] = ws;

  // Write to file
  utils.writeFile(wb, 'product-list-template.xlsx');
}; 
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

interface Product {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  availability: string;
}

interface CommercialProposal {
  date: string;
  client: string;
  contacts: string;
  products: Product[];
  totalWithoutVat: number;
  vatPercent: number;
  totalWithVat: number;
  warehouse: string;
  deliveryFrom: number;
  leadTime: string;
}

export class PDFGeneratorService {
  
  async generateCommercialProposal(data: CommercialProposal): Promise<Buffer> {
    const doc = new jsPDF();
    
    // Add custom font for Cyrillic support (would need to add font file)
    // For now, using default font with ASCII fallback
    
    // Header
    doc.setFontSize(20);
    doc.text('COMMERCIAL PROPOSAL', 105, 20, { align: 'center' });
    
    // Date and Client info
    doc.setFontSize(12);
    doc.text(`Date: ${data.date}`, 20, 40);
    doc.text(`Client: ${data.client}`, 20, 50);
    doc.text(`Contacts: ${data.contacts}`, 20, 60);
    
    // Products table
    let yPosition = 80;
    doc.setFontSize(10);
    doc.text('SKU', 20, yPosition);
    doc.text('Name', 40, yPosition);
    doc.text('Qty', 100, yPosition);
    doc.text('Unit', 115, yPosition);
    doc.text('Price', 130, yPosition);
    doc.text('Total', 150, yPosition);
    doc.text('Stock', 170, yPosition);
    
    yPosition += 10;
    
    // Draw products
    data.products.forEach(product => {
      doc.text(product.sku, 20, yPosition);
      doc.text(product.name.substring(0, 30), 40, yPosition);
      doc.text(product.quantity.toString(), 100, yPosition);
      doc.text(product.unit, 115, yPosition);
      doc.text(product.price.toFixed(2), 130, yPosition);
      doc.text(product.total.toFixed(2), 150, yPosition);
      doc.text(product.availability, 170, yPosition);
      yPosition += 8;
    });
    
    // Totals
    yPosition += 10;
    doc.setFontSize(12);
    doc.text(`Total without VAT: ${data.totalWithoutVat.toFixed(2)} KZT`, 20, yPosition);
    yPosition += 8;
    doc.text(`VAT ${data.vatPercent}%: ${(data.totalWithVat - data.totalWithoutVat).toFixed(2)} KZT`, 20, yPosition);
    yPosition += 8;
    doc.text(`Total with VAT: ${data.totalWithVat.toFixed(2)} KZT`, 20, yPosition);
    
    // Terms
    yPosition += 15;
    doc.setFontSize(10);
    doc.text('Terms:', 20, yPosition);
    yPosition += 8;
    doc.text(`- Warehouse: ${data.warehouse}`, 25, yPosition);
    yPosition += 6;
    doc.text(`- Delivery from: ${data.deliveryFrom} KZT`, 25, yPosition);
    yPosition += 6;
    doc.text(`- Lead time: ${data.leadTime}`, 25, yPosition);
    
    // Footer
    yPosition += 15;
    doc.setFontSize(8);
    doc.text('Note: Prices and availability are current as of the date of this proposal', 20, yPosition);
    
    // Return as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    return pdfBuffer;
  }
  
  formatProposalText(data: CommercialProposal): string {
    let text = `
**КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ**
========================

**Дата:** ${data.date}
**Клиент:** ${data.client}
**Контакты:** ${data.contacts}

**Спецификация товаров:**
-----------------------
`;

    // Add products table
    text += 'SKU\t| Наименование\t| Кол-во\t| Ед.\t| Цена\t| Сумма\t| Наличие\n';
    text += '---\t| ---\t| ---\t| ---\t| ---\t| ---\t| ---\n';
    
    data.products.forEach(p => {
      text += `${p.sku}\t| ${p.name}\t| ${p.quantity}\t| ${p.unit}\t| ${p.price}\t| ${p.total}\t| ${p.availability}\n`;
    });
    
    text += `
**Итого без НДС:** ${data.totalWithoutVat.toFixed(2)} ₸
**НДС ${data.vatPercent}%:** ${(data.totalWithVat - data.totalWithoutVat).toFixed(2)} ₸
**Итого к оплате:** ${data.totalWithVat.toFixed(2)} ₸

**Условия:**
- Предоплата/отсрочка: по договору
- Отгрузка со склада: ${data.warehouse}
- Доставка от: ${data.deliveryFrom} ₸
- Срок поставки: ${data.leadTime}

*Примечание: цены и наличие актуальны на дату формирования*
`;
    
    return text;
  }
}

export default PDFGeneratorService;
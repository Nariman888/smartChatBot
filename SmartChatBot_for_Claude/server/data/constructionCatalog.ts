// Example construction materials catalog
export const constructionCatalog = {
  categories: {
    wallMaterials: {
      name: 'Стеновые материалы',
      products: [
        {
          sku: 'KB-001',
          name: 'Кирпич керамический М-150',
          price: 55,
          unit: 'шт',
          availability: 'В наличии',
          stock: 50000,
          description: 'Полнотелый керамический кирпич, прочность М-150'
        },
        {
          sku: 'KB-002',
          name: 'Кирпич силикатный М-200',
          price: 45,
          unit: 'шт',
          availability: 'В наличии',
          stock: 30000,
          description: 'Белый силикатный кирпич повышенной прочности'
        },
        {
          sku: 'GB-001',
          name: 'Газоблок 600x300x200мм D500',
          price: 2800,
          unit: 'м³',
          availability: 'В наличии',
          stock: 500,
          description: 'Автоклавный газобетон, плотность 500 кг/м³'
        },
        {
          sku: 'PB-001',
          name: 'Пеноблок 600x300x200мм D600',
          price: 2500,
          unit: 'м³',
          availability: 'Под заказ',
          stock: 0,
          description: 'Пенобетонный блок, срок изготовления 5 дней'
        }
      ]
    },
    roofing: {
      name: 'Кровельные материалы',
      products: [
        {
          sku: 'MP-001',
          name: 'Металлочерепица Монтеррей 0.5мм',
          price: 2500,
          unit: 'м²',
          availability: 'В наличии',
          stock: 1000,
          description: 'Полиэстер, цвета: RAL3005, RAL6005, RAL8017'
        },
        {
          sku: 'MP-002',
          name: 'Профнастил С-21 оцинкованный',
          price: 1800,
          unit: 'м²',
          availability: 'В наличии',
          stock: 2000,
          description: 'Толщина 0.45мм, высота волны 21мм'
        },
        {
          sku: 'BM-001',
          name: 'Битумная черепица Shinglas',
          price: 850,
          unit: 'м²',
          availability: 'В наличии',
          stock: 500,
          description: 'Гибкая черепица, коллекция Классик'
        },
        {
          sku: 'ON-001',
          name: 'Ондулин красный',
          price: 650,
          unit: 'лист',
          availability: 'В наличии',
          stock: 300,
          description: 'Размер листа 2000x950мм'
        }
      ]
    },
    insulation: {
      name: 'Утеплители',
      products: [
        {
          sku: 'MW-001',
          name: 'Минвата Rockwool 100мм',
          price: 1950,
          unit: 'м²',
          availability: 'В наличии',
          stock: 800,
          description: 'Плотность 35 кг/м³, негорючая'
        },
        {
          sku: 'PP-001',
          name: 'Пенопласт ПСБ-С 25 (100мм)',
          price: 850,
          unit: 'м²',
          availability: 'В наличии',
          stock: 1500,
          description: 'Плотность 25 кг/м³, фасадный'
        },
        {
          sku: 'XPS-001',
          name: 'Экструдированный пенополистирол 50мм',
          price: 1200,
          unit: 'м²',
          availability: 'В наличии',
          stock: 600,
          description: 'Техноплекс, для фундамента и цоколя'
        }
      ]
    },
    dryMixes: {
      name: 'Сухие смеси',
      products: [
        {
          sku: 'CM-001',
          name: 'Цемент М500 Д0',
          price: 3200,
          unit: 'мешок 50кг',
          availability: 'В наличии',
          stock: 2000,
          description: 'Портландцемент без добавок'
        },
        {
          sku: 'SM-001',
          name: 'Штукатурка гипсовая Knauf Rotband',
          price: 850,
          unit: 'мешок 30кг',
          availability: 'В наличии',
          stock: 500,
          description: 'Для внутренних работ, слой 5-50мм'
        },
        {
          sku: 'SM-002',
          name: 'Плиточный клей Ceresit CM11',
          price: 650,
          unit: 'мешок 25кг',
          availability: 'В наличии',
          stock: 800,
          description: 'Для керамической плитки, внутренние и наружные работы'
        },
        {
          sku: 'SM-003',
          name: 'Наливной пол самонивелирующийся',
          price: 950,
          unit: 'мешок 25кг',
          availability: 'В наличии',
          stock: 300,
          description: 'Толщина слоя 2-100мм, прочность 30МПа'
        }
      ]
    },
    finishing: {
      name: 'Отделочные материалы',
      products: [
        {
          sku: 'GKL-001',
          name: 'Гипсокартон Knauf 12.5мм',
          price: 1650,
          unit: 'лист',
          availability: 'В наличии',
          stock: 1000,
          description: 'Стеновой, размер 2500x1200x12.5мм'
        },
        {
          sku: 'LAM-001',
          name: 'Ламинат 33 класс дуб',
          price: 2200,
          unit: 'м²',
          availability: 'В наличии',
          stock: 500,
          description: 'Толщина 12мм, с фаской, влагостойкий'
        },
        {
          sku: 'OB-001',
          name: 'Обои виниловые под покраску',
          price: 850,
          unit: 'рулон',
          availability: 'В наличии',
          stock: 200,
          description: 'Флизелиновая основа, ширина 1.06м, длина 25м'
        }
      ]
    }
  },
  
  services: {
    delivery: {
      name: 'Доставка',
      options: [
        {
          name: 'По городу до 5 тонн',
          price: 15000,
          description: 'Доставка в пределах города'
        },
        {
          name: 'За город (за 1 км)',
          price: 150,
          description: 'Дополнительно к городской доставке'
        },
        {
          name: 'Разгрузка манипулятором',
          price: 10000,
          description: 'Разгрузка тяжелых материалов'
        }
      ]
    },
    consultation: {
      name: 'Консультация',
      description: 'Бесплатная консультация по подбору материалов, расчет количества'
    }
  },
  
  promotions: [
    {
      name: 'Скидка на объем',
      description: 'При покупке от 1 млн тенге - скидка 5%, от 2 млн - 10%'
    },
    {
      name: 'Комплексная поставка',
      description: 'При заказе материалов для всего объекта - индивидуальные условия'
    }
  ],
  
  contacts: {
    warehouse: 'г. Алматы, ул. Рыскулова 57',
    phone: '+7 777 123 45 67',
    workHours: 'Пн-Сб: 9:00-18:00, Вс: выходной'
  }
};

// Helper functions for catalog search
export function findProductBySKU(sku: string): any {
  for (const category of Object.values(constructionCatalog.categories)) {
    const product = category.products.find(p => p.sku === sku);
    if (product) return product;
  }
  return null;
}

export function searchProducts(query: string): any[] {
  const results = [];
  const searchTerm = query.toLowerCase();
  
  for (const [catKey, category] of Object.entries(constructionCatalog.categories)) {
    for (const product of category.products) {
      if (product.name.toLowerCase().includes(searchTerm) || 
          product.description.toLowerCase().includes(searchTerm) ||
          product.sku.toLowerCase().includes(searchTerm)) {
        results.push({
          ...product,
          category: category.name
        });
      }
    }
  }
  
  return results;
}

export function getProductsByCategory(categoryKey: string) {
  return constructionCatalog.categories[categoryKey]?.products || [];
}

export function calculateTotal(items: Array<{sku: string, quantity: number}>) {
  let total = 0;
  const details = [];
  
  for (const item of items) {
    const product = findProductBySKU(item.sku);
    if (product) {
      const itemTotal = product.price * item.quantity;
      total += itemTotal;
      details.push({
        ...product,
        quantity: item.quantity,
        total: itemTotal
      });
    }
  }
  
  return { total, details };
}
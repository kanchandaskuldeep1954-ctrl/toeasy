import { GroqService } from './src/services/groq.service';

// Test the new smart SQL generation
async function testSmartSQL() {
  console.log('Testing Smart SQL Generation...\n');

  // Mock dataset with real columns
  const mockDataset = {
    columns: ['product_price', 'product_name', 'customer_id', 'order_date', 'quantity'],
    data: [
      { product_price: 29.99, product_name: 'Laptop', customer_id: 1, order_date: '2024-01-01', quantity: 1 },
      { product_price: 9.99, product_name: 'Mouse', customer_id: 2, order_date: '2024-01-02', quantity: 2 },
      { product_price: 199.99, product_name: 'Monitor', customer_id: 3, order_date: '2024-01-03', quantity: 1 },
    ]
  };

  const testQueries = [
    'show me the price column',
    'how many items',
    'display only product names',
    'show top 3 rows',
    'what are the unique dates',
    'show price ordered by highest first',
    'show price_value', // Wrong column name - should suggest alternatives
  ];

  for (const query of testQueries) {
    console.log(`Query: "${query}"`);
    try {
      const result = await GroqService.generateSQL(mockDataset, query);
      console.log(`SQL: ${result.sql}`);
      console.log(`Explanation: ${result.explanation}\n`);
    } catch (error) {
      console.error(`Error: ${error}\n`);
    }
  }
}

testSmartSQL().catch(console.error);

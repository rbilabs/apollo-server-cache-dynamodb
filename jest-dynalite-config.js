module.exports = {
  tables: [
    {
      TableName: 'KeyValueCache',
      KeySchema: [{ AttributeName: 'CacheKey', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'CacheKey', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
      data: [{ CacheKey: 'hello', CacheTTL: new Date(2019, 2, 20, 12, 5).getTime() / 1000, CacheValue: 'world' }],
    },
  ],
  basePort: 8000,
};

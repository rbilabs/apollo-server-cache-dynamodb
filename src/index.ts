// tslint:disable: no-empty
import { KeyValueCache } from 'apollo-server-caching';
import DynamoDB = require('aws-sdk/clients/dynamodb');

const DEFAULT_TABLE_NAME = 'KeyValueCache';
const DEFAULT_PARTITION_KEY = 'CacheKey';
const DEFAULT_VALUE_ATTRIBUTE = 'CacheValue';
const DEFAULT_TTL_ATTRIBUTE = 'CacheTTL';
const DEFAULT_SECONARDY_KEY_VALUE = 'apq';
const DEFAULT_TTL = 300;

// tslint:disable-next-line: interface-name
export interface DynamoDBCacheOptions {
  tableName?: string;
  partitionKeyName?: string;
  secondaryKeyName?: string;
  secondaryKeyValue?: string;
  valueAttribute?: string;
  ttlAttribute?: string;
  defaultTTL?: number;
}

export class DynamoDBCache implements KeyValueCache {
  private client: DynamoDB.DocumentClient;
  private tableName: string;
  private partitionKeyName: string;
  private secondaryKeyName: string | undefined;
  private secondaryKeyValue: string;
  private valueAttribute: string;
  private ttlAttribute: string;
  private defaultTTL: number;

  constructor(client: DynamoDB.DocumentClient, options: DynamoDBCacheOptions = {}) {
    this.client = client;

    const {
      tableName = DEFAULT_TABLE_NAME,
      partitionKeyName = DEFAULT_PARTITION_KEY,
      secondaryKeyName,
      secondaryKeyValue = DEFAULT_SECONARDY_KEY_VALUE,
      valueAttribute = DEFAULT_VALUE_ATTRIBUTE,
      ttlAttribute = DEFAULT_TTL_ATTRIBUTE,
      defaultTTL = DEFAULT_TTL,
    } = options;

    this.tableName = tableName;
    this.partitionKeyName = partitionKeyName;
    this.secondaryKeyName = secondaryKeyName;
    this.secondaryKeyValue = secondaryKeyValue;
    this.valueAttribute = valueAttribute;
    this.ttlAttribute = ttlAttribute;
    this.defaultTTL = defaultTTL;
  }

  public get(key: string): Promise<string> {
    const params: DynamoDB.DocumentClient.GetItemInput = {
      Key: {
        [this.partitionKeyName]: key,
        ...(this.secondaryKeyName ? { [this.secondaryKeyName]: this.secondaryKeyValue } : {}),
      },
      TableName: this.tableName,
    };
    return this.client
      .get(params)
      .promise()
      .then(({ Item = {} }) => {
        // since DynamoDB itself doesnt really clean up items with TTL in a reliable, timely fashion
        // we need to manually check if the cached value should still be alive
        if (!Item[this.ttlAttribute] || Item[this.ttlAttribute] >= Math.floor(Date.now() / 1000)) {
          return Item[this.valueAttribute];
        }
        return undefined;
      });
  }

  public set(key: string, value: string, options?: { ttl?: number }): Promise<void> {
    const epochSeconds = this.calculateTTL(options);
    if (epochSeconds === undefined) {
      return new Promise(resolve => resolve());
    }
    const params: DynamoDB.DocumentClient.PutItemInput = {
      Item: {
        [this.partitionKeyName]: key,
        [this.valueAttribute]: value,
        [this.ttlAttribute]: epochSeconds,
        ...(this.secondaryKeyName ? { [this.secondaryKeyName]: this.secondaryKeyValue } : {}),
      },
      TableName: this.tableName,
    };

    return this.client
      .put(params)
      .promise()
      .then(() => {});
  }

  public delete(key: string): Promise<boolean | void> {
    const params: DynamoDB.DocumentClient.DeleteItemInput = {
      Key: {
        [this.partitionKeyName]: key,
      },
      TableName: this.tableName,
    };
    return this.client
      .delete(params)
      .promise()
      .then(() => {});
  }

  private calculateTTL(options: { ttl?: number } = {}) {
    const { ttl = this.defaultTTL } = options;
    if (ttl <= 0) {
      return undefined;
    }
    const epochSeconds = Math.floor(Date.now() / 1000) + ttl;
    return epochSeconds;
  }
}

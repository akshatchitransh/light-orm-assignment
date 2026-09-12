export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseDriver {
  readonly driverName: string;
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (txDriver: DatabaseDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

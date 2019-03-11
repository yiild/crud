import { ComparisonOperator } from '../operators.list';

export interface RestfulOptions {
  allow?: string[];
  exclude?: string[];
  persist?: string[];
  where?: FilterOptions[];
  include?: JoinOptions;
  limit?: number;
  maxLimit?: number;
  order?: SortOptions[];
  cache?: number | false;
}

export interface FilterOptions {
  field: string;
  operator: ComparisonOperator;
  value?: any;
}

export interface JoinOptions {
  [key: string]: {
    allow?: string[];
    exclude?: string[];
    persist?: string[];
  };
}

export interface SortOptions {
  field: string;
  order: 'ASC' | 'DESC';
}

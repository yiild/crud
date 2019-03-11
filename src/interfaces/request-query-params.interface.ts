export interface RequestQueryParams {
  fields?: string;
  where?: string[];
  'where[]'?: string[];
  or?: string[];
  'or[]'?: string[];
  order?: string[];
  'order[]'?: string[];
  include?: string[];
  'include[]'?: string[];
  limit?: string;
  per_page?: string;
  offset?: string;
  skip?: string;
  page?: string;
  cache?: string;
}

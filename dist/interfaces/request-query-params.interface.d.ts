export interface RequestQueryParams {
    fields?: string;
    where?: string[];
    'where[]'?: string[];
    filter?: string[];
    'filter[]'?: string[];
    or?: string[];
    'or[]'?: string[];
    order?: string[];
    'order[]'?: string[];
    sort?: string[];
    'sort[]'?: string[];
    include?: string[];
    'include[]'?: string[];
    join?: string[];
    'join[]'?: string[];
    limit?: string;
    per_page?: string;
    offset?: string;
    skip?: string;
    page?: string;
    cache?: string;
}

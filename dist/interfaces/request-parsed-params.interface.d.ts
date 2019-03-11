import { ComparisonOperator } from '../operators.list';
export interface RequestParamsParsed {
    fields?: string[];
    where?: FilterParamParsed[];
    or?: FilterParamParsed[];
    include?: JoinParamParsed[];
    order?: SortParamParsed[];
    limit?: number;
    offset?: number;
    page?: number;
    cache?: number;
}
export interface FilterParamParsed {
    field: string;
    operator: ComparisonOperator;
    value?: any;
}
export interface JoinParamParsed {
    field: string;
    select?: string[];
}
export interface SortParamParsed {
    field: string;
    order: 'ASC' | 'DESC';
}

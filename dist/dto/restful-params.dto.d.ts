import { FilterParamDto } from './filter-param.dto';
import { SortParamDto } from './sort-param.dto';
import { JoinParamDto } from './join-param.dto';
export declare class RestfulParamsDto {
    fields?: string[];
    where?: FilterParamDto[];
    or?: FilterParamDto[];
    include?: JoinParamDto[];
    order?: SortParamDto[];
    limit?: number;
    offset?: number;
    page?: number;
    cache?: number;
}

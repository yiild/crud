import { Injectable, NestInterceptor, ExecutionContext } from '@nestjs/common';
import { isObject } from '@nestjs/common/utils/shared.utils';
import { Observable } from 'rxjs';

import {
  RequestParamsParsed,
  FilterParamParsed,
  SortParamParsed,
  JoinParamParsed,
} from '../interfaces';
import { RequestQueryParams } from '../interfaces/request-query-params.interface';
import { ComparisonOperator } from '../operators.list';

@Injectable()
export class RestfulQueryInterceptor implements NestInterceptor {
  private delim = '||';
  private delimStr = ',';
  private reservedFields = [
    'fields',
    'where',
    'where[]',
    'or',
    'or[]',
    'order',
    'order[]',
    'include',
    'include[]',
    'per_page',
    'limit',
    'offset',
    'page',
    'cache',
  ];

  intercept(context: ExecutionContext, call$: Observable<any>) {
    const req = context.switchToHttp().getRequest();

    req.query = this.transform(req.query);

    return call$;
  }

  private transform(query: RequestQueryParams): RequestParamsParsed {
    if (!isObject(query) || !Object.keys(query).length) {
      return {};
    }

    const fields = this.splitString(query.fields);
    const where = this.parseArray(query.where || query['where[]'], this.parseFilter);
    const or = this.parseArray(query.or || query['or[]'], this.parseFilter);
    const order = this.parseArray(query.order || query['order[]'], this.parseSort);
    const include = this.parseArray(query.include || query['include[]'], this.parseJoin);
    const limit = this.parseInt(query.per_page || query.limit);
    const offset = this.parseInt(query.offset);
    const page = this.parseInt(query.page);
    const cache = this.parseInt(query.cache);
    const entityFields = this.parseEntityFields(query);

    const result = {
      where: [...where, ...entityFields],
      or,
      fields,
      order,
      include,
      limit,
      offset,
      page,
      cache,
    };

    return result;
  }

  private splitString(str: string): string[] {
    try {
      return str ? str.split(this.delimStr) : [];
    } catch (error) {
      return str as any;
    }
  }

  private parseInt(str: string): number {
    return str ? parseInt(str, 10) : undefined;
  }

  private parseFilter(str: string): FilterParamParsed {
    try {
      const isArrayValue = ['$in', '$notin', '$between'];
      const params = str.split(this.delim);
      const field = params[0];
      const operator = params[1] as ComparisonOperator;
      let value = params[2] || '';

      if (isArrayValue.some((name) => name === operator)) {
        value = this.splitString(value) as any;
      }

      return {
        field,
        operator,
        value,
      };
    } catch (error) {
      return str as any;
    }
  }

  private parseSort(str: string): SortParamParsed {
    try {
      const params = str.split(this.delimStr);

      return {
        field: params[0],
        order: params[1] as any,
      };
    } catch (error) {
      return str as any;
    }
  }

  private parseJoin(str: string): JoinParamParsed {
    try {
      const params = str.split(this.delim);

      return {
        field: params[0],
        select: params[1] ? this.splitString(params[1]) : [],
      };
    } catch (error) {
      return str as any;
    }
  }

  private parseArray(param: string[], parser: Function) {
    if (typeof param === 'string') {
      return [parser.call(this, param)];
    }

    if (Array.isArray(param) && param.length) {
      const result = [];
      for (let item of param) {
        result.push(parser.call(this, item));
      }
      return result;
    }

    return [];
  }

  private parseEntityFields(query: RequestQueryParams): FilterParamParsed[] {
    return Object.keys(query)
      .filter((key) => !this.reservedFields.some((reserved) => reserved === key))
      .map((field) => ({ field, operator: '$eq', value: query[field] } as FilterParamParsed));
  }
}

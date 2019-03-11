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

    const whereQuery = query.where || query['where[]'];
    const orderQuery = query.order || query['order[]'];
    const includeQuery = query.include || query['include[]'];
    const orQuery = this.isObject(query.where) ? query.where['$or'] || [] : query.or || query['or[]'];

    if (this.isObject(whereQuery) && !!whereQuery['$or']) {
      delete whereQuery['$or'];
    }
    
    const fields = this.splitString(query.fields);
    const where = this.isObject(whereQuery) ? this.parseObject(whereQuery, this.parseWhereObject, this.parseFilter) : this.parseArray(whereQuery, this.parseFilter);
    const or = this.parseArray(orQuery, this.parseOrFilter);
    const order = this.isObject(orderQuery) ? this.parseObject(orderQuery, this.parseOrderObject, this.parseSort) : this.parseArray(orderQuery, this.parseSort);
    const include = this.isObject(includeQuery) ? this.parseObject(includeQuery, this.parseIncludeObject, this.parseJoin) : this.parseArray(includeQuery, this.parseJoin);
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

  private parseOrFilter(param: any) {
    if (typeof param === 'string') {
      return this.parseFilter(param);
    } else if (this.isObject(param)) {
      return this.parseObject(param, this.parseWhereObject, this.parseFilter)[0];
    }
    return [];
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

  private parseObject(param: any, iterator: Function, parser: Function) {
    let keys = Object.keys(param);

    if (Array.isArray(keys) && keys.length) {
      const result = [];
      for (let key of keys) {
        let value = param[key];
        iterator.call(this, result, key, value, parser);
      }
      return result;
    }

    return [];
  }

  private parseWhereObject(result: any[], key: any, value: any, parser: Function) {
    if (value.$or) {
      // skip
    } else if (this.isObject(value)) {
      let subKeys = Object.keys(value);
      for (let k of subKeys) {
        let v = value[k];
        result.push(parser.call(this, `${key}||${k}||${v}`));
      }
    } else if (value === null) {
      result.push(parser.call(this, `${key}||$isnull`));
    } else {
      result.push(parser.call(this, `${key}||$eq||${value}`));
    }
  }

  private parseOrderObject(result: any[], key: string, value: any, parser: Function) {
    result.push(parser.call(this, `${key},${value}`));
  }

  private parseIncludeObject(result: any[], key: string, value: any, parser: Function) {
    if (value.fields) {
      result.push(parser.call(this, `${key}||${value.fields.join(',')}`));
    } else if (Array.isArray(value)) {
      result.push(parser.call(this, `${key}||${value.join(',')}`));
    } else if (typeof value === 'string') {
      result.push(parser.call(this, `${key}||${value}`));
    }
  }

  private parseEntityFields(query: RequestQueryParams): FilterParamParsed[] {
    return Object.keys(query)
      .filter((key) => !this.reservedFields.some((reserved) => reserved === key))
      .map((field) => ({ field, operator: '$eq', value: query[field] } as FilterParamParsed));
  }

  private isObject(v) {
    return isObject(v) && !Array.isArray(v) && v !== null && v !== undefined;
  }
}

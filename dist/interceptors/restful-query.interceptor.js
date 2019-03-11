"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
let RestfulQueryInterceptor = class RestfulQueryInterceptor {
    constructor() {
        this.delim = '||';
        this.delimStr = ',';
        this.reservedFields = [
            'fields',
            'where',
            'where[]',
            'filter',
            'filter[]',
            'or',
            'or[]',
            'order',
            'order[]',
            'sort',
            'sort[]',
            'include',
            'include[]',
            'join',
            'join[]',
            'per_page',
            'limit',
            'offset',
            'page',
            'cache',
        ];
    }
    intercept(context, call$) {
        const req = context.switchToHttp().getRequest();
        req.query = this.transform(req.query);
        return call$;
    }
    transform(query) {
        if (!shared_utils_1.isObject(query) || !Object.keys(query).length) {
            return {};
        }
        const whereQuery = query.where || query['where[]'] || query.filter || query['filter[]'];
        const orderQuery = query.order || query['order[]'] || query.sort || query['sort[]'];
        const includeQuery = query.include || query['include[]'] || query.join || query['join[]'];
        const orQuery = this.isObject(query.where) ? query.where['$or'] || [] : this.isObject(query.filter) ? query.filter['$or'] || [] : query.or || query['or[]'];
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
    splitString(str) {
        try {
            return str ? str.split(this.delimStr) : [];
        }
        catch (error) {
            return str;
        }
    }
    parseInt(str) {
        return str ? parseInt(str, 10) : undefined;
    }
    parseFilter(str) {
        try {
            const isArrayValue = ['$in', '$notin', '$between'];
            const params = str.split(this.delim);
            const field = params[0];
            const operator = params[1];
            let value = params[2] || '';
            if (isArrayValue.some((name) => name === operator)) {
                value = this.splitString(value);
            }
            return {
                field,
                operator,
                value,
            };
        }
        catch (error) {
            return str;
        }
    }
    parseOrFilter(param) {
        if (typeof param === 'string') {
            return this.parseFilter(param);
        }
        else if (this.isObject(param)) {
            return this.parseObject(param, this.parseWhereObject, this.parseFilter)[0];
        }
        return [];
    }
    parseSort(str) {
        try {
            const params = str.split(this.delimStr);
            return {
                field: params[0],
                order: params[1],
            };
        }
        catch (error) {
            return str;
        }
    }
    parseJoin(str) {
        try {
            const params = str.split(this.delim);
            return {
                field: params[0],
                select: params[1] ? this.splitString(params[1]) : [],
            };
        }
        catch (error) {
            return str;
        }
    }
    parseArray(param, parser) {
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
    parseObject(param, iterator, parser) {
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
    parseWhereObject(result, key, value, parser) {
        if (value.$or) {
        }
        else if (this.isObject(value)) {
            let subKeys = Object.keys(value);
            for (let k of subKeys) {
                let v = value[k];
                k = k.charAt(0) === '$' ? k : `$${k}`;
                result.push(parser.call(this, `${key}||${k}||${v}`));
            }
        }
        else if (value === null) {
            result.push(parser.call(this, `${key}||$isnull`));
        }
        else {
            result.push(parser.call(this, `${key}||$eq||${value}`));
        }
    }
    parseOrderObject(result, key, value, parser) {
        result.push(parser.call(this, `${key},${value}`));
    }
    parseIncludeObject(result, key, value, parser) {
        if (value.fields) {
            result.push(parser.call(this, `${key}||${value.fields.join(',')}`));
        }
        else if (Array.isArray(value)) {
            result.push(parser.call(this, `${key}||${value.join(',')}`));
        }
        else if (typeof value === 'string') {
            result.push(parser.call(this, `${key}||${value}`));
        }
    }
    parseEntityFields(query) {
        return Object.keys(query)
            .filter((key) => !this.reservedFields.some((reserved) => reserved === key))
            .map((field) => ({ field, operator: '$eq', value: query[field] }));
    }
    isObject(v) {
        return shared_utils_1.isObject(v) && !Array.isArray(v) && v !== null && v !== undefined;
    }
};
RestfulQueryInterceptor = __decorate([
    common_1.Injectable()
], RestfulQueryInterceptor);
exports.RestfulQueryInterceptor = RestfulQueryInterceptor;
//# sourceMappingURL=restful-query.interceptor.js.map
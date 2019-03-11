import { Brackets, DeepPartial, Repository, SelectQueryBuilder } from 'typeorm';
import { isObject } from '@nestjs/common/utils/shared.utils';
import { plainToClass } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { set } from 'dot-prop';

import { RestfulService } from '../classes/restful-service.class';
import { FilterParamParsed, JoinOptions, JoinParamParsed, RequestParamsParsed, RestfulOptions } from '../interfaces';
import { ObjectLiteral } from '../interfaces/object-literal.interface';
import { isArrayFull } from '../utils';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';

export class RepositoryService<T> extends RestfulService<T> {
  protected options: RestfulOptions = {};

  private entityColumns: string[];
  private entityColumnsHash: ObjectLiteral = {};
  private entityRelationsHash: ObjectLiteral = {};

  constructor(protected repo: Repository<T>) {
    super();

    this.onInitMapEntityColumns();
    this.onInitMapRelations();
  }

  private get entityType(): ClassType<T> {
    return this.repo.target as ClassType<T>;
  }

  private get alias(): string {
    return this.repo.metadata.targetName;
  }

  /**
   * Get many entities
   * @param query
   * @param options
   */
  public async getMany(
    // user: any,
    query: RequestParamsParsed = {},
    options: RestfulOptions = {},
  ): Promise<T[]> {
    const builder = await this.buildQuery(query, options);
    return builder.getMany();
  }

  /**
   * Get one entity by id
   * @param id
   * @param param1
   * @param options
   */
  public async getOne(
    // user: any,
    id: number,
    { where, fields, include, cache }: RequestParamsParsed = {},
    options: RestfulOptions = {},
  ): Promise<T> {
    return this.getOneOrFail(
      {
        where: where ? [{ field: 'id', operator: '$eq', value: id }, ...where] : [{ field: 'id', operator: '$eq', value: id }],
        fields,
        include,
        cache,
      },
      options,
    );
  }

  /**
   * Create one entity
   * @param data
   * @param paramsFilter
   */
  public async createOne(
    // user: any,
    data: DeepPartial<T>,
    paramsFilter: FilterParamParsed[] = []
  ): Promise<T> {
    const entity = this.plainToClass(data, paramsFilter);

    if (!entity) {
      this.throwBadRequestException(`Empty data. Nothing to save.`);
    }

    return this.repo.save<any>(entity);
  }

  /**
   * Create many
   * @param data
   * @param paramsFilter
   */
  public async createMany(
    // user: any,
    data: { bulk: DeepPartial<T>[] },
    paramsFilter: FilterParamParsed[] = [],
  ): Promise<T[]> {
    if (!data || !data.bulk || !data.bulk.length) {
      this.throwBadRequestException(`Empty data. Nothing to save.`);
    }

    const bulk = data.bulk
      .map((one) => this.plainToClass(one, paramsFilter))
      .filter((d) => isObject(d));

    if (!bulk.length) {
      this.throwBadRequestException(`Empty data. Nothing to save.`);
    }

    return this.repo.save<any>(bulk, { chunk: 50 });
  }

  /**
   * Update one entity
   * @param id
   * @param data
   * @param paramsFilter
   */
  public async updateOne(
    // user: any,
    id: number,
    data: DeepPartial<T>,
    paramsFilter: FilterParamParsed[] = [],
  ): Promise<T> {
    // we need this, because TypeOrm will try to insert if no data found by id
    const found = await this.getOneOrFail({
      where: [{ field: 'id', operator: '$eq', value: id }, ...paramsFilter],
    });

    data['id'] = id;
    const entity = this.plainToClass(data, paramsFilter);

    // we use save and not update because
    // we might want to update relational entities
    return this.repo.save<any>(entity);
  }

  /**
   * Delete one entity
   * @param id
   * @param paramsFilter
   */
  public async deleteOne(
    // user: any,
    id: number,
    paramsFilter: FilterParamParsed[] = []
  ): Promise<void> {
    const found = await this.getOneOrFail({
      where: [{ field: 'id', operator: '$eq', value: id }, ...paramsFilter],
    });

    const deleted = await this.repo.remove(found);
  }

  private async getOneOrFail(
    { where, fields, include, cache }: RequestParamsParsed = {},
    options: RestfulOptions = {},
  ): Promise<T> {
    const builder = await this.buildQuery({ where, fields, include, cache }, options, false);
    const found = await builder.getOne();

    if (!found) {
      this.throwNotFoundException(this.alias);
    }

    return found;
  }

  /**
   * Do query into DB
   * @param query
   * @param options
   * @param many
   */
  private async buildQuery(
    query: RequestParamsParsed,
    options: RestfulOptions = {},
    many = true,
  ): Promise<SelectQueryBuilder<T>> {
    // merge options
    const mergedOptions = Object.assign({}, this.options, options);
    // get selet fields
    const select = this.getSelect(query, mergedOptions);

    // create query builder
    const builder = this.repo.createQueryBuilder(this.alias);

    // select fields
    builder.select(select);

    // set mandatory where condition
    if (isArrayFull(mergedOptions.where)) {
      for (let i = 0; i < mergedOptions.where.length; i++) {
        this.setAndWhere(mergedOptions.where[i], `mergedOptions${i}`, builder);
      }
    }

    const hasFilter = isArrayFull(query.where);
    const hasOr = isArrayFull(query.or);

    if (hasFilter && hasOr) {
      if (query.where.length === 1 && query.or.length === 1) {
        // WHERE :filter OR :or
        this.setOrWhere(query.where[0], `filter`, builder);
        this.setOrWhere(query.or[0], `or0`, builder);
      } else if (query.where.length === 1) {
        this.setAndWhere(query.where[0], `filter`, builder);
        builder.orWhere(
          new Brackets((qb) => {
            for (let i = 0; i < query.or.length; i++) {
              this.setAndWhere(query.or[i], `or${i}`, qb as any);
            }
          }),
        );
      } else if (query.or.length === 1) {
        this.setAndWhere(query.or[0], `or0`, builder);
        builder.orWhere(
          new Brackets((qb) => {
            for (let i = 0; i < query.where.length; i++) {
              this.setAndWhere(query.where[i], `filter${i}`, qb as any);
            }
          }),
        );
      } else {
        builder.andWhere(
          new Brackets((qb) => {
            for (let i = 0; i < query.where.length; i++) {
              this.setAndWhere(query.where[i], `filter${i}`, qb as any);
            }
          }),
        );
        builder.orWhere(
          new Brackets((qb) => {
            for (let i = 0; i < query.or.length; i++) {
              this.setAndWhere(query.or[i], `or${i}`, qb as any);
            }
          }),
        );
      }
    } else if (hasOr) {
      // WHERE :or OR :or OR ...
      for (let i = 0; i < query.or.length; i++) {
        this.setOrWhere(query.or[i], `or${i}`, builder);
      }
    } else if (hasFilter) {
      // WHERE :filter AND :filter AND ...
      for (let i = 0; i < query.where.length; i++) {
        this.setAndWhere(query.where[i], `filter${i}`, builder);
      }
    }

    // set joins
    if (isArrayFull(query.include)) {
      const joinOptions = {
        ...(this.options.include ? this.options.include : {}),
        ...(options.include ? options.include : {}),
      };

      if (Object.keys(joinOptions).length) {
        for (let i = 0; i < query.include.length; i++) {
          this.setJoin(query.include[i], joinOptions, builder);
        }
      }
    }

    if (many) {
      // set sort (order by)
      const sort = this.getSort(query, mergedOptions);
      builder.orderBy(sort);

      // set take
      const take = this.getTake(query, mergedOptions);
      if (take) {
        builder.take(take);
      }

      // set skip
      const skip = this.getSkip(query, take);
      if (skip) {
        builder.skip(skip);
      }
    }

    // remove cache if nedeed
    if (
      query.cache === 0 &&
      this.repo.metadata.connection.queryResultCache &&
      this.repo.metadata.connection.queryResultCache.remove
    ) {
      const cacheId = this.getCacheId(query, options);
      await this.repo.metadata.connection.queryResultCache.remove([cacheId]);
    }

    // set cache
    if (mergedOptions.cache) {
      const cacheId = this.getCacheId(query, options);
      builder.cache(cacheId, mergedOptions.cache);
    }

    return builder;
  }

  private plainToClass(data: DeepPartial<T>, paramsFilter: FilterParamParsed[] = []): T {
    if (!isObject(data)) {
      return undefined;
    }

    if (paramsFilter.length) {
      for (const filter of paramsFilter) {
        data[filter.field] = filter.value;
      }
    }

    if (!Object.keys(data).length) {
      return undefined;
    }

    return plainToClass(this.entityType, data);
  }

  private onInitMapEntityColumns() {
    this.entityColumns = this.repo.metadata.columns.map((prop) => {
      this.entityColumnsHash[prop.propertyName] = true;
      return prop.propertyName;
    });
  }

  private onInitMapRelations() {
    this.entityRelationsHash = this.repo.metadata.relations.reduce(
      (hash, curr) => ({
        ...hash,
        [curr.propertyName]: {
          name: curr.propertyName,
          type: this.getJoinType(curr.relationType),
          columns: curr.inverseEntityMetadata.columns.map((col) => col.propertyName),
          referencedColumn: (curr.joinColumns.length
            ? curr.joinColumns[0]
            : curr.inverseRelation.joinColumns[0]
          ).referencedColumn.propertyName,
        },
      }),
      {},
    );
  }

  private getJoinType(relationType: string): string {
    switch (relationType) {
      case 'many-to-one':
      case 'one-to-one':
        return 'innerJoin';

      default:
        return 'leftJoin';
    }
  }

  private hasColumn(column: string): boolean {
    return this.entityColumnsHash[column];
  }

  private validateHasColumn(column: string) {
    if (!this.hasColumn(column)) {
      this.throwBadRequestException(`Invalid column name '${column}'`);
    }
  }

  private getAllowedColumns(columns: string[], options: ObjectLiteral): string[] {
    return (!options.exclude || !options.exclude.length) &&
      (!options.allow || !options.allow.length)
      ? columns
      : columns.filter(
          (column) =>
            (options.exclude && options.exclude.length
              ? !options.exclude.some((col) => col === column)
              : true) &&
            (options.allow && options.allow.length
              ? options.allow.some((col) => col === column)
              : true),
        );
  }

  private getRelationMetadata(field: string) {
    try {
      const fields = field.split('.');
      const target = fields[fields.length - 1];
      const paths = fields.slice(0, fields.length - 1);

      let relations = this.repo.metadata.relations;

      for (const propertyName of paths) {
        relations = relations.find(o => o.propertyName === propertyName).inverseEntityMetadata.relations;
      }

      const relation: RelationMetadata & { nestedRelation?: string } = relations.find(o => o.propertyName === target);

      relation.nestedRelation = `${fields[fields.length - 2]}.${target}`;

      return relation;
    } catch (e) {
      return null;
    }
  }

  private setJoin(cond: JoinParamParsed, joinOptions: JoinOptions, builder: SelectQueryBuilder<T>) {
    if (this.entityRelationsHash[cond.field] === undefined && cond.field.includes('.')) {
      const curr = this.getRelationMetadata(cond.field);
      if (!curr) {
        this.entityRelationsHash[cond.field] = null;
        return true;
      }

      this.entityRelationsHash[cond.field] = {
        name: curr.propertyName,
        type: this.getJoinType(curr.relationType),
        columns: curr.inverseEntityMetadata.columns.map((col) => col.propertyName),
        referencedColumn: (curr.joinColumns.length
            ? curr.joinColumns[0]
            : curr.inverseRelation.joinColumns[0]
        ).referencedColumn.propertyName,
        nestedRelation: curr.nestedRelation,
      };
    }

    if (cond.field && this.entityRelationsHash[cond.field] && joinOptions[cond.field]) {
      const relation = this.entityRelationsHash[cond.field];
      const options = joinOptions[cond.field];
      const allowed = this.getAllowedColumns(relation.columns, options);

      if (!allowed.length) {
        return true;
      }

      const columns =
        !cond.select || !cond.select.length
          ? allowed
          : cond.select.filter((col) => allowed.some((a) => a === col));

      const select = [
        relation.referencedColumn,
        ...(options.persist && options.persist.length ? options.persist : []),
        ...columns,
      ].map((col) => `${relation.name}.${col}`);

      const relationPath = relation.nestedRelation || `${this.alias}.${relation.name}`;

      builder[relation.type](relationPath, relation.name);
      builder.addSelect(select);
    }

    return true;
  }

  private setAndWhere(cond: FilterParamParsed, i: any, builder: SelectQueryBuilder<T>) {
    this.validateHasColumn(cond.field);
    const { str, params } = this.mapOperatorsToQuery(cond, `andWhere${i}`);
    builder.andWhere(str, params);
  }

  private setOrWhere(cond: FilterParamParsed, i: any, builder: SelectQueryBuilder<T>) {
    this.validateHasColumn(cond.field);
    const { str, params } = this.mapOperatorsToQuery(cond, `orWhere${i}`);
    builder.orWhere(str, params);
  }

  private getCacheId(query: RequestParamsParsed, options: RestfulOptions): string {
    return JSON.stringify({ query, options, cache: undefined });
  }

  private getSelect(query: RequestParamsParsed, options: RestfulOptions): string[] {
    const allowed = this.getAllowedColumns(this.entityColumns, options);

    const columns =
      query.fields && query.fields.length
        ? query.fields.filter((field) => allowed.some((col) => field === col))
        : allowed;

    const select = [
      ...(options.persist && options.persist.length ? options.persist : []),
      ...columns,
      'id', // always persist ids
    ].map((col) => `${this.alias}.${col}`);

    return select;
  }

  private getSkip(query: RequestParamsParsed, take: number): number {
    return query.page && take ? take * (query.page - 1) : query.offset ? query.offset : 0;
  }

  private getTake(query: RequestParamsParsed, options: RestfulOptions): number {
    if (query.limit) {
      return options.maxLimit
        ? query.limit <= options.maxLimit
          ? query.limit
          : options.maxLimit
        : query.limit;
    }

    if (options.limit) {
      return options.maxLimit
        ? options.limit <= options.maxLimit
          ? options.limit
          : options.maxLimit
        : options.limit;
    }

    return options.maxLimit ? options.maxLimit : 0;
  }

  private getSort(query: RequestParamsParsed, options: RestfulOptions) {
    let order = query.order && query.order.length
      ? query.order
      : options.order && options.order.length
      ? options.order
      : []
      ;

    if (!order.length) {
      return {};
    }

    if (typeof order === 'string') {
      this.throwBadRequestException(`Invalid column name '${order}'`);
    }

    let orderMap = order.reduce((acc, o) => {
      if (!o.order) {
        this.throwBadRequestException(`Invalid column name '${o.order}'`);
      }
      set(acc, o.field, o.order);
      return acc;
    }, {});

    return this.mapSort(orderMap, {});
  }

  private mapSort(sort: ObjectLiteral, params: ObjectLiteral, parent=this.alias) {
    Object.keys(sort).forEach(key => {
      if (!!sort[key] && isObject(sort[key])) {
        this.mapSort(sort[key], params, key);
      } else {
        params[`${parent}.${key}`] = sort[key];
      }
    });

    return params;
  }

  private mapOperatorsToQuery(
    cond: FilterParamParsed,
    param: any,
  ): { str: string; params: ObjectLiteral } {
    const field = `${this.alias}.${cond.field}`;
    let str: string;
    let params: ObjectLiteral;

    switch (cond.operator) {
      case '$eq':
        str = `${field} = :${param}`;
        break;

      case '$ne':
        str = `${field} != :${param}`;
        break;

      case '$gt':
        str = `${field} > :${param}`;
        break;

      case '$lt':
        str = `${field} < :${param}`;
        break;

      case '$gte':
        str = `${field} >= :${param}`;
        break;

      case '$lte':
        str = `${field} <= :${param}`;
        break;

      case '$starts':
        str = `${field} LIKE :${param}`;
        params = { [param]: `${cond.value}%` };
        break;

      case '$ends':
        str = `${field} LIKE :${param}`;
        params = { [param]: `%${cond.value}` };
        break;

      case '$cont':
        str = `${field} LIKE :${param}`;
        params = { [param]: `%${cond.value}%` };
        break;

      case '$excl':
        str = `${field} NOT LIKE :${param}`;
        params = { [param]: `%${cond.value}%` };
        break;

      case '$in':
        if (!Array.isArray(cond.value) || !cond.value.length) {
          this.throwBadRequestException(`Invalid column '${cond.field}' value`);
        }
        str = `${field} IN (:...${param})`;
        break;

      case '$notin':
        if (!Array.isArray(cond.value) || !cond.value.length) {
          this.throwBadRequestException(`Invalid column '${cond.field}' value`);
        }
        str = `${field} NOT IN (:...${param})`;
        break;

      case '$isnull':
        str = `${field} IS NULL`;
        params = {};
        break;

      case '$notnull':
        str = `${field} IS NOT NULL`;
        params = {};
        break;

      case '$between':
        if (!Array.isArray(cond.value) || !cond.value.length || cond.value.length !== 2) {
          this.throwBadRequestException(`Invalid column '${cond.field}' value`);
        }
        str = `${field} BETWEEN :${param}0 AND :${param}1`;
        params = {
          [`${param}0`]: cond.value[0],
          [`${param}1`]: cond.value[1],
        };
        break;

      default:
        str = `${field} = :${param}`;
        break;
    }

    if (typeof params === 'undefined') {
      params = { [param]: cond.value };
    }

    return { str, params };
  }
}

import * as request from 'supertest';
import { expect } from 'chai';
import { Test } from '@nestjs/testing';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Controller, Get, INestApplication, Injectable, Param } from '@nestjs/common';

import { Company, ormConfig, User, UserProfile } from '../../integration/typeorm/e2e';
import { Action, Crud, CrudController, Feature, Override, RestfulOptions } from '../../src';
import { RepositoryService } from '../../src/typeorm';

@Injectable()
class CompaniesService extends RepositoryService<Company> {
  protected options: RestfulOptions = {
    persist: ['id'],
    where: [{ field: 'id', operator: '$notnull' }],
    order: [{ field: 'id', order: 'ASC' }],
  };

  constructor(@InjectRepository(Company) repo) {
    super(repo);
  }
}

@Feature('Companies')
@Crud(Company, {
  options: {
    cache: 1000,
    where: [{ field: 'id', operator: '$notnull' }],
    include: {
      'users': {
        persist: ['id'],
        exclude: ['password'],
      },
      'users.projects': {
        exclude: ['description'],
      },
      'users.projects.tasks': {
        persist: ['status'],
      },
    },
  },
})
@Controller('companies')
class CompaniesController implements CrudController<CompaniesService, Company> {
  constructor(public service: CompaniesService) {
  }

  @Action('test')
  @Get('test')
  test() {
    return 'ok';
  }

  @Override()
  deleteOne(@Param('id') id, @Param() params) {
    return (this as any).deleteOneBase(id, params);
  }
}

@Injectable()
export class UsersService extends RepositoryService<User> {
  protected options: RestfulOptions = {};

  constructor(@InjectRepository(User) repo) {
    super(repo);
  }
}


@Feature('Users')
@Crud(User, {
  options: {
    exclude: ['password'],
    include: {
      profile: {
        allow: ['firstName', 'lastName'],
      },
    },
    maxLimit: 10,
    cache: 3000,
  },
  params: ['companyId'],
  validation: {
    validationError: {
      target: false,
      value: false,
    },
  },
})
@Controller('/companies/:companyId/users')
export class UsersController implements CrudController<UsersService, User> {
  constructor(public service: UsersService) {}
}

describe('Simple base routes', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(ormConfig),
        TypeOrmModule.forFeature([UserProfile, User, Company]),
      ],
      providers: [CompaniesService, UsersService],
      controllers: [CompaniesController, UsersController],
    }).compile();

    app = fixture.createNestApplication();

    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    app.close();
  });

  // Get Many

  describe('', () => {
  });

  it('/GET / (200)', () => {
    return request(server)
      .get('/companies')
      .expect(200);
  });

  it('/GET ?cache=0 (200)', () => {
    return request(server)
      .get('/companies?cache=0')
      .expect(200);
  });

  it('/GET ?fields=name (200)', () => {
    return request(server)
      .get('/companies?fields=name')
      .expect(200);
  });

  it('/GET ?fields=name,id (200)', () => {
    return request(server)
      .get('/companies?fields=name')
      .expect(200);
  });

  it('/GET ?limit=5 (200)', () => {
    return request(server)
      .get('/companies?limit=5')
      .expect(200);
  });

  it('/GET ?limit=2&page=3 (200)', () => {
    return request(server)
      .get('/companies?limit=2&page=3')
      .expect(200);
  });

  it('/GET ?offset=5 (200)', () => {
    return request(server)
      .get('/companies?offset=5')
      .expect(200);
  });

  it('/GET ?filter=domain||$ne||test1 (200)', () => {
    return request(server)
      .get('/companies?filter=domain||$ne||test1')
      .expect(200);
  });

  it('/GET ?filter=domain||ne||test1 (200)', () => {
    return request(server)
      .get('/companies?filter=domain||ne||test1')
      .expect(200);
  });

  it('/GET ?where=domain||$ne||test1 (200)', () => {
    return request(server)
      .get('/companies?where=domain||$ne||test1')
      .expect(200);
  });

  it('/GET ?filter[domain][$ne]=test1 (200)', () => {
    return request(server)
      .get('/companies?filter[domain][$ne]=test1')
      .expect(200);
  });

  it('/GET ?where[domain][$ne]=test1 (200)', () => {
    return request(server)
      .get('/companies?where[domain][$ne]=test1')
      .expect(200);
  });

  it('/GET ?or=domain||$ne||test1 (200)', () => {
    return request(server)
      .get('/companies?or=domain||$ne||test1')
      .expect(200);
  });

  it('/GET ?where[$or][0][domain][$ne]=test1 (200)', () => {
    return request(server)
      .get('/companies?where[$or][0][domain][$ne]=test1')
      .expect(200);
  });

  it('/GET ?or=domain||$eq||test1&or=domain||$eq||test2 (200)', () => {
    return request(server)
      .get('/companies?or=domain||$eq||test1&or=domain||$eq||test2')
      .expect(200);
  });

  it('/GET ?where[$or][0][domain][$eq]=test1&where[$or][1][domain][$eq]=test2 (200)', () => {
    return request(server)
      .get('/companies?where[$or][0][domain][$eq]=test1&where[$or][1][domain][$eq]=test2')
      .expect(200);
  });

  it('/GET ?or=domain||$eq||test1&where=domain||$eq||test2 (200)', () => {
    return request(server)
      .get('/companies?or=domain||$eq||test1&where=domain||$eq||test2')
      .expect(200);
  });

  it('/GET ?where[$or][0][domain][$eq]=test1&where[domain][$eq]=test2 (200)', () => {
    return request(server)
      .get('/companies?where[$or][0][domain][$eq]=test1&where[domain][$eq]=test2')
      .expect(200);
  });

  it('/GET ?or=domain||$eq||test1&or=name||$notnull&where=domain||$eq||test2 (200)', () => {
    return request(server)
      .get('/companies?or=domain||$eq||test1&or=name||$notnull&where=domain||$eq||test2')
      .expect(200);
  });

  it('/GET ?where[$or][0][domain][$eq]=test1&where[$or][1][name][$notnull]&where[domain][$eq]=test2 (200)', () => {
    return request(server)
      .get('/companies?where[$or][0][domain][$eq]=test1&where[$or][1][name][$notnull]&where[domain][$eq]=test2')
      .expect(200);
  });

  it('/GET ?where=domain||$eq||test1&where=name||$notnull&or=domain||$eq||test2&or=name||$cont||Test2 (200)', () => {
    return request(server)
      .get(
        '/companies?where=domain||$eq||test1&where=name||$notnull&or=domain||$eq||test2&or=name||$cont||Test2',
      )
      .expect(200);
  });

  it('/GET ?where[domain][$eq]=test1&where[name][$notnull]&where[$or][0][domain][$eq]=test2&where[$or][1][name][$cont]=Test2 (200)', () => {
    return request(server)
      .get(
        '/companies?where[domain][$eq]=test1&where[name][$notnull]&where[$or][0][domain][$eq]=test2&where[$or][1][name][$cont]=Test2',
      )
      .expect(200);
  });

  it('/GET ?or=domain||$eq||test1&where=name||$notnull&where=domain||$eq||test2 (200)', () => {
    return request(server)
      .get('/companies?or=domain||$eq||test1&where=name||$notnull&where=domain||$eq||test2')
      .expect(200);
  });

  it('/GET ?where[$or][0][domain][$eq]=test1&where[name][$notnull]&where[domain][$eq]=test2 (200)', () => {
    return request(server)
      .get('/companies?where[$or][0][domain][$eq]=test1&where[name][$notnull]&where[domain][$eq]=test2')
      .expect(200);
  });

  it('/GET ?include=users (200)', () => {
    return request(server)
      .get('/companies?include=users')
      .expect(200);
  });

  it('/GET ?join=users (200)', () => {
    return request(server)
      .get('/companies?join=users')
      .expect(200);
  });

  it('/GET ?include=users||email (200)', () => {
    return request(server)
      .get('/companies?include=users||email')
      .expect(200);
  });

  it('/GET ?include[users]=email (200)', () => {
    return request(server)
      .get('/companies?include[users]=email')
      .expect(200)
      .expect((res) => {
        expect(res.body[0].users).to.be.an('array')
      });
  });

  it('/GET ?join[users]=email (200)', () => {
    return request(server)
      .get('/companies?join[users]=email')
      .expect(200)
      .expect((res) => {
        expect(res.body[0].users).to.be.an('array')
      });
  });

  it('/GET ?sort=name,DESC (200)', () => {
    return request(server)
      .get('/companies?sort=name,DESC')
      .expect(200);
  });

  it('/GET ?order=name,DESC (200)', () => {
    return request(server)
      .get('/companies?order=name,DESC')
      .expect(200);
  });

  it('/GET ?order[name]=DESC (200)', () => {
    return request(server)
      .get('/companies?order[name]=DESC')
      .expect(200);
  });

  it('/GET ?order=name||DESC (400)', () => {
    return request(server)
      .get('/companies?order=name||DESC')
      .expect(400);
  });

  it('/GET ?domain=test5 (200)', () => {
    return request(server)
      .get('/companies?domain=test5')
      .expect(200);
  });

  it('/GET ?where[domain]=test5 (200)', () => {
    return request(server)
      .get('/companies?where[domain]=test5')
      .expect(200);
  });

  it('/GET ?where=id||$in||1,2,3 (200)', () => {
    return request(server)
      .get('/companies?where=id||$in||1,2,3')
      .expect(200);
  });

  it('/GET ?where[id][$in]=1,2,3 (200)', () => {
    return request(server)
      .get('/companies?where[id][$in]=1,2,3')
      .expect(200);
  });

  it('/GET ?where=foo||$in||1,2,3 (400)', () => {
    return request(server)
      .get('/companies?where=foo||$in||1,2,3')
      .expect(400);
  });

  it('/GET ?where[foo][$in]=1,2,3 (400)', () => {
    return request(server)
      .get('/companies?where[foo][$in]=1,2,3')
      .expect(400);
  });

  it('/GET ?where=id||$gt||1 (200)', () => {
    return request(server)
      .get('/companies?where=id||$gt||1')
      .expect(200);
  });

  it('/GET ?where[id][$gt]=1 (200)', () => {
    return request(server)
      .get('/companies?where[id][$gt]=1')
      .expect(200);
  });

  it('/GET ?where=id||$lt||5 (200)', () => {
    return request(server)
      .get('/companies?where=id||$lt||5')
      .expect(200);
  });

  it('/GET ?where[id][$lt]=5 (200)', () => {
    return request(server)
      .get('/companies?where[id][$lt]=5')
      .expect(200);
  });

  it('/GET ?where=id||$gte||1 (200)', () => {
    return request(server)
      .get('/companies?where=id||$gte||1')
      .expect(200);
  });

  it('/GET ?where[id][$gte]=1 (200)', () => {
    return request(server)
      .get('/companies?where[id][$gte]=1')
      .expect(200);
  });

  it('/GET ?where=id||$lte||5 (200)', () => {
    return request(server)
      .get('/companies?where=id||$lte||5')
      .expect(200);
  });

  it('/GET ?where[id][$lte]=5 (200)', () => {
    return request(server)
      .get('/companies?where[id][$lte]=5')
      .expect(200);
  });

  it('/GET ?where=name||$starts||T (200)', () => {
    return request(server)
      .get('/companies?where=name||$starts||T')
      .expect(200);
  });

  it('/GET ?where[name][$starts]=T (200)', () => {
    return request(server)
      .get('/companies?where[name][$starts]=T')
      .expect(200);
  });

  it('/GET ?where=name||$ends||4 (200)', () => {
    return request(server)
      .get('/companies?where=name||$ends||4')
      .expect(200);
  });

  it('/GET ?where[name][$ends]=4 (200)', () => {
    return request(server)
      .get('/companies?where[name][$ends]=4')
      .expect(200);
  });

  it('/GET ?where=name||$excl||5 (200)', () => {
    return request(server)
      .get('/companies?where=name||$excl||5')
      .expect(200);
  });

  it('/GET ?where[name][$excl]=5 (200)', () => {
    return request(server)
      .get('/companies?where[name][$excl]=5')
      .expect(200);
  });

  it('/GET ?where=description||$isnull (200)', () => {
    return request(server)
      .get('/companies?where=description||$isnull')
      .expect(200);
  });

  it('/GET ?where[description][$isnull] (200)', () => {
    return request(server)
      .get('/companies?where[description][$isnull]=true')
      .expect(200);
  });

  it('/GET ?where=id||$notin||500,501 (200)', () => {
    return request(server)
      .get('/companies?where=id||$notin||500,501')
      .expect(200);
  });

  it('/GET ?where[id][$notin]=500,501 (200)', () => {
    return request(server)
      .get('/companies?where[id][$notin]=500,501')
      .expect(200);
  });

  it('/GET ?where=id||$between||1,5 (200)', () => {
    return request(server)
      .get('/companies?where=id||$between||1,5')
      .expect(200);
  });

  it('/GET ?where[id][$between]=1,5 (200)', () => {
    return request(server)
      .get('/companies?where[id][$between]=1,5')
      .expect(200);
  });

  it('/GET ?where=id||$in|| (400)', () => {
    return request(server)
      .get('/companies?where=id||$in||')
      .expect(400);
  });

  it('/GET ?where[id][$in] (400)', () => {
    return request(server)
      .get('/companies?where[id][$in]')
      .expect(400);
  });

  it('/GET ?where=id||$notin|| (400)', () => {
    return request(server)
      .get('/companies?where=id||$notin||')
      .expect(400);
  });

  it('/GET ?where[id][$notin] (400)', () => {
    return request(server)
      .get('/companies?where[id][$notin]')
      .expect(400);
  });

  it('/GET ?where=id||$between|| (400)', () => {
    return request(server)
      .get('/companies?where=id||$between||')
      .expect(400);
  });

  it('/GET ?where[id][$between] (400)', () => {
    return request(server)
      .get('/companies?where[id][$between]')
      .expect(400);
  });

  it('/GET ?where=id||$between||4 (400)', () => {
    return request(server)
      .get('/companies?where=id||$between||4')
      .expect(400);
  });

  it('/GET ?where[id][$between]=4 (400)', () => {
    return request(server)
      .get('/companies?where[id][$between]=4')
      .expect(400);
  });

  // Get One

  it('/GET /1 (200)', () => {
    return request(server)
      .get('/companies/1')
      .expect(200);
  });

  it('/GET /foo (400)', () => {
    return request(server)
      .get('/companies/foo')
      .expect(400);
  });

  it('/GET /345 (404)', () => {
    return request(server)
      .get('/companies/345')
      .expect(404);
  });

  // Create One

  it('/POST (201)', () => {
    const data = { name: 'e2eName0', domain: 'e2eDomain0' } as Company;
    return request(server)
      .post('/companies')
      .send(data)
      .expect(201);
  });

  it('/POST (400)', () => {
    return request(server)
      .post('/companies')
      .send({})
      .expect(400);
  });

  it('/POST (400)', () => {
    const data = { name: 123 };
    return request(server)
      .post('/companies')
      .send(data)
      .expect(400);
  });

  // Create Many

  it('/POST bulk (201)', () => {
    const data = {
      bulk: [
        { name: 'e2eName1', domain: 'e2eDomain1' },
        { name: 'e2eName2', domain: 'e2eDomain2' },
        { name: 'e2eName3', domain: 'e2eDomain3' },
      ],
    };
    return request(server)
      .post('/companies/bulk')
      .send(data)
      .expect(201);
  });

  // Update One

  it('/PATCH (404)', () => {
    return request(server)
      .patch('/companies/123')
      .send({})
      .expect(404);
  });

  it('/PATCH (200)', () => {
    return request(server)
      .patch('/companies/1')
      .send({})
      .expect(200);
  });

  it('/PATCH (200)', () => {
    const data = { name: 'updatedName' };
    return request(server)
      .patch('/companies/1')
      .send(data)
      .expect(200);
  });

  // Delete One

  it('/DELETE (200)', () => {
    return request(server)
      .delete('/companies/11')
      .expect(200);
  });

  // Custom routes

  it('/GET /test (200)', () => {
    return request(server)
      .get('/companies/test')
      .expect(200);
  });

  describe('nested relations', () => {
    it('nested relations', () => {
      return request(server)
        .get('/companies/1?include=users||email&include=users.projects&include=users.projects.tasks')
        .expect(200)
        .expect(res => {
          expect(res.body).to.have.nested.property('users[0].projects[0].tasks[0].name');
        });
    });

    it('nested relations', () => {
      return request(server)
        .get('/companies/1?include[users]=email&include[users.projects]&include[users.projects.tasks]')
        .expect(200)
        .expect(res => {
          expect(res.body).to.have.nested.property('users[0].projects[0].tasks[0].name');
        });
    });

    it('when missing fields', () => {
      return request(server)
        .get('/companies/1?include=users||email&include=users.projects1&include=users.projects1.tasks')
        .expect(200);
    });

    it('when missing fields', () => {
      return request(server)
        .get('/companies/1?include[users]=email&include[users.projects1]&include[users.projects1.tasks]')
        .expect(200);
    });
  });

  describe('sort by nested relations', () => {
    it('sort by nested relation column', () => {
      return request(server)
        .get('/companies/1/users?include[profile]=lastName&order[profile.lastName]=DESC')
        .expect(200)
        .expect(res => {
          let sortedNames = res.body.slice().sort((a, b) => a < b).map(u => u.profile.lastName);
          expect(res.body.map(u => u.profile.lastName)).to.deep.equal(sortedNames);
        });
    });
  });

});

import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import { AuditAction, Prisma, PrismaClient } from '@prisma/client';
import { auditContext, AuditEntry, toAuditLogRow } from './audit-context';
import { diffRecords, protectValue } from './audit-changes';

type Row = Record<string, unknown>;
type Args = Record<string, unknown> & {
  where?: unknown;
  data?: unknown;
  select?: Record<string, unknown>;
  omit?: Record<string, unknown>;
};

export type AuditOperationParams = {
  model?: string;
  operation: string;
  args: Args;
  query: (args: Args) => Promise<unknown>;
};

type Delegate = {
  findUnique(args: { where: unknown }): Promise<Row | null>;
  findMany(args: {
    where: unknown;
    select: { id: true };
    take: number;
  }): Promise<{ id: number }[]>;
};

export type AuditDependencies = {
  delegateOf(model: string): Delegate;
  scalarFieldsOf(model: string): readonly string[];
  record(entry: AuditEntry): void;
};

// Session muda a cada requisição (registerUse) e AuditLog é a própria trilha.
const UNAUDITED_MODELS = new Set(['AuditLog', 'Session']);

const SINGLE_OPERATIONS = new Set(['create', 'update', 'upsert', 'delete']);

const MANY_OPERATIONS: Record<string, AuditAction> = {
  createMany: AuditAction.CREATE,
  createManyAndReturn: AuditAction.CREATE,
  updateMany: AuditAction.UPDATE,
  updateManyAndReturn: AuditAction.UPDATE,
  deleteMany: AuditAction.DELETE,
};

// ponytail: guarda até 100 ids de cada escrita em lote; o total vai sempre em
// detail.count.
const MANY_IDS_LIMIT = 100;

function pick(record: Row | null, fields: readonly string[]): Row {
  if (!record) {
    return {};
  }
  return Object.fromEntries(
    fields
      .filter((field) => field in record)
      .map((field) => [field, record[field]]),
  );
}

// O registro de depois precisa de todos os campos, mesmo quando o chamador pediu
// só alguns com select ou tirou algum com omit. A consulta lê todos, e o
// chamador recebe só o que pediu.
function withAllFields(args: Args, fields: readonly string[]): Args {
  const rest = Object.fromEntries(
    Object.entries(args).filter(([key]) => key !== 'omit'),
  );
  if (!args.select) {
    return rest;
  }
  const all = Object.fromEntries(fields.map((field) => [field, true]));
  return { ...rest, select: { ...args.select, ...all } };
}

function asRequested(result: unknown, args: Args): unknown {
  if (!result || typeof result !== 'object') {
    return result;
  }
  const { select, omit } = args;
  if (select) {
    return Object.fromEntries(
      Object.entries(result).filter(([field]) => Boolean(select[field])),
    );
  }
  if (omit) {
    return Object.fromEntries(
      Object.entries(result).filter(([field]) => !omit[field]),
    );
  }
  return result;
}

function singleAction(operation: string, before: Row | null): AuditAction {
  if (operation === 'delete') {
    return AuditAction.DELETE;
  }
  return operation === 'create' || !before
    ? AuditAction.CREATE
    : AuditAction.UPDATE;
}

async function auditSingle(
  { model, operation, args, query }: AuditOperationParams & { model: string },
  deps: AuditDependencies,
): Promise<unknown> {
  const fields = deps.scalarFieldsOf(model);
  const before =
    operation === 'create'
      ? null
      : await deps.delegateOf(model).findUnique({ where: args.where });
  const result = await query(withAllFields(args, fields));

  const action = singleAction(operation, before);
  const after =
    action === AuditAction.DELETE ? {} : pick(result as Row | null, fields);
  const changes = diffRecords(model, pick(before, fields), after);

  if (changes || action !== AuditAction.UPDATE) {
    const id = after.id ?? before?.id;
    deps.record({
      action,
      entity: model,
      entity_id: typeof id === 'number' ? id : null,
      changes: changes as Prisma.InputJsonValue | null,
      detail: null,
    });
  }

  return asRequested(result, args);
}

function protectData(model: string, data: unknown): Prisma.InputJsonObject {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(data).map(([field, value]) => [
      field,
      protectValue(model, field, value),
    ]),
  ) as Prisma.InputJsonObject;
}

async function auditMany(
  { model, operation, args, query }: AuditOperationParams & { model: string },
  deps: AuditDependencies,
): Promise<unknown> {
  const action = MANY_OPERATIONS[operation];
  const ids =
    action === AuditAction.CREATE
      ? []
      : (
          await deps.delegateOf(model).findMany({
            where: args.where,
            select: { id: true },
            take: MANY_IDS_LIMIT,
          })
        ).map((row) => row.id);
  const result = await query(args);

  const count = Array.isArray(result)
    ? result.length
    : (result as { count: number }).count;
  if (count > 0) {
    deps.record({
      action,
      entity: model,
      entity_id: ids.length === 1 ? ids[0] : null,
      changes: null,
      detail: {
        count,
        ...(ids.length > 0 ? { ids } : {}),
        ...(action === AuditAction.UPDATE
          ? { data: protectData(model, args.data) }
          : {}),
      },
    });
  }

  return result;
}

export function auditOperation(
  params: AuditOperationParams,
  deps: AuditDependencies,
): Promise<unknown> {
  const { model, operation } = params;
  if (!model || UNAUDITED_MODELS.has(model)) {
    return params.query(params.args);
  }
  if (SINGLE_OPERATIONS.has(operation)) {
    return auditSingle({ ...params, model }, deps);
  }
  if (operation in MANY_OPERATIONS) {
    return auditMany({ ...params, model }, deps);
  }
  return params.query(params.args);
}

const logger = new Logger('AuditTrail');

type Delegates = Record<string, Delegate>;
type TransactionCallback = (tx: unknown) => Promise<unknown>;
type TransactionMethod = (
  input: TransactionCallback | unknown[],
  options?: unknown,
) => Promise<unknown>;

// Client da transação interativa em andamento. A leitura de antes precisa rodar
// nele: pelo client de fora, ela pediria uma segunda conexão ao pool enquanto a
// transação segura a primeira, e transações simultâneas em número igual ao pool
// ficariam esperando umas pelas outras. O callback é aguardado dentro do run: a
// consulta que ele devolve sem await (tx.user.update(...)) só executa no then, e
// fora do run ela perderia o client da transação.
const transactionClient = new AsyncLocalStorage<Delegates>();

function trackingTransactions<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property);
      if (property !== '$transaction' || typeof value !== 'function') {
        return value;
      }
      const transaction = (value as TransactionMethod).bind(
        target,
      ) as TransactionMethod;
      return (input: TransactionCallback | unknown[], options?: unknown) =>
        typeof input === 'function'
          ? transaction(
              (tx: unknown) =>
                transactionClient.run(
                  tx as Delegates,
                  async () => await input(tx),
                ),
              options,
            )
          : transaction(input, options);
    },
  });
}

// Toda escrita pelo Prisma passa por aqui. Dentro de uma requisição, a entrada
// espera o interceptor gravá-la com quem fez; fora dela (as tarefas agendadas),
// é gravada na hora, sem autor.
export function withAuditTrail<T extends PrismaClient>(client: T): T {
  const scalarFields = new Map(
    Prisma.dmmf.datamodel.models.map((model) => [
      model.name,
      model.fields.filter((f) => f.kind !== 'object').map((f) => f.name),
    ]),
  );
  const delegates = client as unknown as Delegates;

  const deps: AuditDependencies = {
    delegateOf: (model) =>
      (transactionClient.getStore() ?? delegates)[
        model[0].toLowerCase() + model.slice(1)
      ],
    scalarFieldsOf: (model) => scalarFields.get(model) ?? [],
    record: (entry) => {
      const context = auditContext.getStore();
      if (context) {
        context.entries.push(entry);
        return;
      }
      client.auditLog
        .createMany({ data: [toAuditLogRow(entry, null)] })
        .catch((error: unknown) =>
          logger.error(
            'Falha ao gravar o log de auditoria',
            error instanceof Error ? error.stack : String(error),
          ),
        );
    },
  };

  // O client estendido repassa ao original o que não sobrescreve, então os
  // métodos do PrismaService (onModuleInit) continuam acessíveis.
  return trackingTransactions(
    client.$extends({
      query: {
        $allModels: {
          $allOperations: (params) =>
            auditOperation(params as AuditOperationParams, deps),
        },
      },
    }),
  ) as unknown as T;
}

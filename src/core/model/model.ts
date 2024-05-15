import { Database } from "../database.ts";
import { LifecycleFunction } from "../lifecycle-function.ts";
import { Method } from "../method.ts";
import { fillModel } from "./utils/create-model.ts";
import { countRun, createRun, deleteRun, readRun, sumRun, updateRun } from "../run/run.ts";
import { FookieError } from "../error.ts";
import { SchemaType } from "../schema.ts";
import { Options } from "../option.ts";
import { Mixin } from "../mixin/index.ts";

export const models: {
    schema: SchemaType<typeof Model>;
    database: Database;
    binds?: BindsType | undefined;
    modelClass: typeof Model;
}[] = [];

export class Model {
    id: string;

    static async create<T extends Model>(
        this: new () => T,
        body: Omit<T, "id">,
        options?: Options,
    ): Promise<T | FookieError> {
        throw Error("Not implemented");
    }

    static async read<T extends Model>(
        this: new () => T,
        query?: QueryType<T>,
        options?: Options,
    ): Promise<T[]> {
        throw Error("Not implemented");
    }

    static async update<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        body: Partial<Omit<T, "id">>,
        options?: Options,
    ): Promise<boolean> {
        throw Error("Not implemented");
    }

    static async delete<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        options?: Options,
    ): Promise<boolean> {
        throw Error("Not implemented");
    }

    static async count<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        options?: Options,
    ): Promise<T[]> {
        throw Error("Not implemented");
    }

    static async sum<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        field: string,
        options?: Options,
    ): Promise<number> {
        throw Error("Not implemented");
    }

    static Decorator(model: ModelType) {
        return function <T extends typeof Model>(constructor: T) {
            const schema: SchemaType<T> = Reflect.getMetadata("schema", constructor);

            const filledModel = fillModel(model);

            const methods = filledModel.database.modify<T>(filledModel, schema);
            //@ts-ignore
            constructor.create = createRun<T>(model, schema, constructor, methods.create);
            //@ts-ignore
            constructor.read = readRun(model, schema, constructor, methods.read);
            //@ts-ignore
            constructor.update = updateRun(model, schema, constructor, methods.update);
            //@ts-ignore
            constructor.delete = deleteRun(model, schema, constructor, methods.del);
            //@ts-ignore
            constructor.count = countRun(model, schema, constructor, methods.count);
            //@ts-ignore
            constructor.sum = sumRun(model, schema, constructor, methods.sum);

            Reflect.defineMetadata("model", model, constructor);

            //@ts-ignore
            const m = { modelClass: constructor, ...model, schema: schema };
            models.push(m);
        };
    }
}

export type ModelType = {
    database: Database;
    binds?: BindsType;
    mixins: Mixin[];
};

export type BindsType = {
    [ls in Method]?: {
        preRule?: LifecycleFunction<any, unknown>[];
        modify?: LifecycleFunction<any, unknown>[];
        role?: LifecycleFunction<any, unknown>[];
        rule?: LifecycleFunction<any, unknown>[];
        filter?: LifecycleFunction<any, unknown>[];
        effect?: LifecycleFunction<any, unknown>[];
        accept?: {
            [key: string]: {
                modify: LifecycleFunction<any, unknown>[];
                rule: LifecycleFunction<any, unknown>[];
            };
        };
        reject?: {
            [key: string]: {
                modify: LifecycleFunction<any, unknown>[];
                rule: LifecycleFunction<any, unknown>[];
            };
        };
    };
};

export type QueryType<T> = {
    limit?: number;
    offset?: number;
    attributes?: string[];
    filter?: {
        [key in keyof Partial<T>]: {
            gte?: any;
            gt?: any;
            lte?: any;
            lt?: any;
            equals?: any;
            notEquals?: any;
            in?: any[];
            notIn?: any[];
            like?: string;
            notLike?: string;
            isNull?: boolean;
            isNotNull?: boolean;
            [keyword: string]: any;
        };
    };
};

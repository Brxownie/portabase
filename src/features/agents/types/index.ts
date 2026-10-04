import {EDbmsSchema} from "@/db/schema/types";

export type databaseAgent = {
    name: string;
    dbms: EDbmsSchema;
    generatedId: string;
    pingStatus: boolean;
    method?: string; // files sources from databases.json only (agent ≥ 1.22.0)
};

export type Body = {
    version: string;
    databases: databaseAgent[];
};

import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface AnalysisSession {
    id: bigint;
    tool: string;
    filename: string;
    timestamp: bigint;
    resultSummary: string;
}
export interface backendInterface {
    clearAllSessions(): Promise<void>;
    createSession(filename: string, tool: string, resultSummary: string): Promise<bigint>;
    deleteSession(id: bigint): Promise<boolean>;
    getSessions(): Promise<Array<AnalysisSession>>;
}

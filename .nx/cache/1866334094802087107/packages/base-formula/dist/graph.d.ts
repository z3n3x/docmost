type PropLike = {
    id: string;
    type: string;
    typeOptions: unknown;
};
export declare class BaseFormulaGraph {
    private readonly direct;
    private readonly reverse;
    constructor(properties: PropLike[]);
    directDeps(propId: string): string[];
    dependents(propId: string): string[];
    affectedFormulas(changedPropIds: string[]): string[];
    evalOrder(): string[];
    detectCycle(newProp: PropLike): string[] | null;
}
export {};

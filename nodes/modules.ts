import { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

/**
 * Helper class describing a typical module for .operation.ts files
 */
interface N8NOperationModule {
    description: INodePropertyOptions;
    properties?: INodeProperties[];
}

/**
 * Utility class used to simplify handling modules in N8N classes and
 * show them in a standardized way
 */
export class N8NOperationModuleHandler {
    modules: N8NOperationModule[];

    /**
     * Constructor class
     * @param modules - list of modules for a given resource
     */
    constructor(modules: N8NOperationModule[]) {
        this.modules = modules.sort((operation1, operation2) =>
            operation1.description.name.localeCompare(
                operation2.description.name,
                'en'
            )
        );
    }

    /**
     * Return descriptions for all the modules for a given resource
     */
    getDescriptions(): INodePropertyOptions[] {
        return this.modules.map((operation) => operation.description);
    }

    /**
     * Returns flatten properties for all modules for a given resource
     */
    getProperties(): INodeProperties[] {
        return this.modules.flatMap((operation) => operation.properties || []);
    }
}

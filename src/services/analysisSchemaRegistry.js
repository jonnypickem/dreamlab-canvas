/**
 * Primitives + Lenses schema registry loader.
 * Uses Vite's import.meta.glob so JSON files are bundled with the app.
 */

const primitiveSchemaModules = import.meta.glob('../../analysis_parameters/primitive_schemas/*.json', { eager: true });
const lensSchemaModules = import.meta.glob('../../analysis_parameters/lense_schemas/**/*.json', { eager: true });

function readJsonModule(mod) {
    return mod?.default ?? mod;
}

function fileNameFromPath(path) {
    return path.split('/').pop() || path;
}

function sortByNumericPrefix(a, b) {
    const aName = a._fileName || '';
    const bName = b._fileName || '';
    const aMatch = aName.match(/^(\d+)/);
    const bMatch = bName.match(/^(\d+)/);
    const aNum = aMatch ? Number(aMatch[1]) : Number.MAX_SAFE_INTEGER;
    const bNum = bMatch ? Number(bMatch[1]) : Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return aName.localeCompare(bName);
}

let primitiveCache = null;
let lensCache = null;
let lensRegistryCache = null;

function buildPrimitiveCache() {
    const list = Object.entries(primitiveSchemaModules).map(([path, mod]) => {
        const schema = readJsonModule(mod);
        return {
            ...schema,
            _filePath: path,
            _fileName: fileNameFromPath(path),
        };
    }).sort(sortByNumericPrefix);
    primitiveCache = list;
    return primitiveCache;
}

function buildLensCache() {
    const list = Object.entries(lensSchemaModules).map(([path, mod]) => ({
        ...readJsonModule(mod),
        _filePath: path,
        _fileName: fileNameFromPath(path),
    }));

    const registry = list.find((entry) => entry._fileName === 'LENS_REGISTRY.json') || null;
    lensRegistryCache = registry;

    lensCache = list
        .filter((entry) => entry._fileName !== 'LENS_REGISTRY.json')
        .sort(sortByNumericPrefix);

    return lensCache;
}

export function getPrimitiveSchemas() {
    return primitiveCache || buildPrimitiveCache();
}

export function getPrimitiveSchemaByBlock(schemaBlock) {
    return getPrimitiveSchemas().find((schema) => schema.schema_block === schemaBlock) || null;
}

export function getPrimitiveVersionMap() {
    return getPrimitiveSchemas().reduce((acc, schema) => {
        if (schema.schema_block) {
            acc[schema.schema_block] = schema.version || '1.0.0';
        }
        return acc;
    }, {});
}

export function getLensRegistry() {
    if (lensRegistryCache) return lensRegistryCache;
    buildLensCache();
    return lensRegistryCache;
}

export function getLensSchemas() {
    return lensCache || buildLensCache();
}

export function getLensSchemaById(lensId) {
    return getLensSchemas().find((schema) => schema.lens === lensId) || null;
}

export function getLensSchemasByType(lensType) {
    return getLensSchemas().filter((schema) => schema.lens_type === lensType);
}

export function resolveLensSchemaFromRegistryEntry(fileRef) {
    if (!fileRef) return null;
    const normalized = fileRef.replace(/^\.\//, '');
    return getLensSchemas().find((schema) => (
        schema._filePath.endsWith(`/analysis_parameters/lense_schemas/${normalized}`)
    )) || null;
}

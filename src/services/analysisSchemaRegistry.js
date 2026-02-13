import colorSystemSchema from '../../analysis_parameters/primitive_schemas/01_color_system.json';
import spatialStructureSchema from '../../analysis_parameters/primitive_schemas/02_spatial_structure.json';
import typographyBehaviorSchema from '../../analysis_parameters/primitive_schemas/03_typography_behavior.json';
import surfaceMaterialSchema from '../../analysis_parameters/primitive_schemas/04_surface_material.json';
import shapeLanguageSchema from '../../analysis_parameters/primitive_schemas/05_shape_language.json';
import rhythmPatternSchema from '../../analysis_parameters/primitive_schemas/06_rhythm_pattern.json';
import hierarchyFlowSchema from '../../analysis_parameters/primitive_schemas/07_hierarchy_flow.json';
import imageryModeSchema from '../../analysis_parameters/primitive_schemas/08_imagery_mode.json';
import stylisticLineageSchema from '../../analysis_parameters/primitive_schemas/09_stylistic_lineage.json';

const PRIMITIVE_SCHEMAS = [
    colorSystemSchema,
    spatialStructureSchema,
    typographyBehaviorSchema,
    surfaceMaterialSchema,
    shapeLanguageSchema,
    rhythmPatternSchema,
    hierarchyFlowSchema,
    imageryModeSchema,
    stylisticLineageSchema,
];

export function getPrimitiveSchemas() {
    return PRIMITIVE_SCHEMAS;
}

export function getPrimitiveVersionMap() {
    return PRIMITIVE_SCHEMAS.reduce((acc, schema) => {
        if (!schema?.schema_block) return acc;
        acc[schema.schema_block] = schema.version || '1.0.0';
        return acc;
    }, {});
}


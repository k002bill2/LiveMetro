#!/usr/bin/env node
/**
 * Compatibility entrypoint for regenerating SubwayMapView anchor data.
 *
 * The canonical generator now also emits the parsed Seoul Metro schematic
 * source and the internal-id mapping table.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { writeGeneratedFiles } = require('./seoulMetroSchematicGenerator.cjs');

const result = writeGeneratedFiles(resolve(import.meta.dirname, '..'));
// eslint-disable-next-line no-console
console.log(JSON.stringify(result, null, 2));

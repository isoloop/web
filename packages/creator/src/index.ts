// The widget creator's core (M3e): the spec format, its validator, the
// catalog type, the operators and the pipeline. Views come in task 3.
export {
  KEY_FIELD,
  fieldOf,
  samplesOf,
  toRec,
  topicOf,
  type Catalog,
  type CatalogField,
  type CatalogPreset,
  type CatalogSamples,
  type CatalogTopic,
  type FieldType,
  type Rec,
} from './catalog';
export * from './outputs';
export { outputKind, pipeline, type Pipeline } from './pipeline';
export {
  SPEC_VERSION,
  placementKey,
  type AggregateFn,
  type AggregateOp,
  type BurnOp,
  type Placement,
  type CompareOp,
  type FilterOp,
  type Operator,
  type Scalar,
  type Size,
  type Where,
  type WidgetSpec,
  type WindowOp,
} from './spec/types';
export {
  BURN_MAX_FOR_MS,
  BURN_MAX_LOAD_PCT,
  BURN_MIN_EVERY_MS,
  MAX_CONDITIONS,
  MAX_DEPTH,
  MAX_IN_VALUES,
  MAX_OPERATORS,
  MAX_WINDOW_N,
  MIN_EVERY_MS,
  validateSpec,
  type SpecError,
  type SpecResult,
  type ValidateOptions,
} from './spec/validate';
export { aggregate, aggregateSamples, compileWhere, percentile } from './operators';

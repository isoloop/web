// The widget creator's core (M3e): the spec format, its validator, the
// catalog type, the operators and the pipeline. Views come in task 3.
export {
  KEY_FIELD,
  fieldOf,
  toRec,
  topicOf,
  type Catalog,
  type CatalogField,
  type CatalogTopic,
  type FieldType,
  type Rec,
} from './catalog';
export * from './outputs';
export { outputKind, pipeline, type Pipeline } from './pipeline';
export {
  SPEC_VERSION,
  type AggregateFn,
  type AggregateOp,
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
  MAX_CONDITIONS,
  MAX_DEPTH,
  MAX_IN_VALUES,
  MAX_OPERATORS,
  MAX_WINDOW_N,
  MIN_EVERY_MS,
  validateSpec,
  type SpecError,
  type SpecResult,
} from './spec/validate';
export { aggregate, compileWhere, percentile } from './operators';

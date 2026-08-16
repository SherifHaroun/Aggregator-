/**
 * @aggregator/shared
 *
 * Business rules, configuration and contracts used by BOTH the API and the web
 * client. Nothing in this package touches the database or the DOM.
 *
 *   config/  declarative configuration and business constants
 *   rules/   pure functions that apply those constants
 *   types/   contracts exchanged between API and client
 */

export * from './config/index.js';
export * from './rules/index.js';
export * from './types/index.js';

import { Dependency } from "types";

/**
 *
 * Concatenates the dependencies into a comma separated string.
 * this string will then be passed as an argument to the "importScripts" function
 *
 * @param {Array.<String>} deps array of string
 * @returns {String} a string composed by the concatenation of the array
 * elements "deps" and "importScripts".
 *
 * @example
 * depsParser(['demo1', 'demo2']) // return importScripts('demo1', 'demo2')
 */
function depsParser(deps: Dependency[], esm: boolean = false) {
  if (!deps?.length) return "";

  if (esm) {
    return deps
      .map((dep, i) => {
        if (!dep.esm) {
          return `import '${dep.url}';`;
        }

        const name = dep.name || `DEP_${i}`;

        return `import * as ${name} from '${dep.url}';\nglobalThis.${name} = Object.keys(${name}).length === 1 && ${name}.default ? ${name}.default : ${name};\nconsole.log(${name})`;
      })
      .join("\n");
  } else {
    const depsString = deps.map((dep) => `'${dep.url}'`).toString();
    return `importScripts(${depsString});`;
    // return deps.map((dep) => `import '${dep.url}'`).toString();
  }

  // return `import * as DESTR from 'https://cdn.jsdelivr.net/npm/destr@2.0.0/+esm'`;
}

export default depsParser;

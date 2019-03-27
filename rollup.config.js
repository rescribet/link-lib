import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import sourceMaps from "rollup-plugin-sourcemaps";
import typescript from "rollup-plugin-typescript2";

export default {
    // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
    external: [
        "http-status-codes",
        "jsonld",
        "ml-disjoint-set",
        "n-quads-parser",
        "node-fetch",
        "rdflib",
        "solid-auth-client",
    ],
    input: "src/link-lib.ts",
    output: [
        { file: "dist/link-lib.umd.js", name: "linkLib", format: "umd" },
        { file: "dist/link-lib.es6.js", format: "es" },
    ],
    plugins: [
        // Compile TypeScript files
        typescript({
            typescript: require("typescript"),
        }),
        // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
        commonjs(),
        // Allow node_modules resolution, so you can use 'external' to control
        // which external modules to include in the bundle
        // https://github.com/rollup/rollup-plugin-node-resolve#usage
        resolve(),

        // Resolve source maps to the original source
        sourceMaps(),
    ],
    sourcemap: true,
    watch: {
        include: "src/**",
    },
};

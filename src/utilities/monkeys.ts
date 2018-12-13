import { Serializer } from "rdflib";

/**
 * Fix rdflib issue where multiline strings are serialized in nquads.
 * @see https://github.com/linkeddata/rdflib.js/pull/282
 * @monkey
 */
export function patchRDFLibSerializer(serializer: Serializer, fallback: string): void {
    const old = serializer.stringToN3;
    serializer.stringToN3 = function stringToN3(str: string, flags: string): string {
        let flagsWithFallback = flags;
        if (!flags) {
            flagsWithFallback = fallback;
        }

        return old(str, flagsWithFallback);
    };
}

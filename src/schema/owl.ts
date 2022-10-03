import { SomeTerm } from "@ontologies/core";
import { sameAs } from "@ontologies/owl";

import { Id } from "../datastrucures/DataSlice";
import { VocabularyProcessingContext, VocabularyProcessor } from "../types";

const nsOWLsameAs = sameAs.value;

export const OWL: VocabularyProcessor = {
    axioms: [],

    processStatement(
        recordId: Id,
        field: Id,
        value: SomeTerm,
        ctx: VocabularyProcessingContext,
    ): void {
        if (field === nsOWLsameAs && recordId !== value.value) {
            const a = ctx.equivalenceSet.add(value.value);
            const b = ctx.equivalenceSet.add(recordId);
            ctx.equivalenceSet.union(a, b);
        }
    },

    processType(_: Id, __: VocabularyProcessingContext): boolean {
        return false;
    },
};

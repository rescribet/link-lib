import "jest";
import { BlankNode } from "rdflib";

import { LinkedDataAPI } from "../LinkedDataAPI";
import { defaultNS } from "../utilities/constants";

describe("LinkedDataAPI", () => {
    set("processor", () => ({
        execActionByIRI: jest.fn(),
        fetchResource: jest.fn(),
        getEntity: jest.fn(),
        getStatus: jest.fn(),
        registerTransformer: jest.fn(),
        setAcceptForHost: jest.fn(),
    }));
    set("api", () => new LinkedDataAPI({ processor }));

    describe("#execActionByIRI", () => {
        it("delegates the call", () => {
            expect(processor.execActionByIRI).not.toHaveBeenCalled();
            api.execActionByIRI(defaultNS.example("2"));
            expect(processor.execActionByIRI).toHaveBeenCalledWith(defaultNS.example("2"), undefined);
        });
    });

    describe("#fetchResource", () => {
        it("delegates the call", () => {
            expect(processor.fetchResource).not.toHaveBeenCalled();
            api.fetchResource(defaultNS.example("2"));
            expect(processor.fetchResource).toHaveBeenCalledWith(defaultNS.example("2"));
        });
    });

    describe("#getEntity", () => {
        it("delegates the call", () => {
            expect(processor.getEntity).not.toHaveBeenCalled();
            api.getEntity(defaultNS.example("2"));
            expect(processor.getEntity).toHaveBeenCalledWith(defaultNS.example("2"), undefined);
        });
    });

    describe("#getStatus", () => {
        it("delegates the call for NamedNode's", () => {
            expect(processor.getStatus).not.toHaveBeenCalled();
            api.getStatus(defaultNS.example("2"));
            expect(processor.getStatus).toHaveBeenCalledWith(defaultNS.example("2"));
        });

        it("returns empty request for blank nodes", () => {
            const status = api.getStatus(new BlankNode());
            expect(status).toHaveProperty("lastRequested", null);
            expect(status).toHaveProperty("requested", false);
            expect(status).toHaveProperty("status", null);
            expect(status).toHaveProperty("timesRequested", 0);
        });
    });

    describe("#registerTransformer", () => {
        it("delegates the call", () => {
            expect(processor.registerTransformer).not.toHaveBeenCalled();
            api.registerTransformer({}, ["text/turtle"], 1.0);
            expect(processor.registerTransformer).toHaveBeenCalledWith({}, ["text/turtle"], 1.0);
        });

        it("normalizes the media-type", () => {
            expect(processor.registerTransformer).not.toHaveBeenCalled();
            api.registerTransformer({}, "text/turtle", 1.0);
            expect(processor.registerTransformer).toHaveBeenCalledWith({}, ["text/turtle"], 1.0);
        });
    });

    describe("#setAcceptForHost", () => {
        it("delegates the call", () => {
            expect(processor.setAcceptForHost).not.toHaveBeenCalled();
            api.setAcceptForHost("http://example.org", "text/html");
            expect(processor.setAcceptForHost).toHaveBeenCalledWith("http://example.org", "text/html");
        });
    });
});
